import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import {
	containedPath,
	containedDirectory,
	findFiles,
	readBoundedText,
	readMarkdown
} from '../../../scripts/lib/files.mjs';
import { cachedStatusJudgment, rankBullets } from '../../../scripts/lib/status-judgments.mjs';
import { dirname, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import MarkdownIt from 'markdown-it';
import {
	EMPTY_GITHUB,
	EMPTY_JUDGMENT,
	judgmentConfirmed,
	staleGithub
} from '$lib/workspace/data-quality';
import { weeklyCommitBuckets } from '$lib/workspace/cadence';
import { concurrencyLimit, mapConcurrent } from './concurrency';
import { selectRecord } from '$lib/workspace/navigation';
import { workspaceSummary } from '$lib/workspace/summary';
import { staleStatus, statusDate } from '$lib/workspace/freshness';
import type {
	ConventionCheck,
	GithubRelease,
	GithubSnapshot,
	GitSnapshot,
	PreviewSelection,
	ProjectDefinition,
	ProjectDetail,
	ProjectDocument,
	ProjectRecordKind,
	ProjectSnapshot,
	RecentCommit,
	StatusFreshness,
	StatusJudgment,
	WorkspaceConfig,
	WorkspaceLoadResult,
	WorkspaceSnapshot
} from '$lib/workspace/types';

const execFileAsync = promisify(execFile);
// One gate for all local requests, not one limit per project or scan.
const runGit = concurrencyLimit(4);
const APP_ROOT = process.cwd();
const markdown = new MarkdownIt({
	html: false,
	linkify: true,
	typographer: true
});
const EMPTY_GIT: GitSnapshot = {
	isRepository: false,
	branch: null,
	dirtyFiles: null,
	lastCommitAt: null,
	lastCommitHash: null,
	lastCommitSubject: null,
	remoteUrl: null,
	githubUrl: null,
	ahead: null,
	behind: null,
	commitsByWeek: []
};

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

function projectId(projectPath: string): string {
	return projectPath
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

export class WorkspaceDataError extends Error {
	constructor(
		readonly kind: 'missing' | 'invalid',
		readonly dataRoot: string,
		readonly issues: string[]
	) {
		super(issues.join('\n'));
	}
}

export function dataRoot(): string {
	return resolve(process.env.CADENCE_DATA_ROOT ?? resolve(APP_ROOT, '..', 'cadence-workspace'));
}

function projectsRoot(): string {
	return resolve(dataRoot(), 'projects');
}

async function workspaceRoot(config: WorkspaceConfig): Promise<string> {
	const root = resolve(dataRoot(), config.workspaceRoot);
	const canonical = await containedDirectory(root, root);
	if (!canonical) {
		throw new WorkspaceDataError('invalid', dataRoot(), [`Workspace root does not exist: ${root}`]);
	}
	return canonical;
}

function projectDirectory(root: string, projectPath: string): string {
	const directory = resolve(root, projectPath);
	const pathFromRoot = relative(root, directory);
	if (pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === '..') {
		throw new Error(`Project path escapes WORKSPACE_ROOT: ${projectPath}`);
	}
	return directory;
}

function projectRecordsDirectory(projectPath: string): string {
	const root = projectsRoot();
	const directory = resolve(root, projectPath);
	const pathFromRoot = relative(root, directory);
	if (pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === '..') {
		throw new Error(`Project records path escapes projects/: ${projectPath}`);
	}
	return directory;
}

export async function loadWorkspaceConfig(): Promise<WorkspaceConfig> {
	const path = resolve(dataRoot(), 'cadence.config.json');
	if (!(await exists(path)))
		throw new WorkspaceDataError('missing', dataRoot(), [`Missing ${path}`]);
	const source = await readBoundedText(dataRoot(), path);
	if (!source || source.truncated)
		throw new WorkspaceDataError('invalid', dataRoot(), [
			'cadence.config.json is unreadable, oversized or outside the data repository.'
		]);
	const raw = source.text;

	let config: WorkspaceConfig;
	try {
		config = JSON.parse(raw) as WorkspaceConfig;
	} catch {
		throw new WorkspaceDataError('invalid', dataRoot(), ['cadence.config.json is not valid JSON.']);
	}
	if (
		config.schemaVersion !== 1 ||
		typeof config.name !== 'string' ||
		!config.name.trim() ||
		typeof config.workspaceRoot !== 'string' ||
		!config.workspaceRoot.trim()
	) {
		throw new WorkspaceDataError('invalid', dataRoot(), [
			'cadence.config.json must contain schemaVersion 1, name, and workspaceRoot.'
		]);
	}
	return config;
}

const LIFECYCLES = new Set(['active', 'maintained', 'paused', 'dormant', 'archived', 'unknown']);

export async function loadProjectDefinitions(): Promise<ProjectDefinition[]> {
	const root = projectsRoot();
	if (!(await exists(root))) return [];
	if (!(await containedDirectory(dataRoot(), root))) {
		throw new WorkspaceDataError('invalid', dataRoot(), [
			'projects/ resolves outside the data repository.'
		]);
	}
	const paths = (
		await findFiles(dataRoot(), root, {
			accept: (path) => path.split(sep).at(-1) === 'project.json',
			limit: 10_000
		})
	).map((path) => resolve(root, path));
	const issues: string[] = [];
	const projects: ProjectDefinition[] = [];
	for (const path of paths) {
		const expectedPath = relative(root, dirname(path)).split(sep).join('/');
		try {
			const source = await readBoundedText(dataRoot(), path);
			if (!source || source.truncated) throw new Error('Unreadable metadata');
			const project = JSON.parse(source.text) as ProjectDefinition;
			if (
				typeof project.path !== 'string' ||
				typeof project.name !== 'string' ||
				typeof project.group !== 'string' ||
				typeof project.summary !== 'string' ||
				!LIFECYCLES.has(project.lifecycle)
			) {
				issues.push(`${relative(dataRoot(), path)} is missing required project metadata.`);
				continue;
			}
			if (project.path !== expectedPath) {
				issues.push(
					`${relative(dataRoot(), path)} declares path "${project.path}"; expected "${expectedPath}".`
				);
				continue;
			}
			projects.push(project);
		} catch {
			issues.push(`${relative(dataRoot(), path)} is not valid JSON.`);
		}
	}

	const pathsSeen = new Set<string>();
	const idsSeen = new Set<string>();
	for (const project of projects) {
		const id = projectId(project.path);
		if (pathsSeen.has(project.path)) issues.push(`Duplicate project path: ${project.path}`);
		if (idsSeen.has(id)) issues.push(`Project paths produce duplicate URL id: ${id}`);
		pathsSeen.add(project.path);
		idsSeen.add(id);
	}
	if (issues.length) throw new WorkspaceDataError('invalid', dataRoot(), issues);
	return projects.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
}

async function git(directory: string, args: string[]): Promise<string | null> {
	try {
		const { stdout } = await runGit(() =>
			execFileAsync('git', ['-C', directory, ...args], {
				encoding: 'utf8',
				timeout: 5_000,
				maxBuffer: 1024 * 1024,
				env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }
			})
		);
		return stdout.trim();
	} catch {
		return null;
	}
}

function githubUrl(remote: string | null): string | null {
	if (!remote) return null;
	const ssh = remote.match(/^git@github\.com:(.+?)(?:\.git)?$/);
	if (ssh) return `https://github.com/${ssh[1]}`;
	try {
		const url = new URL(remote);
		if (url.hostname !== 'github.com') return null;
		return `https://github.com/${url.pathname.replace(/^\//, '').replace(/\.git$/, '')}`;
	} catch {
		return null;
	}
}

function commitCount(value: string | undefined): number | null {
	if (value === undefined) return null;
	const count = Number(value);
	return Number.isInteger(count) && count >= 0 ? count : null;
}

async function inspectGit(directory: string): Promise<GitSnapshot> {
	if (!(await exists(resolve(directory, '.git')))) return { ...EMPTY_GIT };

	const [branch, status, log, remoteUrl, divergence, recentDates] = await Promise.all([
		git(directory, ['branch', '--show-current']),
		git(directory, ['status', '--porcelain=v1']),
		git(directory, ['log', '-1', '--format=%cI%x00%h%x00%s']),
		git(directory, ['remote', 'get-url', 'origin']),
		git(directory, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD']),
		git(directory, ['log', '--since=84.days', '--format=%cI'])
	]);
	const [lastCommitAt = null, lastCommitHash = null, lastCommitSubject = null] =
		log?.split('\0') ?? [];
	// rev-list --left-right --count upstream...HEAD prints "behind<TAB>ahead".
	const [behind, ahead] = divergence?.split(/\s+/) ?? [];

	return {
		isRepository: true,
		branch,
		dirtyFiles: status === null ? null : status.split('\n').filter(Boolean).length,
		lastCommitAt,
		lastCommitHash,
		lastCommitSubject,
		remoteUrl,
		githubUrl: githubUrl(remoteUrl),
		ahead: commitCount(ahead),
		behind: commitCount(behind),
		commitsByWeek:
			recentDates === null ? [] : weeklyCommitBuckets(recentDates.split('\n').filter(Boolean))
	};
}

async function detectPackageManager(directory: string): Promise<ProjectSnapshot['packageManager']> {
	const candidates = [
		['pnpm-lock.yaml', 'pnpm'],
		['bun.lock', 'bun'],
		['bun.lockb', 'bun'],
		['yarn.lock', 'yarn'],
		['package-lock.json', 'npm']
	] as const;
	for (const [file, manager] of candidates) {
		if (await exists(resolve(directory, file))) return manager;
	}
	return null;
}

async function markdownCount(directory: string, projectPath: string): Promise<number> {
	const recordsRoot = await containedDirectory(dataRoot(), projectRecordsDirectory(projectPath));
	const [documents, records] = await Promise.all([
		findFiles(directory, resolve(directory, 'docs')),
		recordsRoot ? findFiles(recordsRoot, recordsRoot) : []
	]);
	return documents.length + records.length;
}

async function conventionChecks(
	directory: string,
	projectPath: string,
	status: Promise<StatusFreshness>
): Promise<ConventionCheck[]> {
	const recordsDirectory = projectRecordsDirectory(projectPath);
	return Promise.all([
		check(
			'readme',
			'README',
			containedPath(directory, resolve(directory, 'README.md')).then(Boolean)
		),
		check(
			'agents',
			'Agent guide',
			containedPath(directory, resolve(directory, 'AGENTS.md')).then(Boolean)
		),
		check(
			'docs',
			'Documentation',
			containedDirectory(directory, resolve(directory, 'docs')).then(Boolean)
		),
		check(
			'metadata',
			'Project metadata',
			containedPath(dataRoot(), resolve(recordsDirectory, 'project.json')).then(Boolean)
		),
		check(
			'status',
			'Current status',
			status.then((status) => status.present)
		)
	]);
}

async function check(
	key: ConventionCheck['key'],
	label: string,
	result: Promise<boolean>
): Promise<ConventionCheck> {
	return { key, label, present: await result };
}

/** Map a cached refresh entry to the app's judgment states. A judgment counts
 *  only when it was computed from the current STATUS.md text. */
function statusJudgment(entry: unknown, text: string): StatusJudgment {
	if (!entry || typeof entry !== 'object') return EMPTY_JUDGMENT;
	const raw = entry as Record<string, unknown>;
	const judgedAt = typeof raw.generatedAt === 'string' ? raw.generatedAt : null;
	const model = typeof raw.model === 'string' ? raw.model : null;
	const base = { ...EMPTY_JUDGMENT, judgedAt, model };
	if (raw.state === 'skipped') return EMPTY_JUDGMENT;
	if (raw.state === 'failed') return { ...base, state: 'failed' };
	if (raw.state === 'not-applicable') return { ...base, state: 'not-applicable' };
	if (raw.state !== 'updated') return { ...base, state: 'unavailable' };
	const judgment = cachedStatusJudgment(entry, text);
	if (!judgment) return { ...base, state: 'stale' };
	const texts = (bullets: Parameters<typeof rankBullets>[0]) =>
		rankBullets(bullets).map((bullet) => bullet.text);
	return {
		...base,
		state: 'confirmed',
		sections: {
			current: texts(judgment.sections.current),
			next: texts(judgment.sections.next),
			risks: texts(judgment.sections.risks)
		},
		parked: judgment.parked
	};
}

/** Status records live in the data repository, so this works even when the
 *  project directory itself is missing locally. The Updated: convention wins;
 *  a confirmed judgment supplies the date only when that line is unreadable. */
async function statusFreshness(
	projectPath: string,
	judgmentEntry: unknown = null
): Promise<StatusFreshness> {
	const root = await containedDirectory(dataRoot(), projectRecordsDirectory(projectPath));
	const text = root ? await readMarkdown(root, resolve(root, 'STATUS.md')) : null;
	if (text === null)
		return {
			present: false,
			updatedAt: null,
			stale: false,
			updatedAtSource: null,
			judgment: EMPTY_JUDGMENT
		};
	const judgment = statusJudgment(judgmentEntry, text);
	const conventional = statusDate(text);
	const judged =
		judgmentConfirmed(judgment) && !conventional
			? (cachedStatusJudgment(judgmentEntry, text)?.updatedAt?.value ?? null)
			: null;
	const updatedAt = conventional ?? judged;
	return {
		present: true,
		updatedAt,
		stale: staleStatus(updatedAt),
		updatedAtSource: conventional ? 'convention' : judged ? 'judged' : null,
		judgment
	};
}

function githubCachePath(): string {
	return resolve(
		process.env.CADENCE_CACHE_ROOT ?? resolve(APP_ROOT, '.workspace-cache'),
		'projects.json'
	);
}

function normalizeRelease(value: unknown): GithubRelease | null {
	if (!value || typeof value !== 'object') return null;
	const release = value as Record<string, unknown>;
	if (typeof release.tagName !== 'string' || typeof release.url !== 'string') return null;
	return {
		name: typeof release.name === 'string' && release.name ? release.name : release.tagName,
		tagName: release.tagName,
		url: release.url,
		publishedAt: typeof release.publishedAt === 'string' ? release.publishedAt : ''
	};
}

/** Preserve missing and failed cache states instead of treating them as zero work. */
async function readGithubCache(): Promise<{
	byPath: Map<string, GithubSnapshot>;
	fallback: GithubSnapshot;
	/** Raw per-project judgment entries; validated against the file text later. */
	judgments: Map<string, unknown>;
}> {
	const byPath = new Map<string, GithubSnapshot>();
	const judgments = new Map<string, unknown>();
	const path = githubCachePath();
	if (!(await exists(path))) return { byPath, fallback: EMPTY_GITHUB, judgments };
	const source = await readBoundedText(dirname(path), path, 8 * 1024 * 1024);
	if (!source || source.truncated)
		return { byPath, fallback: { ...EMPTY_GITHUB, state: 'unavailable' }, judgments };
	const raw = source.text;

	try {
		const cache = JSON.parse(raw);
		if (cache?.schemaVersion !== 1 || !Array.isArray(cache.projects))
			throw new Error('Invalid cache');
		const fetchedAt =
			typeof cache.generatedAt === 'string' && Number.isFinite(Date.parse(cache.generatedAt))
				? cache.generatedAt
				: null;
		for (const entry of cache.projects) {
			if (typeof entry?.path !== 'string') continue;
			if (entry.judgments) judgments.set(entry.path, entry.judgments);
			const github = entry.github;
			const base = { ...EMPTY_GITHUB, fetchedAt };
			if (github?.state !== 'updated') {
				const state =
					github?.state === 'failed'
						? 'failed'
						: github?.state === 'skipped'
							? 'absent'
							: 'unavailable';
				byPath.set(entry.path, {
					...base,
					state,
					fetchedAt: state === 'absent' ? null : fetchedAt
				});
				continue;
			}
			const count = (value: unknown): number | null =>
				typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
			byPath.set(entry.path, {
				state: staleGithub(fetchedAt) ? 'stale' : 'ok',
				fetchedAt,
				isPrivate: typeof github.isPrivate === 'boolean' ? github.isPrivate : null,
				openIssues: count(github.issues?.totalCount),
				openPullRequests: count(github.pullRequests?.totalCount),
				latestRelease: normalizeRelease(github.latestRelease)
			});
		}
		return { byPath, fallback: EMPTY_GITHUB, judgments };
	} catch {
		return {
			byPath: new Map(),
			fallback: { ...EMPTY_GITHUB, state: 'unavailable' },
			judgments: new Map()
		};
	}
}

async function inspectProject(
	root: string,
	project: ProjectDefinition,
	github: GithubSnapshot,
	judgmentEntry: unknown = null
): Promise<ProjectSnapshot> {
	const declared = projectDirectory(root, project.path);
	if (!(await containedPath(root, declared, { allowMissing: true }))) {
		throw new WorkspaceDataError('invalid', dataRoot(), [
			`Project path resolves outside workspaceRoot or is inaccessible: ${project.path}`
		]);
	}
	const directory = await containedDirectory(root, declared);
	if (!directory) {
		return {
			...project,
			id: projectId(project.path),
			exists: false,
			packageManager: null,
			convention: [],
			conventionScore: 0,
			documentCount: 0,
			git: { ...EMPTY_GIT },
			github,
			status: await statusFreshness(project.path, judgmentEntry)
		};
	}

	const freshness = statusFreshness(project.path, judgmentEntry);
	const [packageManager, convention, documentCount, gitSnapshot, status] = await Promise.all([
		detectPackageManager(directory),
		conventionChecks(directory, project.path, freshness),
		markdownCount(directory, project.path),
		inspectGit(directory),
		freshness
	]);
	const complete = convention.filter((item) => item.present).length;

	return {
		...project,
		id: projectId(project.path),
		exists: true,
		packageManager,
		convention,
		conventionScore: Math.round((complete / convention.length) * 100),
		documentCount,
		git: gitSnapshot,
		github:
			github.state === 'absent' &&
			(!gitSnapshot.isRepository || (gitSnapshot.remoteUrl && !gitSnapshot.githubUrl))
				? { ...EMPTY_GITHUB, state: 'not-applicable' }
				: github,
		status
	};
}

export async function scanWorkspace(): Promise<WorkspaceSnapshot> {
	const config = await loadWorkspaceConfig();
	const [root, definitions, githubByPath] = await Promise.all([
		workspaceRoot(config),
		loadProjectDefinitions(),
		readGithubCache()
	]);
	const projects = await mapConcurrent(definitions, 4, (project) =>
		inspectProject(
			root,
			project,
			githubByPath.byPath.get(project.path) ?? githubByPath.fallback,
			githubByPath.judgments.get(project.path) ?? null
		)
	);

	return {
		mode: 'local',
		name: config.name,
		root,
		generatedAt: new Date().toISOString(),
		projects,
		summary: workspaceSummary(projects)
	};
}

export async function loadWorkspace(): Promise<WorkspaceLoadResult> {
	try {
		return { state: 'ready', mode: 'local', workspace: await scanWorkspace() };
	} catch (error) {
		if (error instanceof WorkspaceDataError) {
			return error.kind === 'missing'
				? { state: 'setup', mode: 'local', dataRoot: error.dataRoot }
				: {
						state: 'invalid',
						mode: 'local',
						dataRoot: error.dataRoot,
						errors: error.issues
					};
		}
		throw error;
	}
}

function documentKind(path: string): ProjectDocument['kind'] {
	if (path === 'README.md') return 'readme';
	if (path === 'AGENTS.md') return 'agents';
	if (path.endsWith('STATUS.md')) return 'status';
	if (path.includes('/plans/')) return 'plan';
	if (path.includes('/decisions/')) return 'decision';
	if (path.includes('/meetings/')) return 'meeting';
	if (path.includes('/notes/')) return 'note';
	if (path.includes('/inbox/')) return 'inbox';
	return 'documentation';
}

function projectRecordKind(path: string): ProjectRecordKind | null {
	const kind = documentKind(path);
	return ['status', 'plan', 'decision', 'meeting', 'note', 'inbox'].includes(kind)
		? (kind as ProjectRecordKind)
		: null;
}

function markdownTitle(source: string, fallback: string): string {
	const heading = source.match(/^#\s+(.+)$/m)?.[1]?.trim();
	return heading || fallback;
}

/** Lists read only a 4 KiB title prefix; full previews are read after selection. */
async function listDocuments(directory: string): Promise<ProjectDetail['documents']> {
	const paths = await findFiles(directory, directory);
	const documents = await mapConcurrent(paths, 4, async (path) => {
		const source = await readBoundedText(directory, resolve(directory, path), 4096);
		if (!source) return null;
		return {
			path,
			title: markdownTitle(source.text, fileTitle(path)),
			kind: documentKind(path)
		};
	});
	return documents.filter((document) => document !== null);
}

function fileTitle(path: string): string {
	return path.split(sep).at(-1)!.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
}

function githubFileUrl(gitSnapshot: GitSnapshot, path: string): string | null {
	if (!gitSnapshot.githubUrl) return null;
	const normalizedPath = path.split(sep).join('/');
	const ref = gitSnapshot.branch || 'HEAD';
	return encodeURI(`${gitSnapshot.githubUrl}/blob/${ref}/${normalizedPath}`);
}

async function loadProjectRecords(
	projectPath: string,
	cadenceGit: GitSnapshot
): Promise<ProjectDetail['records']> {
	const projectRoot = await containedDirectory(dataRoot(), projectRecordsDirectory(projectPath));
	if (!projectRoot) return [];
	const paths = await findFiles(projectRoot, projectRoot, {
		accept: (path) =>
			path.endsWith('.md') &&
			path.split(sep).at(-1) !== 'README.md' &&
			projectRecordKind(`projects/${projectPath}/${path}`) !== null
	});
	const records = await mapConcurrent(paths, 4, async (recordPath) => {
		const path = `projects/${projectPath}/${recordPath.split(sep).join('/')}`;
		const source = await readBoundedText(projectRoot, resolve(projectRoot, recordPath), 4096);
		const kind = projectRecordKind(path);
		if (!source || !kind) return null;
		return {
			path,
			title: markdownTitle(source.text, fileTitle(recordPath)),
			kind,
			sourceUrl: githubFileUrl(cadenceGit, path)
		};
	});

	const kindOrder: ProjectRecordKind[] = ['status', 'plan', 'decision', 'meeting', 'note', 'inbox'];
	return records
		.filter((record) => record !== null)
		.sort(
			(a, b) =>
				kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) || a.path.localeCompare(b.path)
		);
}

async function recentCommits(directory: string): Promise<RecentCommit[]> {
	const output = await git(directory, ['log', '-8', '--format=%h%x00%cI%x00%s']);
	if (!output) return [];
	return output.split('\n').flatMap((line) => {
		const [hash, date, subject] = line.split('\0');
		return hash && date && subject ? [{ hash, date, subject }] : [];
	});
}

/** Read only a discovered selection; never turn URL input directly into a file read. */
async function selectedPreview<T extends { path: string }>(
	items: T[],
	selected: T | undefined,
	read: (item: T) => Promise<string | null>
): Promise<(T & { html: string }) | null> {
	if (!selected) return null;
	const source = await read(selected);
	if (source !== null) return { ...selected, html: markdown.render(source) };
	// Optional files may disappear between discovery and selection. Remove the stale
	// entry and try the next available default, allowing the UI to explain fallback.
	items.splice(items.indexOf(selected), 1);
	return selectedPreview(items, items[0], read);
}

async function recordSourceGit(): Promise<GitSnapshot> {
	if (!(await exists(resolve(dataRoot(), '.git')))) return { ...EMPTY_GIT };
	const [branch, remote] = await Promise.all([
		git(dataRoot(), ['branch', '--show-current']),
		git(dataRoot(), ['remote', 'get-url', 'origin'])
	]);
	return { ...EMPTY_GIT, branch, githubUrl: githubUrl(remote) };
}

export async function getProjectDetail(
	id: string,
	selection: PreviewSelection = {}
): Promise<ProjectDetail | null> {
	const config = await loadWorkspaceConfig();
	const [root, definitions] = await Promise.all([workspaceRoot(config), loadProjectDefinitions()]);
	const definition = definitions.find((candidate) => projectId(candidate.path) === id);
	if (!definition) return null;
	const github = await readGithubCache();
	const project = await inspectProject(
		root,
		definition,
		github.byPath.get(definition.path) ?? github.fallback,
		github.judgments.get(definition.path) ?? null
	);
	const directory = await containedDirectory(root, projectDirectory(root, project.path));
	// Source links need only a branch and remote, not a full Git/status/history scan.
	const [documents, cadenceGit, commits] = await Promise.all([
		directory ? listDocuments(directory) : [],
		recordSourceGit(),
		directory ? recentCommits(directory) : []
	]);
	const records = await loadProjectRecords(project.path, cadenceGit);
	const recordRoot = await containedDirectory(dataRoot(), projectRecordsDirectory(project.path));
	const [selectedDocument, selectedRecord] = await Promise.all([
		selectedPreview(
			documents,
			documents.find((item) => item.path === selection.document) ??
				documents.find((item) => item.kind === 'readme') ??
				documents[0],
			(item) =>
				directory ? readMarkdown(directory, resolve(directory, item.path)) : Promise.resolve(null)
		),
		selectedPreview(records, selectRecord(records, selection.record ?? null), (item) =>
			recordRoot
				? readMarkdown(
						recordRoot,
						resolve(recordRoot, item.path.slice(`projects/${project.path}/`.length))
					)
				: Promise.resolve(null)
		)
	]);
	return { project, documents, records, selectedDocument, selectedRecord, recentCommits: commits };
}
