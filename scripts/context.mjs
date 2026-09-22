#!/usr/bin/env node

import { realpath } from 'node:fs/promises';
import {
	containedDirectory,
	findFiles,
	isWithin,
	readBoundedText,
	readMarkdown
} from './lib/files.mjs';
import { cachedStatusJudgment, rankBullets } from './lib/status-judgments.mjs';
import { cachedGuideJudgment } from './lib/guide-judgments.mjs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDataRoot } from './validate.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recordDirectories = new Set(['plans', 'decisions', 'meetings', 'notes', 'inbox']);
const cacheStaleAfterDays = 7;
const defaultRecentDays = 14;
// Vendor files loaded instead of AGENTS.md must load the guide, not point at it.
/** A Noul this high means the status declares the project parked or in maintenance mode. */
const parkedThreshold = 0.7;
/** A Noul this high means a guide is judged to instruct agents to run the context command. */
const instructsThreshold = 0.7;
const vendorShimFiles = [{ file: 'CLAUDE.md', loadDirective: '@AGENTS.md' }];

function markdownTitle(source, fallback) {
	return source.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback;
}

function statusDate(source) {
	const value = source?.match(/^Updated:\s*(\d{4}-\d{2}-\d{2})$/m)?.[1];
	return value ?? null;
}

function staleStatus(updatedAt, now = new Date(), staleAfterDays = 30) {
	if (!updatedAt) return true;
	const updated = new Date(`${updatedAt}T00:00:00Z`);
	return (
		!Number.isFinite(updated.getTime()) ||
		now.getTime() - updated.getTime() > staleAfterDays * 86_400_000
	);
}

