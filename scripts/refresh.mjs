#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { validateDataRoot } from './validate.mjs';
import { containedDirectory, containedPath, readMarkdown } from './lib/files.mjs';
import { createTypeSafeClient, judgeStatus, statusHash } from './lib/status-judgments.mjs';
import { judgeGuide } from './lib/guide-judgments.mjs';
import { count, errorText } from './lib/commands.mjs';

const execFileAsync = promisify(execFile);
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(['--local-only', '--help']);

if (args.has('--help')) {
	console.log(`Usage: pnpm refresh [--local-only]

Reads local Git state and writes only .workspace-cache/projects.json.
--local-only also skips optional GitHub queries and TypeSafe judgments.
With TYPESAFE_API_KEY set, each STATUS.md is judged by Jev (TypeSafe) and the
answers are cached for pnpm context; without it, judgments are skipped.
Cadence never fetches or changes project repositories.`);
	process.exit(0);
}
const unknown = [...args].filter((argument) => !allowedArgs.has(argument));
if (unknown.length) {
	console.error(`Unknown option: ${unknown.join(', ')}`);
	process.exit(1);
}

async function run(command, commandArgs, timeout = 10_000) {
	try {
		const { stdout } = await execFileAsync(command, commandArgs, {
			encoding: 'utf8',
			timeout,
			maxBuffer: 2 * 1024 * 1024
		});
		return { ok: true, value: stdout.trim() };
	} catch (error) {
		return {
			ok: false,
			error: errorText(error)
		};
	}
}

