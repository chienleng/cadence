import { execFile } from 'node:child_process';
import type { Dirent } from 'node:fs';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import MarkdownIt from 'markdown-it';
import type {
	ConventionCheck,
	GitSnapshot,
	ProjectDefinition,
	ProjectDetail,
	ProjectDocument,
	ProjectRecord,
	ProjectRecordKind,
	ProjectSnapshot,
	RecentCommit,
	WorkspaceConfig,
	WorkspaceLoadResult,
	WorkspaceSnapshot
} from '$lib/workspace/types';

const execFileAsync = promisify(execFile);
const APP_ROOT = process.cwd();
const markdown = new MarkdownIt({
	html: false,
	linkify: true,
	typographer: true
});
const EMPTY_GIT: GitSnapshot = {
	isRepository: false,
	branch: null,
	dirtyFiles: 0,
	lastCommitAt: null,
	lastCommitHash: null,
	lastCommitSubject: null,
	remoteUrl: null,
	githubUrl: null
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
	if (!(await exists(root))) {
		throw new WorkspaceDataError('invalid', dataRoot(), [`Workspace root does not exist: ${root}`]);
	}
	return root;
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
	let raw: string;
	try {
		raw = await readFile(path, 'utf8');
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			throw new WorkspaceDataError('missing', dataRoot(), [`Missing ${path}`]);
		}
		throw error;
	}

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

const LIFECYCLES = new Set(['active', 'maintained', 'paused', 'dormant', 'unknown']);