function statusHighlights(statusText) {
	const sections = { current: [], next: [], risks: [] };
	if (!statusText) return sections;
	let section = null;
	for (const line of statusText.split('\n')) {
		const heading = line
			.match(/^##\s+(.+)$/)?.[1]
			?.trim()
			.toLowerCase();
		if (heading !== undefined) {
			section = heading in sections ? heading : null;
			continue;
		}
		const bullet = line.match(/^-\s+(.+)$/)?.[1];
		if (section && bullet) sections[section].push(bullet.trim());
	}
	return sections;
}

/** Cached Jev judgments replace the exact-name convention when they were
 * computed from this exact STATUS.md text; otherwise the regex path is used. */
function judgedHighlights(judgment) {
	const texts = (bullets) => rankBullets(bullets).map((bullet) => bullet.text);
	return {
		current: texts(judgment.sections.current),
		next: texts(judgment.sections.next),
		risks: texts(judgment.sections.risks)
	};
}

async function readRefreshCache(now = new Date()) {
	const cacheRoot = resolve(process.env.CADENCE_CACHE_ROOT ?? resolve(appRoot, '.workspace-cache'));
	const path = resolve(cacheRoot, 'projects.json');
	const absent = {
		present: false,
		path,
		generatedAt: null,
		ageDays: null,
		stale: true,
		mode: null,
		summary: null,
		workspace: null,
		byPath: new Map()
	};
	const contents = await readBoundedText(cacheRoot, path, 8 * 1024 * 1024);
	const source = contents && !contents.truncated ? contents.text : null;
	if (!source) return absent;
	let snapshot;
	try {
		snapshot = JSON.parse(source);
	} catch {
		return absent;
	}
	const generated = new Date(snapshot.generatedAt ?? NaN);
	const ageDays = Number.isFinite(generated.getTime())
		? Math.floor((now.getTime() - generated.getTime()) / 86_400_000)
		: null;
	return {
		present: true,
		path,
		generatedAt: snapshot.generatedAt ?? null,
		ageDays,
		stale: ageDays === null || ageDays >= cacheStaleAfterDays,
		mode: snapshot.mode ?? null,
		summary: snapshot.summary ?? null,
		workspace: snapshot.workspace ?? null,
		byPath: new Map((snapshot.projects ?? []).map((project) => [project.path, project]))
	};
}

function shellArgument(value) {
	return /^[A-Za-z0-9_./-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;
}

async function listRecords(projectRecordsRoot, dataRoot) {
	const canonical = await containedDirectory(dataRoot, projectRecordsRoot);
	if (!canonical) return [];
	const paths = await findFiles(canonical, canonical, {
		accept: (path) =>
			recordDirectories.has(path.split(sep)[0]) &&
			path.endsWith('.md') &&
			path.split(sep).at(-1) !== 'README.md'
	});
	const records = [];
	for (const path of paths) {
		const source = await readMarkdown(canonical, resolve(canonical, path));
		if (source === null) continue;
		const name = path.split(sep).at(-1);
		records.push({
			kind: path.split(sep)[0].replace(/s$/, ''),
			path: relative(dataRoot, resolve(projectRecordsRoot, path)).split(sep).join('/'),
			date: name.match(/^(\d{4}-\d{2}-\d{2})-/)?.[1] ?? null,
			title: markdownTitle(source, name.replace(/\.md$/, '').replace(/[-_]/g, ' '))
		});
	}
	return records.sort((a, b) => a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path));
}

/** @param {number | null} probability */
function judgedInstructs(probability) {
	return probability !== null && probability >= instructsThreshold;
}

async function inspectProject(validation, project, now = new Date(), cache = null) {
	const projectRoot = resolve(validation.workspaceRoot, project.path);
	const recordsRoot = resolve(validation.dataRoot, 'projects', project.path);
	const sourceRoot = await containedDirectory(validation.workspaceRoot, projectRoot);
	const sourceExists = sourceRoot !== null;
	const safeRecordsRoot = await containedDirectory(validation.dataRoot, recordsRoot);
	const statusPath = resolve(recordsRoot, 'STATUS.md');
	const statusText = safeRecordsRoot
		? await readMarkdown(safeRecordsRoot, resolve(safeRecordsRoot, 'STATUS.md'))
		: null;
	const updatedAt = statusDate(statusText);
	const projectAgentGuide = resolve(projectRoot, 'AGENTS.md');
	const agentGuideText = sourceRoot
		? await readMarkdown(sourceRoot, resolve(sourceRoot, 'AGENTS.md'))
		: null;
	const cadenceDirectory = relative(projectRoot, appRoot).split(sep).join('/') || '.';
	const contextCommand = `pnpm --dir ${shellArgument(cadenceDirectory)} context --cwd .`;
	const pointerPresent = Boolean(
		agentGuideText?.includes('<!-- cadence-context:start -->') &&
		agentGuideText.includes(contextCommand)
	);
	const workspaceGuidePath = resolve(validation.workspaceRoot, 'AGENTS.md');
	const workspaceGuideText = await readMarkdown(validation.workspaceRoot, workspaceGuidePath);
	const workspaceGuidePresent = Boolean(
		workspaceGuideText?.includes('## Cadence context') &&
		workspaceGuideText.includes('context --cwd')
	);
	// Cached Jev readings of the guides, valid only for the exact current text.
	const pointerJudgment = cachedGuideJudgment(
		cache?.byPath.get(project.path)?.judgments?.guide,
		agentGuideText
	);
	const workspaceGuideJudgment = cachedGuideJudgment(cache?.workspace?.guide, workspaceGuideText);
	const pointerJudged = judgedInstructs(pointerJudgment);
	const workspaceGuideJudged = judgedInstructs(workspaceGuideJudgment);
	const discovery = pointerPresent
		? 'pointer'
		: workspaceGuidePresent
			? 'workspace-guide'
			: pointerJudged
				? 'judged-pointer'
				: workspaceGuideJudged
					? 'judged-workspace-guide'
					: 'none';
	const discoverable = discovery !== 'none';
	const statusPresent = statusText !== null;
	const statusStale = statusPresent && staleStatus(updatedAt, now);
	const state = !sourceExists
		? 'missing-source'
		: !discoverable
			? 'undiscoverable'
			: !statusPresent
				? 'no-status'
				: statusStale
					? 'stale'
					: 'ready';

	return {
		project,
		projectRoot,
		recordsRoot,
		sourceExists,
		workspaceGuidePresent,
		workspaceGuidePath,
		pointerPresent,
		pointerJudgment,
		pointerJudged,
		workspaceGuideJudgment,
		workspaceGuideJudged,
		discovery,
		projectAgentGuide,
		contextCommand,
		discoverable,
		statusPresent,
		statusPath,
		statusText,
		statusUpdatedAt: updatedAt,
		statusStale,
		state,
		records: await listRecords(recordsRoot, validation.dataRoot)
	};
}

export async function resolveProjectContext({ cwd = process.cwd(), dataRoot, now } = {}) {
	const validation = await validateDataRoot(dataRoot);
	if (!validation.valid) throw new Error(validation.issues.join('\n'));
	const [target, workspaceRoot] = await Promise.all([
		realpath(resolve(cwd)),
		realpath(validation.workspaceRoot)
	]);
	const fromWorkspace = relative(workspaceRoot, target).split(sep).join('/');
	if (fromWorkspace === '..' || fromWorkspace.startsWith('../')) {
		throw new Error(`Working directory is outside the configured workspace: ${target}`);
	}
	const candidates = await Promise.all(
		validation.projects.map(async (project) => ({
			project,
			path: await containedDirectory(
				validation.workspaceRoot,
				resolve(validation.workspaceRoot, project.path)
			)
		}))
	);
	const project = candidates
		.filter((candidate) => candidate.path && isWithin(candidate.path, target))
		.sort((a, b) => b.path.length - a.path.length)[0]?.project;
	if (!project) throw new Error(`No registered Cadence project contains: ${target}`);
	return inspectProject(validation, project, now);
}

async function inspectVendorShims(workspaceRoot, cache = null) {
	const shims = [];
	for (const { file, loadDirective } of vendorShimFiles) {
		const text = await readMarkdown(workspaceRoot, resolve(workspaceRoot, file));
		const judgment = cachedGuideJudgment(cache?.workspace?.shims?.[file], text);
		shims.push({
			file,
			loadDirective,
			state: text === null ? 'absent' : text.includes(loadDirective) ? 'ok' : 'pointer-only',
			judgment,
			judgedLoads: judgedInstructs(judgment)
		});
	}
	return shims;
}

export async function auditProjectContexts({ dataRoot, now = new Date() } = {}) {
	const validation = await validateDataRoot(dataRoot);
	if (!validation.valid) throw new Error(validation.issues.join('\n'));
	const cache = await readRefreshCache(now);
	const projects = [];
	for (const project of validation.projects)
		projects.push(await inspectProject(validation, project, now, cache));
	const states = ['ready', 'no-status', 'stale', 'undiscoverable', 'missing-source'];
	return {
		dataRoot: validation.dataRoot,
		workspaceRoot: validation.workspaceRoot,
		vendorShims: await inspectVendorShims(validation.workspaceRoot, cache),
		projects,
		summary: Object.fromEntries(
			states.map((state) => [state, projects.filter((item) => item.state === state).length])
		)
	};
}

export async function workspaceOverview({
	dataRoot,
	now = new Date(),
	recentDays = defaultRecentDays
} = {}) {
	const audit = await auditProjectContexts({ dataRoot, now });
	const cache = await readRefreshCache(now);
	const byRecency = (a, b) => {
		if (a.updatedAt && b.updatedAt && a.updatedAt !== b.updatedAt)
			return b.updatedAt.localeCompare(a.updatedAt);
		if (Boolean(a.updatedAt) !== Boolean(b.updatedAt)) return a.updatedAt ? -1 : 1;
		return a.path.localeCompare(b.path);
	};
	const statuses = audit.projects
		.filter((item) => item.statusPresent)
		.map((item) => {
			const judgment = cachedStatusJudgment(
				cache.byPath.get(item.project.path)?.judgments?.status,
				item.statusText
			);
			const updatedAt = item.statusUpdatedAt ?? judgment?.updatedAt?.value ?? null;
			return {
				path: item.project.path,
				name: item.project.name,
				lifecycle: item.project.lifecycle,
				updatedAt,
				stale: item.statusUpdatedAt ? item.statusStale : staleStatus(updatedAt, now),
				judged: judgment !== null,
				parked: judgment?.parked ?? null,
				...(judgment ? judgedHighlights(judgment) : statusHighlights(item.statusText))
			};
		})
		.sort(byRecency);
	const missingStatus = audit.projects
		.filter((item) => !item.statusPresent)
		.map((item) => ({ path: item.project.path, state: item.state }))
		.sort((a, b) => a.path.localeCompare(b.path));
	const windowStart = now.getTime() - recentDays * 86_400_000;
	const inWindow = (date) => {
		const dated = new Date(`${date}T00:00:00Z`);
		return Number.isFinite(dated.getTime()) && dated.getTime() >= windowStart;
	};
	const recentRecords = audit.projects
		.flatMap((item) =>
			item.records.map((record) => ({ projectPath: item.project.path, ...record }))
		)
		.filter((record) => record.date && inWindow(record.date))
		.sort(
			(a, b) =>
				b.date.localeCompare(a.date) ||
				a.projectPath.localeCompare(b.projectPath) ||
				a.path.localeCompare(b.path)
		);
	let activity = null;
	if (cache.present) {
		const snapshots = audit.projects
			.map((item) => cache.byPath.get(item.project.path))
			.filter((snapshot) => snapshot);
		activity = {
			dirty: snapshots
				.filter((snapshot) => snapshot.git?.dirtyFiles > 0)
				.map((snapshot) => ({
					path: snapshot.path,
					branch: snapshot.git.branch,
					dirtyFiles: snapshot.git.dirtyFiles
				}))
				.sort((a, b) => b.dirtyFiles - a.dirtyFiles || a.path.localeCompare(b.path)),
			diverged: snapshots
				.filter((snapshot) => snapshot.git?.ahead > 0 || snapshot.git?.behind > 0)
				.map((snapshot) => ({
					path: snapshot.path,
					branch: snapshot.git.branch,
					ahead: snapshot.git.ahead,
					behind: snapshot.git.behind
				}))
				.sort((a, b) => a.path.localeCompare(b.path)),
			recentCommits: snapshots
				.filter(
					(snapshot) =>
						snapshot.git?.lastCommitAt && inWindow(snapshot.git.lastCommitAt.slice(0, 10))
				)
				.map((snapshot) => ({
					path: snapshot.path,
					lastCommitAt: snapshot.git.lastCommitAt,
					hash: snapshot.git.lastCommitHash,
					subject: snapshot.git.lastCommitSubject
				}))
				.sort(
					(a, b) => b.lastCommitAt.localeCompare(a.lastCommitAt) || a.path.localeCompare(b.path)
				),
			openPullRequests: snapshots
				.filter((snapshot) => snapshot.github?.pullRequests?.totalCount > 0)
				.map((snapshot) => ({
					path: snapshot.path,
					count: snapshot.github.pullRequests.totalCount
				}))
				.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)),
			openIssues: snapshots
				.filter((snapshot) => snapshot.github?.issues?.totalCount > 0)
				.map((snapshot) => ({ path: snapshot.path, count: snapshot.github.issues.totalCount }))
				.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)),
			latestReleases: snapshots
				.filter((snapshot) => snapshot.github?.latestRelease)
				.map((snapshot) => ({
					path: snapshot.path,
					tag: snapshot.github.latestRelease.tagName ?? snapshot.github.latestRelease.name ?? null,
					publishedAt: snapshot.github.latestRelease.publishedAt ?? null
				}))
				.sort((a, b) => a.path.localeCompare(b.path))
		};
	}
	return {
		dataRoot: audit.dataRoot,
		workspaceRoot: audit.workspaceRoot,
		recentDays,
		summary: audit.summary,
		statuses,
		missingStatus,
		recentRecords,
		cache: {
			present: cache.present,
			path: cache.path,
			generatedAt: cache.generatedAt,
			ageDays: cache.ageDays,
			stale: cache.stale,
			mode: cache.mode,
			summary: cache.summary
		},
		activity
	};
}

