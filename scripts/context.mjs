#!/usr/bin/env node

import { access, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDataRoot } from './validate.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recordDirectories = new Set(['plans', 'decisions', 'meetings', 'notes', 'inbox']);

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
		projects,
		summary: Object.fromEntries(
			states.map((state) => [state, projects.filter((item) => item.state === state).length])
		)
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
}

function printAudit(audit) {
	console.log('# Cadence agent-context audit\n');
	for (const item of audit.projects) {
		console.log(`${item.state.padEnd(14)} ${item.project.path}`);
	}
	console.log('\nSummary:');
	for (const [state, count] of Object.entries(audit.summary)) console.log(`- ${state}: ${count}`);
}

function usage() {
	console.log(`Usage: pnpm context [--cwd <path>] [--json] [--snippet]
       pnpm context --audit [--json]

Resolves the current directory to its visible Cadence project records. The command is read-only.
--snippet prints a reviewable AGENTS.md section; it never applies the patch.`);
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	const args = process.argv.slice(2);
	if (args.includes('--help')) {
		usage();
		process.exit(0);
	}
	const allowed = new Set(['--audit', '--json', '--snippet', '--cwd']);
	const unknown = args.filter((argument, index) => {
		if (index > 0 && args[index - 1] === '--cwd') return false;
		return argument.startsWith('--') && !allowed.has(argument);
	});
	if (unknown.length) throw new Error(`Unknown option: ${unknown.join(', ')}`);
	const cwdIndex = args.indexOf('--cwd');
	const cwd = cwdIndex >= 0 ? args[cwdIndex + 1] : process.cwd();
	if (cwdIndex >= 0 && !cwd) throw new Error('--cwd requires a path.');
	if (args.includes('--audit')) {
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