function githubName(remote) {
	if (!remote) return null;
	const ssh = remote.match(/^git@github\.com:(.+?)(?:\.git)?$/);
	if (ssh) return ssh[1];
	try {
		const url = new URL(remote);
		return url.hostname === 'github.com'
			? url.pathname.replace(/^\//, '').replace(/\.git$/, '')
			: null;
	} catch {
		return null;
	}
}

/** Reuse a previous entry when it was computed from the same text, so an
 *  unchanged file costs no request. */
function reusable(previous, text) {
	return previous?.state === 'updated' && previous.sourceHash === statusHash(text)
		? previous
		: null;
}

let reusedJudgments = 0;
async function judgeText(text, previous, judge) {
	if (text === null) return { state: 'not-applicable', reason: 'File not found.' };
	const reused = reusable(previous, text);
	if (reused) reusedJudgments += 1;
	return reused ?? judge(text);
}

/** Status and guide judgments for one project: skipped without a client or
 *  for archived projects, reused when the source text is unchanged. */
async function judgeProject(validation, project, client, previous) {
	if (!client || project.lifecycle === 'archived')
		return { status: { state: 'skipped' }, guide: { state: 'skipped' } };
	const recordsRoot = await containedDirectory(
		validation.dataRoot,
		resolve(validation.dataRoot, 'projects', project.path)
	);
	const sourceRoot = await containedDirectory(
		validation.workspaceRoot,
		resolve(validation.workspaceRoot, project.path)
	);
	const [statusText, guideText] = await Promise.all([
		recordsRoot ? readMarkdown(recordsRoot, resolve(recordsRoot, 'STATUS.md')) : null,
		sourceRoot ? readMarkdown(sourceRoot, resolve(sourceRoot, 'AGENTS.md')) : null
	]);
	const [status, guide] = await Promise.all([
		judgeText(statusText, previous?.status, (text) => judgeStatus(text, client)),
		judgeText(guideText, previous?.guide, (text) => judgeGuide(text, client))
	]);
	return { status, guide };
}

/** The workspace guide and its vendor shim, judged once per refresh. */
async function judgeWorkspaceGuides(validation, client, previous) {
	if (!client) return { guide: { state: 'skipped' }, shims: {} };
	const root = validation.workspaceRoot;
	const guideText = await readMarkdown(root, resolve(root, 'AGENTS.md'));
	const shimText = await readMarkdown(root, resolve(root, 'CLAUDE.md'));
	const [guide, shim] = await Promise.all([
		judgeText(guideText, previous?.guide, (text) => judgeGuide(text, client)),
		judgeText(shimText, previous?.shims?.['CLAUDE.md'], (text) =>
			judgeGuide(text, client, { kind: 'shim' })
		)
	]);
	return { guide, shims: { 'CLAUDE.md': shim } };
}

async function readPreviousCache(path) {
	try {
		const previous = JSON.parse(await readFile(path, 'utf8'));
		if (previous?.schemaVersion !== 1) return null;
		return {
			byPath: new Map(
				(previous.projects ?? []).map((project) => [project.path, project.judgments])
			),
			workspace: previous.workspace ?? null
		};
	} catch {
		return null;
	}
}

async function inspectProject(workspaceRoot, project, localOnly) {
	const directory = await containedPath(workspaceRoot, resolve(workspaceRoot, project.path), {
		allowMissing: true
	});
	if (!directory) throw new Error(`Unsafe project source path: ${project.path}`);
	const [branch, status, log, remote, divergence] = await Promise.all([
		run('git', ['-C', directory, 'branch', '--show-current']),
		run('git', ['-C', directory, 'status', '--porcelain=v1']),
		run('git', ['-C', directory, 'log', '-1', '--format=%cI%x00%h%x00%s']),
		run('git', ['-C', directory, 'remote', 'get-url', 'origin']),
		run('git', ['-C', directory, 'rev-list', '--left-right', '--count', '@{upstream}...HEAD'])
	]);
	const repository = branch.ok || status.ok || log.ok;
	const remoteUrl = remote.ok ? remote.value : null;
	const nameWithOwner = githubName(remoteUrl);
	// Archived projects keep their remotes as history only; never query them.
	const queryGithub = !localOnly && nameWithOwner && project.lifecycle !== 'archived';
	let github = { state: queryGithub ? 'unavailable' : 'skipped' };
	if (queryGithub) {
		const response = await run(
			'gh',
			['repo', 'view', nameWithOwner, '--json', 'isPrivate,issues,pullRequests,latestRelease'],
			30_000
		);
		if (response.ok) {
			try {
				github = { state: 'updated', ...JSON.parse(response.value) };
			} catch {
				github = { state: 'failed', error: 'GitHub returned unreadable JSON.' };
			}
		} else github = { state: 'failed', error: response.error };
	}
	// "<behind> <ahead>" from --left-right; anything unparseable is unknown, not zero.
	const [behind = null, ahead = null] = divergence.ok
		? divergence.value.trim().split(/\s+/).map(count)
		: [];
	const [lastCommitAt = null, lastCommitHash = null, lastCommitSubject = null] = log.ok
		? log.value.split('\0')
		: [];
	return {
		...project,
		exists: repository,
		git: repository
			? {
					branch: branch.ok ? branch.value || null : null,
					dirtyFiles: status.ok ? (status.value ? status.value.split('\n').length : 0) : null,
					lastCommitAt,
					lastCommitHash,
					lastCommitSubject,
					remoteUrl,
					ahead,
					behind
				}
			: null,
		github
	};
}

const validation = await validateDataRoot();
if (!validation.valid) {
	for (const issue of validation.issues) console.error(`- ${issue}`);
	process.exit(1);
}

const localOnly = args.has('--local-only');
const apiKey = process.env.TYPESAFE_API_KEY;
const client =
	!localOnly && apiKey
		? createTypeSafeClient({ apiKey, model: process.env.TYPESAFE_MODEL || undefined })
		: null;
const cacheDirectory = resolve(
	process.env.CADENCE_CACHE_ROOT ?? resolve(appRoot, '.workspace-cache')
);
const cachePath = resolve(cacheDirectory, 'projects.json');
const previous = client ? await readPreviousCache(cachePath) : null;
const projects = [];
for (const project of validation.projects) {
	const [inspected, judgments] = await Promise.all([
		inspectProject(validation.workspaceRoot, project, localOnly),
		judgeProject(validation, project, client, previous?.byPath.get(project.path))
	]);
	projects.push({ ...inspected, judgments });
}
const workspace = await judgeWorkspaceGuides(validation, client, previous?.workspace);
const entries = [
	...projects.flatMap((project) => [project.judgments.status, project.judgments.guide]),
	workspace.guide,
	...Object.values(workspace.shims)
];
const judged = entries.filter((entry) => entry.state === 'updated');
const judgmentFailures = projects.filter(
	(project) =>
		project.judgments.status.state === 'failed' || project.judgments.guide.state === 'failed'
);
const snapshot = {
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	workspaceRoot: validation.workspaceRoot,
	mode: localOnly ? 'local-only' : 'local-and-github',
	summary: {
		total: projects.length,
		repositories: projects.filter((project) => project.git).length,
		dirty: projects.filter((project) => project.git?.dirtyFiles > 0).length,
		githubFailures: projects.filter((project) => project.github.state === 'failed').length,
		judged: projects.filter((project) => project.judgments.status.state === 'updated').length,
		judgmentFailures: judgmentFailures.length
	},
	workspace,
	projects
};

await mkdir(cacheDirectory, { recursive: true });
const temporaryPath = `${cachePath}.${process.pid}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`);
await rename(temporaryPath, cachePath);
console.log(
	`Refreshed ${projects.length} projects without changing monitored repositories; cache: ${relative(appRoot, cachePath) || '.'}.`
);
if (client) {
	const tokens = judged.reduce(
		(sum, entry) => sum + (entry.usage?.inputTokens ?? 0) + (entry.usage?.outputTokens ?? 0),
		0
	);
	const latency = judged.reduce((sum, entry) => sum + (entry.latencyMs ?? 0), 0);
	const statuses = projects.filter((project) => project.judgments.status.state === 'updated');
	const guides = projects.filter((project) => project.judgments.guide.state === 'updated');
	console.log(
		`Judged ${statuses.length} statuses and ${guides.length} project guides plus the workspace guide with ${client.model} (${reusedJudgments} reused from the previous cache; ${tokens} tokens, ${latency} ms across all cached judgments)${judgmentFailures.length ? `; ${judgmentFailures.length} failed` : ''}.`
	);
	for (const project of judgmentFailures)
		console.error(
			`- ${project.path}: ${project.judgments.status.error ?? project.judgments.guide.error}`
		);
} else if (!localOnly) console.log('TypeSafe judgments skipped: set TYPESAFE_API_KEY to enable.');