export function contextSnippet(context) {
	return `<!-- cadence-context:start -->
## Cadence context

Before planning or making substantial changes, load this project's workspace context:

\`\`\`bash
${context.contextCommand}
\`\`\`

Read the reported status and relevant plans and decisions. GitHub Issues remain the source of actionable work.

When asked to remember something about this project, record it in its Cadence workspace records (\`STATUS.md\`, \`notes/\`, \`decisions/\`), not in vendor-specific agent memory.
<!-- cadence-context:end -->`;
}

function printContext(context) {
	console.log(`# Cadence context: ${context.project.name}\n`);
	console.log(`- Project: \`${context.project.path}\``);
	console.log(`- Lifecycle: ${context.project.lifecycle}`);
	console.log(
		`- Agent discovery: ${context.pointerPresent ? 'project pointer' : context.workspaceGuidePresent ? 'workspace guide' : 'not configured'}`
	);
	console.log(
		`- Status: ${context.statusPresent ? (context.statusStale ? `stale (${context.statusUpdatedAt ?? 'undated'})` : `current (${context.statusUpdatedAt})`) : 'missing'}`
	);
	console.log(`- Records: ${context.records.length}\n`);
	if (context.statusText) console.log(`${context.statusText.trim()}\n`);
	if (context.records.length) {
		console.log('## Related records\n');
		for (const record of context.records)
			console.log(`- ${record.kind}: [${record.title}](${record.path})`);
		console.log('');
	}
	console.log(
		'Record things to remember about this project in its workspace records (STATUS.md, notes/, decisions/), not in vendor-specific agent memory.'
	);
}