export async function loadProjectDefinitions(): Promise<ProjectDefinition[]> {
	const root = projectsRoot();
	if (!(await exists(root))) return [];
	const paths: string[] = [];

	async function visit(directory: string, depth: number): Promise<void> {
		if (depth > 12) return;
		const entries = await readdir(directory, { withFileTypes: true });
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
			const absolute = resolve(directory, entry.name);
			if (entry.isDirectory()) await visit(absolute, depth + 1);
			else if (entry.isFile() && entry.name === 'project.json') paths.push(absolute);
		}
	}

	await visit(root, 0);
	const issues: string[] = [];
	const projects: ProjectDefinition[] = [];
	for (const path of paths) {
		const expectedPath = relative(root, dirname(path)).split(sep).join('/');
		try {
			const project = JSON.parse(await readFile(path, 'utf8')) as ProjectDefinition;
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
		const { stdout } = await execFileAsync('git', ['-C', directory, ...args], {
			encoding: 'utf8',
			timeout: 5_000,
			maxBuffer: 1024 * 1024
		});
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

async function inspectGit(directory: string): Promise<GitSnapshot> {
	if (!(await exists(resolve(directory, '.git')))) return { ...EMPTY_GIT };

	const [branch, status, log, remoteUrl] = await Promise.all([
		git(directory, ['branch', '--show-current']),
		git(directory, ['status', '--porcelain=v1']),
		git(directory, ['log', '-1', '--format=%cI%x00%h%x00%s']),
		git(directory, ['remote', 'get-url', 'origin'])
	]);
	const [lastCommitAt = null, lastCommitHash = null, lastCommitSubject = null] =
		log?.split('\0') ?? [];

	return {
		isRepository: true,
		branch: branch || null,
		dirtyFiles: status ? status.split('\n').filter(Boolean).length : 0,
		lastCommitAt,
		lastCommitHash,
		lastCommitSubject,
		remoteUrl,
		githubUrl: githubUrl(remoteUrl)
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
	const roots = [resolve(directory, 'docs'), projectRecordsDirectory(projectPath)];
	let count = 0;
	for (const root of roots) {
		if (!(await exists(root))) continue;
		try {
			const entries = await readdir(root, { recursive: true, withFileTypes: true });
			count += entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md')).length;
		} catch {
			// A disappearing or unreadable documentation directory should not break the dashboard.
		}
	}
	return count;
}

async function conventionChecks(
	directory: string,
	projectPath: string
): Promise<ConventionCheck[]> {
	const recordsDirectory = projectRecordsDirectory(projectPath);
	return Promise.all([
		check('readme', 'README', exists(resolve(directory, 'README.md'))),
		check('agents', 'Agent guide', exists(resolve(directory, 'AGENTS.md'))),
		check('docs', 'Documentation', exists(resolve(directory, 'docs'))),
		check('metadata', 'Project metadata', exists(resolve(recordsDirectory, 'project.json'))),
		check('status', 'Current status', exists(resolve(recordsDirectory, 'STATUS.md')))
	]);
}

async function check(
	key: ConventionCheck['key'],
	label: string,
	result: Promise<boolean>
): Promise<ConventionCheck> {
	return { key, label, present: await result };
}

async function inspectProject(root: string, project: ProjectDefinition): Promise<ProjectSnapshot> {
	const directory = projectDirectory(root, project.path);
	const projectExists = await exists(directory);
	if (!projectExists) {
		return {
			...project,
			id: projectId(project.path),
			exists: false,
			packageManager: null,
			convention: [],
			conventionScore: 0,
			documentCount: 0,
			git: { ...EMPTY_GIT }
		};
	}

	const [packageManager, convention, documentCount, gitSnapshot] = await Promise.all([
		detectPackageManager(directory),
		conventionChecks(directory, project.path),
		markdownCount(directory, project.path),
		inspectGit(directory)
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
		git: gitSnapshot
	};
}

export async function scanWorkspace(): Promise<WorkspaceSnapshot> {
	const config = await loadWorkspaceConfig();
	const [root, definitions] = await Promise.all([workspaceRoot(config), loadProjectDefinitions()]);
	const projects = await Promise.all(definitions.map((project) => inspectProject(root, project)));

	return {
		mode: 'local',
		name: config.name,
		root,
		generatedAt: new Date().toISOString(),
		projects,
		summary: {
			total: projects.length,
			active: projects.filter((project) => project.lifecycle === 'active').length,
			dirty: projects.filter((project) => project.git.dirtyFiles > 0).length,
			missing: projects.filter((project) => !project.exists).length,
			fullyStandardized: projects.filter((project) => project.conventionScore === 100).length
		}
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

const SKIPPED_DOCUMENT_DIRECTORIES = new Set([
	'.git',
	'.next',
	'.nuxt',
	'.output',
	'.projects',
	'.svelte-kit',
	'.turbo',
	'.vite',
	'.wrangler',
	'build',
	'coverage',
	'dist',
	'node_modules',
	'target',
	'vendor'
]);

async function findMarkdownFiles(directory: string, limit = 200): Promise<string[]> {
	const paths: string[] = [];

	async function visit(current: string, depth: number): Promise<void> {
		if (paths.length >= limit || depth > 12) return;
		let entries: Dirent[];
		try {
			entries = await readdir(current, { withFileTypes: true });
		} catch {
			return;
		}

		entries.sort((a, b) => a.name.localeCompare(b.name));
		for (const entry of entries) {
			if (paths.length >= limit) break;
			const absolutePath = resolve(current, entry.name);
			if (entry.isDirectory() && !SKIPPED_DOCUMENT_DIRECTORIES.has(entry.name)) {
				await visit(absolutePath, depth + 1);
			} else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
				paths.push(relative(directory, absolutePath));
			}
		}
	}

	await visit(directory, 0);
	return paths;
}

async function listDocuments(directory: string): Promise<ProjectDocument[]> {
	const paths = await findMarkdownFiles(directory);

	return Promise.all(
		paths
			.sort((a, b) => a.localeCompare(b))
			.map(async (path): Promise<ProjectDocument> => {
				const source = (await readFile(resolve(directory, path), 'utf8')).slice(0, 512 * 1024);
				const fallback = path.split('/').at(-1)?.replace(/\.md$/, '').replace(/[-_]/g, ' ') ?? path;
				return {
					path,
					title: markdownTitle(source, fallback),
					kind: documentKind(path),
					html: markdown.render(source)
				};
			})
	);
}

function githubFileUrl(gitSnapshot: GitSnapshot, path: string): string | null {
	if (!gitSnapshot.githubUrl) return null;
	const normalizedPath = path.split(sep).join('/');
	const ref = gitSnapshot.branch ?? 'HEAD';
	return encodeURI(`${gitSnapshot.githubUrl}/blob/${ref}/${normalizedPath}`);
}

async function loadProjectRecords(
	projectPath: string,
	cadenceGit: GitSnapshot
): Promise<ProjectRecord[]> {
	const projectRoot = projectRecordsDirectory(projectPath);
	if (!(await exists(projectRoot))) return [];

	const entries = await readdir(projectRoot, { recursive: true, withFileTypes: true });
	const records = await Promise.all(
		entries
			.filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
			.slice(0, 200)
			.map(async (entry): Promise<ProjectRecord | null> => {
				const absolutePath = resolve(entry.parentPath, entry.name);
				const path = relative(dataRoot(), absolutePath);
				const kind = projectRecordKind(path);
				if (!kind) return null;

				// Project records are small working documents. Cap reads so one accidental
				// large file cannot overwhelm the detail page.
				const source = (await readFile(absolutePath, 'utf8')).slice(0, 512 * 1024);
				const fallback = entry.name.replace(/\.md$/, '').replace(/[-_]/g, ' ');
				return {
					path,
					title: markdownTitle(source, fallback),
					kind,
					html: markdown.render(source),
					sourceUrl: githubFileUrl(cadenceGit, path)
				};
			})
	);

	const kindOrder: ProjectRecordKind[] = ['status', 'plan', 'decision', 'meeting', 'note', 'inbox'];
	return records
		.filter((record): record is ProjectRecord => record !== null)
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

export async function getProjectDetail(id: string): Promise<ProjectDetail | null> {
	const snapshot = await scanWorkspace();
	const project = snapshot.projects.find((candidate) => candidate.id === id);
	if (!project || !project.exists) return null;
	const directory = projectDirectory(snapshot.root, project.path);
	const [documents, cadenceGit, commits] = await Promise.all([
		listDocuments(directory),
		inspectGit(dataRoot()),
		recentCommits(directory)
	]);
	const records = await loadProjectRecords(project.path, cadenceGit);
	return { project, documents, records, recentCommits: commits };
}
