#!/usr/bin/env node

import { access, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDataRoot } from './validate.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recordDirectories = new Set(['plans', 'decisions', 'meetings', 'notes', 'inbox']);
const cacheStaleAfterDays = 7;
const defaultRecentDays = 14;
// Vendor files loaded instead of AGENTS.md must load the guide, not point at it.
const vendorShimFiles = [{ file: 'CLAUDE.md', loadDirective: '@AGENTS.md' }];

async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function optionalText(path) {
	try {
		return await readFile(path, 'utf8');
	} catch {
		return null;
	}
}

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
		byPath: new Map()
	};
	const source = await optionalText(path);
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
		byPath: new Map((snapshot.projects ?? []).map((project) => [project.path, project]))
	};
}

function shellArgument(value) {
	return /^[A-Za-z0-9_./-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;
}

async function listRecords(projectRecordsRoot, dataRoot) {
	const records = [];
	for (const directoryName of recordDirectories) {
		const root = resolve(projectRecordsRoot, directoryName);
		if (!(await exists(root))) continue;
		const entries = await readdir(root, { recursive: true, withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isFile() || entry.name === 'README.md') continue;
			const absolutePath = resolve(entry.parentPath, entry.name);
			const source = (await optionalText(absolutePath)) ?? '';
			records.push({
				kind: directoryName.replace(/s$/, ''),
				path: relative(dataRoot, absolutePath).split(sep).join('/'),
				date: entry.name.match(/^(\d{4}-\d{2}-\d{2})-/)?.[1] ?? null,
				title: markdownTitle(source, entry.name.replace(/\.md$/, '').replace(/[-_]/g, ' '))
			});
		}
	}
	return records.sort((a, b) => a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path));
}

async function inspectProject(validation, project, now = new Date()) {
	const projectRoot = resolve(validation.workspaceRoot, project.path);
	const recordsRoot = resolve(validation.dataRoot, 'projects', project.path);
	const sourceExists = await exists(projectRoot);
	const statusPath = resolve(recordsRoot, 'STATUS.md');
	const statusText = await optionalText(statusPath);
	const updatedAt = statusDate(statusText);
	const projectAgentGuide = resolve(projectRoot, 'AGENTS.md');
	const agentGuideText = sourceExists ? await optionalText(projectAgentGuide) : null;
	const cadenceDirectory = relative(projectRoot, appRoot).split(sep).join('/') || '.';
	const contextCommand = `pnpm --dir ${shellArgument(cadenceDirectory)} context --cwd .`;
	const pointerPresent = Boolean(
		agentGuideText?.includes('<!-- cadence-context:start -->') &&
		agentGuideText.includes(contextCommand)
	);
	const workspaceGuidePath = resolve(validation.workspaceRoot, 'AGENTS.md');
	const workspaceGuideText = await optionalText(workspaceGuidePath);
	const workspaceGuidePresent = Boolean(
		workspaceGuideText?.includes('## Cadence context') &&
		workspaceGuideText.includes('context --cwd')
	);
	const discoverable = workspaceGuidePresent || pointerPresent;
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
	const project = validation.projects
		.filter(
			(candidate) =>
				fromWorkspace === candidate.path || fromWorkspace.startsWith(`${candidate.path}/`)
		)
		.sort((a, b) => b.path.length - a.path.length)[0];
	if (!project) throw new Error(`No registered Cadence project contains: ${target}`);
	return inspectProject(validation, project, now);
}

async function inspectVendorShims(workspaceRoot) {
	const shims = [];
	for (const { file, loadDirective } of vendorShimFiles) {
		const text = await optionalText(resolve(workspaceRoot, file));
		shims.push({
			file,
			loadDirective,
			state: text === null ? 'absent' : text.includes(loadDirective) ? 'ok' : 'pointer-only'
		});
	}
	return shims;
}

export async function auditProjectContexts({ dataRoot, now } = {}) {
	const validation = await validateDataRoot(dataRoot);
	if (!validation.valid) throw new Error(validation.issues.join('\n'));
	const projects = [];
	for (const project of validation.projects)
		projects.push(await inspectProject(validation, project, now));
	const states = ['ready', 'no-status', 'stale', 'undiscoverable', 'missing-source'];
	return {
		dataRoot: validation.dataRoot,
		workspaceRoot: validation.workspaceRoot,
		vendorShims: await inspectVendorShims(validation.workspaceRoot),
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
		.map((item) => ({
			path: item.project.path,
			name: item.project.name,
			lifecycle: item.project.lifecycle,
			updatedAt: item.statusUpdatedAt,
			stale: item.statusStale,
			...statusHighlights(item.statusText)
		}))
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

function printAudit(audit) {
	console.log('# Cadence agent-context audit\n');
	for (const item of audit.projects) {
		console.log(`${item.state.padEnd(14)} ${item.project.path}`);
	}
	console.log('\nWorkspace vendor shims:');
	for (const shim of audit.vendorShims)
		console.log(
			`- ${shim.file}: ${shim.state}${shim.state === 'pointer-only' ? ` — a shim must load the guide, not point at it; make its content a ${shim.loadDirective} import` : ''}`
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
			console.log(
				`### ${status.path} — ${status.stale ? 'stale' : 'current'} (${status.updatedAt ?? 'undated'})\n`
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