const discoveryLabels = {
	pointer: 'project pointer',
	'workspace-guide': 'workspace guide',
	'judged-pointer': 'project guide (judged)',
	'judged-workspace-guide': 'workspace guide (judged)',
	none: 'not configured'
};

function printAudit(audit) {
	console.log('# Cadence agent-context audit\n');
	for (const item of audit.projects) {
		console.log(
			`${item.state.padEnd(14)} ${item.project.path.padEnd(36)} ${discoveryLabels[item.discovery]}`
		);
	}
	const judged = audit.projects.filter(
		(item) => item.pointerJudgment !== null || item.workspaceGuideJudgment !== null
	);
	if (judged.length) {
		console.log('\nJudged guide readings (Jev, cached by pnpm refresh):');
		const sample = judged[0];
		if (sample.workspaceGuideJudgment !== null)
			console.log(
				`- Workspace guide instructs agents to run the context command: ${sample.workspaceGuideJudgment.toFixed(2)}${sample.workspaceGuidePresent === sample.workspaceGuideJudged ? '' : ' — disagrees with the literal check'}`
			);
		// Guides that never mention Cadence are judged 0 without a request; only
		// real readings and disagreements are worth a line.
		for (const item of judged.filter(
			(item) =>
				item.pointerJudgment !== null &&
				(item.pointerJudgment > 0 || item.pointerPresent !== item.pointerJudged)
		))
			console.log(
				`- ${item.project.path}: project guide ${item.pointerJudgment.toFixed(2)}${item.pointerPresent === item.pointerJudged ? '' : ' — disagrees with the literal pointer check'}`
			);
	}
	console.log('\nWorkspace vendor shims:');
	for (const shim of audit.vendorShims)
		console.log(
			`- ${shim.file}: ${shim.state}${shim.judgment !== null ? ` (judged loads the guide: ${shim.judgment.toFixed(2)})` : ''}${shim.state === 'pointer-only' ? ` — a shim must load the guide, not point at it; make its content a ${shim.loadDirective} import` : ''}`
		);
	console.log('\nSummary:');
	for (const [state, count] of Object.entries(audit.summary)) console.log(`- ${state}: ${count}`);
}

