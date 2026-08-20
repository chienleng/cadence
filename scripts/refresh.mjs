#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { validateDataRoot } from './validate.mjs';

const execFileAsync = promisify(execFile);
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(['--local-only', '--help']);

if (args.has('--help')) {
	console.log(`Usage: pnpm refresh [--local-only]

Reads local Git state and writes only .workspace-cache/projects.json.
--local-only also skips optional GitHub queries. Cadence never fetches or changes project repositories.`);
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
			error: error instanceof Error ? error.message.split('\n').at(-1) : String(error)
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

async function inspectProject(workspaceRoot, project, localOnly) {
	const directory = resolve(workspaceRoot, project.path);
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
	let github = { state: localOnly || !nameWithOwner ? 'skipped' : 'unavailable' };
	if (!localOnly && nameWithOwner) {
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
	const [behind = null, ahead = null] = divergence.ok
		? divergence.value.split(/\s+/).map(Number)
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
					dirtyFiles: status.ok && status.value ? status.value.split('\n').length : 0,
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

const projects = [];
for (const project of validation.projects) {
	projects.push(await inspectProject(validation.workspaceRoot, project, args.has('--local-only')));
}
const snapshot = {
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	workspaceRoot: validation.workspaceRoot,
	mode: args.has('--local-only') ? 'local-only' : 'local-and-github',
	summary: {
		total: projects.length,
		repositories: projects.filter((project) => project.git).length,
		dirty: projects.filter((project) => project.git?.dirtyFiles > 0).length,
		githubFailures: projects.filter((project) => project.github.state === 'failed').length
	},
	projects
};

const cacheDirectory = resolve(
	process.env.CADENCE_CACHE_ROOT ?? resolve(appRoot, '.workspace-cache')
);
const cachePath = resolve(cacheDirectory, 'projects.json');
await mkdir(cacheDirectory, { recursive: true });
const temporaryPath = `${cachePath}.${process.pid}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`);
await rename(temporaryPath, cachePath);
console.log(
	`Refreshed ${projects.length} projects without changing monitored repositories; cache: ${relative(appRoot, cachePath) || '.'}.`
);