function printHighlightGroup(label, bullets, cap = 3) {
	if (!bullets.length) return;
	console.log(`${label}:`);
	for (const bullet of bullets.slice(0, cap)) console.log(`- ${bullet}`);
	if (bullets.length > cap) console.log(`- … ${bullets.length - cap} more (use --json)`);
}

function printOverview(overview) {
	const total = overview.statuses.length + overview.missingStatus.length;
	const counts = Object.entries(overview.summary)
		.filter(([, count]) => count > 0)
		.map(([state, count]) => `${state} ${count}`)
		.join(', ');
	console.log('# Cadence workspace overview\n');
	console.log(`- Projects: ${total} (${counts})`);
	const judged = overview.statuses.filter((status) => status.judged).length;
	if (judged)
		console.log(
			`- Judgments: ${judged} of ${overview.statuses.length} statuses use cached Jev (TypeSafe) section and ranking judgments`
		);
	if (overview.cache.present) {
		const age = `${overview.cache.ageDays} day${overview.cache.ageDays === 1 ? '' : 's'} old`;
		const staleHint = overview.cache.stale ? '; old — run `pnpm refresh`' : '';
		console.log(
			`- Refresh cache: generated ${overview.cache.generatedAt} (${age}${staleHint}), mode ${overview.cache.mode}`
		);
	} else {
		console.log(
			'- Refresh cache: missing — run `pnpm refresh` (or `pnpm refresh --local-only`) for repository activity'
		);
	}
	console.log('');
	if (overview.statuses.length) {
		console.log('## Statuses by recency\n');
		for (const status of overview.statuses) {
			const markers = [];
			if (status.judged) markers.push('judged');
			if (status.parked !== null && status.parked >= parkedThreshold)
				markers.push(`looks parked (${status.parked.toFixed(2)})`);
			console.log(
				`### ${status.path} — ${status.stale ? 'stale' : 'current'} (${status.updatedAt ?? 'undated'})${markers.length ? ` · ${markers.join(' · ')}` : ''}\n`
			);
			printHighlightGroup('Current', status.current);
			printHighlightGroup('Next', status.next);
			printHighlightGroup('Risks', status.risks);
			console.log('');
		}
	}
	if (overview.missingStatus.length) {
		console.log('## Without status\n');
		const byState = new Map();
		for (const item of overview.missingStatus) {
			if (!byState.has(item.state)) byState.set(item.state, []);
			byState.get(item.state).push(item.path);
		}
		for (const [state, paths] of byState) console.log(`- ${state}: ${paths.join(', ')}`);
		console.log('');
	}
	if (overview.recentRecords.length) {
		console.log(`## Recent records (last ${overview.recentDays} days)\n`);
		for (const record of overview.recentRecords)
			console.log(`- ${record.date} ${record.kind} ${record.projectPath} — ${record.title}`);
		console.log('');
	}
	if (overview.activity) {
		console.log('## Repository activity (refresh cache)\n');
		if (overview.activity.dirty.length) {
			console.log('Dirty working trees:');
			for (const item of overview.activity.dirty)
				console.log(
					`- ${item.path} (${item.dirtyFiles} file${item.dirtyFiles === 1 ? '' : 's'}, branch ${item.branch ?? 'detached'})`
				);
		}
		if (overview.activity.diverged.length) {
			console.log('Ahead/behind upstream:');
			for (const item of overview.activity.diverged)
				console.log(`- ${item.path} (ahead ${item.ahead ?? 0}, behind ${item.behind ?? 0})`);
		}
		if (overview.activity.recentCommits.length) {
			console.log(`Commits in the last ${overview.recentDays} days:`);
			for (const item of overview.activity.recentCommits)
				console.log(
					`- ${item.lastCommitAt.slice(0, 10)} ${item.path} — ${item.subject} (${item.hash})`
				);
		}
		if (overview.activity.openPullRequests.length)
			console.log(
				`Open pull requests: ${overview.activity.openPullRequests.map((item) => `${item.path} (${item.count})`).join(', ')}`
			);
		if (overview.activity.openIssues.length)
			console.log(
				`Open issues: ${overview.activity.openIssues.map((item) => `${item.path} (${item.count})`).join(', ')}`
			);
		console.log('');
	}
	console.log('GitHub Issues remain the source of actionable work.');
}

function usage() {
	console.log(`Usage: pnpm context [--cwd <path>] [--json] [--snippet]
       pnpm context --audit [--json]
       pnpm context --overview [--json] [--days <n>]

Resolves the current directory to its visible Cadence project records. The command is read-only.
--snippet prints a reviewable AGENTS.md section; it never applies the patch.
--overview aggregates every project's status by recency, recent records, and repository
activity from the refresh cache when present.`);
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	const args = process.argv.slice(2);
	if (args.includes('--help')) {
		usage();
		process.exit(0);
	}
	const allowed = new Set(['--audit', '--json', '--snippet', '--cwd', '--overview', '--days']);
	const valued = new Set(['--cwd', '--days']);
	const unknown = args.filter((argument, index) => {
		if (index > 0 && valued.has(args[index - 1])) return false;
		return argument.startsWith('--') && !allowed.has(argument);
	});
	if (unknown.length) throw new Error(`Unknown option: ${unknown.join(', ')}`);
	const cwdIndex = args.indexOf('--cwd');
	const cwd = cwdIndex >= 0 ? args[cwdIndex + 1] : process.cwd();
	if (cwdIndex >= 0 && !cwd) throw new Error('--cwd requires a path.');
	const daysIndex = args.indexOf('--days');
	const recentDays = daysIndex >= 0 ? Number(args[daysIndex + 1]) : defaultRecentDays;
	if (daysIndex >= 0 && (!Number.isInteger(recentDays) || recentDays <= 0))
		throw new Error('--days requires a positive integer.');
	if (args.includes('--overview')) {
		if (cwdIndex >= 0) throw new Error('--overview is workspace-wide; drop --cwd.');
		const overview = await workspaceOverview({ recentDays });
		if (args.includes('--json')) console.log(JSON.stringify(overview, null, 2));
		else printOverview(overview);
	} else if (args.includes('--audit')) {
		const audit = await auditProjectContexts();
		if (args.includes('--json')) console.log(JSON.stringify(audit, null, 2));
		else printAudit(audit);
	} else {
		const context = await resolveProjectContext({ cwd });
		if (args.includes('--json')) console.log(JSON.stringify(context, null, 2));
		else if (args.includes('--snippet')) console.log(contextSnippet(context));
		else printContext(context);
	}
}
