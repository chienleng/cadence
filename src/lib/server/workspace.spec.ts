import { execFile } from 'node:child_process';
import { access, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	getProjectDetail,
	loadProjectDefinitions,
	loadWorkspace,
	scanWorkspace
} from './local-workspace';

const execFileAsync = promisify(execFile);
let fixtureRoot: string;
let dataRoot: string;
let workspaceRoot: string;
const originalDataRoot = process.env.CADENCE_DATA_ROOT;
const originalCacheRoot = process.env.CADENCE_CACHE_ROOT;

async function write(path: string, content: string): Promise<void> {
	await mkdir(resolve(path, '..'), { recursive: true });
	await writeFile(path, content);
}

function projectJson(path = 'apps/harbour'): string {
	return JSON.stringify({
		schemaVersion: 1,
		path,
		name: 'Harbour',
		group: 'Products',
		summary: 'A fixture project.',
		lifecycle: 'active'
	});
}

beforeEach(async () => {
	fixtureRoot = await mkdtemp(resolve(tmpdir(), 'cadence-workspace-test-'));
	dataRoot = resolve(fixtureRoot, 'data');
	workspaceRoot = resolve(fixtureRoot, 'workspace');
	process.env.CADENCE_DATA_ROOT = dataRoot;
	// Keep the developer's real refresh cache out of test snapshots.
	process.env.CADENCE_CACHE_ROOT = resolve(fixtureRoot, 'no-cache');
	await write(
		resolve(dataRoot, 'cadence.config.json'),
		JSON.stringify({ schemaVersion: 1, name: 'Test workspace', workspaceRoot: '../workspace' })
	);
	await write(resolve(dataRoot, 'projects/apps/harbour/project.json'), projectJson());
	await write(resolve(dataRoot, 'projects/apps/harbour/STATUS.md'), '# Harbour status\n\nReady.');
	await write(resolve(workspaceRoot, 'apps/harbour/README.md'), '# Harbour\n\nA test project.');
	await write(resolve(workspaceRoot, 'apps/harbour/AGENTS.md'), '# Harbour guide');
	await write(resolve(workspaceRoot, 'apps/harbour/docs/README.md'), '# Documentation');
	await write(resolve(workspaceRoot, 'apps/harbour/.private/context.md'), '# Private context');
	await write(resolve(workspaceRoot, 'apps/harbour/pnpm-lock.yaml'), 'lockfileVersion: 9');
});

afterEach(async () => {
	if (originalDataRoot === undefined) delete process.env.CADENCE_DATA_ROOT;
	else process.env.CADENCE_DATA_ROOT = originalDataRoot;
	if (originalCacheRoot === undefined) delete process.env.CADENCE_CACHE_ROOT;
	else process.env.CADENCE_CACHE_ROOT = originalCacheRoot;
	await rm(fixtureRoot, { recursive: true, force: true });
});

describe('local workspace provider', () => {
	it('discovers visible project records as the project authority', async () => {
		const definitions = await loadProjectDefinitions();
		expect(definitions).toHaveLength(1);
		expect(definitions[0]?.path).toBe('apps/harbour');

		const snapshot = await scanWorkspace();
		expect(snapshot.mode).toBe('local');
		expect(snapshot.summary.total).toBe(1);
		expect(snapshot.projects[0]?.packageManager).toBe('pnpm');
		expect(snapshot.projects[0]?.conventionScore).toBe(100);
	});

	it('loads source documentation separately from central records', async () => {
		const detail = await getProjectDetail('apps-harbour');
		expect(detail?.documents.map((document) => document.path)).toContain('README.md');
		expect(detail?.documents.map((document) => document.path)).not.toContain('.private/context.md');
		expect(detail?.records[0]?.path).toBe('projects/apps/harbour/STATUS.md');
		expect(detail?.selectedRecord?.html).toContain('<h1>Harbour status</h1>');
	});

	it('returns a guided setup state when the data repository is absent', async () => {
		process.env.CADENCE_DATA_ROOT = resolve(fixtureRoot, 'missing');
		await expect(loadWorkspace()).resolves.toMatchObject({ state: 'setup' });
	});

	it('loads durable records and cached GitHub data without a source checkout', async () => {
		const directory = resolve(workspaceRoot, 'apps/harbour');
		await rm(directory, { recursive: true });
		await write(
			resolve(dataRoot, 'projects/apps/harbour/plans/next.md'),
			'# Next steps\n\nResume work.'
		);
		await write(
			resolve(dataRoot, 'projects/apps/harbour/decisions/storage.md'),
			'# Storage decision'
		);
		await write(resolve(dataRoot, 'projects/apps/harbour/notes/ideas & café.md'), '# Saved ideas');
		await cacheEntry({
			state: 'updated',
			issues: { totalCount: 4 },
			pullRequests: { totalCount: 2 }
		});

		const detail = await getProjectDetail('apps-harbour');
		expect(detail?.project).toMatchObject({
			exists: false,
			status: { present: true },
			git: { isRepository: false, dirtyFiles: null, branch: null },
			github: { state: 'ok', openIssues: 4, openPullRequests: 2 }
		});
		expect(detail?.records.map((record) => record.kind)).toEqual([
			'status',
			'plan',
			'decision',
			'note'
		]);
		expect(detail?.selectedRecord?.html).toContain('<h1>Harbour status</h1>');
		expect(detail?.records[3].path).toBe('projects/apps/harbour/notes/ideas & café.md');
		expect(detail?.documents).toEqual([]);
		expect(detail?.recentCommits).toEqual([]);
		await expect(access(directory)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('keeps a registered project accessible with no checkout or records', async () => {
		await rm(resolve(workspaceRoot, 'apps/harbour'), { recursive: true });
		await rm(resolve(dataRoot, 'projects/apps/harbour/STATUS.md'));
		expect(await getProjectDetail('apps-harbour')).toMatchObject({
			project: { exists: false, status: { present: false } },
			records: [],
			documents: [],
			recentCommits: []
		});
	});

	it('loads source documentation again after a checkout is restored', async () => {
		const directory = resolve(workspaceRoot, 'apps/harbour');
		await rm(directory, { recursive: true });
		expect((await getProjectDetail('apps-harbour'))?.project.exists).toBe(false);
		await write(resolve(directory, 'README.md'), '# Restored Harbour');
		const detail = await getProjectDetail('apps-harbour');
		expect(detail?.project.exists).toBe(true);
		expect(detail?.selectedDocument?.html).toContain('<h1>Restored Harbour</h1>');
		expect(detail?.selectedRecord?.html).toContain('<h1>Harbour status</h1>');
	});

	it('does not expose an unregistered source folder as a project', async () => {
		await write(resolve(workspaceRoot, 'unregistered/README.md'), '# Unregistered');
		expect(await getProjectDetail('unregistered')).toBeNull();
	});

	it('reports a declared path that does not match its visible directory', async () => {
		await write(
			resolve(dataRoot, 'projects/apps/harbour/project.json'),
			projectJson('different/path')
		);
		const result = await loadWorkspace();
		expect(result.state).toBe('invalid');
		if (result.state === 'invalid')
			expect(result.errors.join(' ')).toContain('expected "apps/harbour"');
	});

	it('reports enrichment fields gracefully when there is no upstream or cache', async () => {
		await execFileAsync('git', ['init'], { cwd: resolve(workspaceRoot, 'apps/harbour') });
		const snapshot = await scanWorkspace();
		const project = snapshot.projects[0];
		expect(project?.git.ahead).toBeNull();
		expect(project?.git.behind).toBeNull();
		expect(project?.git.commitsByWeek).toHaveLength(0);
		expect(project?.github.state).toBe('absent');
		// The fixture STATUS.md has no "Updated:" line, so it counts as stale.
		expect(project?.status).toMatchObject({ present: true, updatedAt: null, stale: true });
		expect(snapshot.summary).toMatchObject({
			behindUpstream: 0,
			staleStatus: 1,
			openIssues: null,
			openPullRequests: null
		});
	});

	it('surfaces GitHub counts from the refresh cache when present', async () => {
		const cacheRoot = resolve(fixtureRoot, 'cache');
		process.env.CADENCE_CACHE_ROOT = cacheRoot;
		await write(
			resolve(cacheRoot, 'projects.json'),
			JSON.stringify({
				schemaVersion: 1,
				generatedAt: new Date().toISOString(),
				projects: [
					{
						path: 'apps/harbour',
						github: {
							state: 'updated',
							isPrivate: true,
							issues: { totalCount: 4 },
							pullRequests: { totalCount: 2 },
							latestRelease: {
								name: 'v1.0.0',
								tagName: 'v1.0.0',
								url: 'https://example.com/releases/v1.0.0',
								publishedAt: '2026-08-01T00:00:00Z'
							}
						}
					}
				]
			})
		);
		const snapshot = await scanWorkspace();
		expect(snapshot.projects[0]?.github).toMatchObject({
			state: 'ok',
			fetchedAt: expect.any(String),
			isPrivate: true,
			openIssues: 4,
			openPullRequests: 2,
			latestRelease: { tagName: 'v1.0.0' }
		});
		expect(snapshot.summary.openIssues).toBe(4);
		expect(snapshot.summary.openPullRequests).toBe(2);
	});

	it('reads a fresh Updated line from STATUS.md', async () => {
		const updatedAt = new Date().toISOString().slice(0, 10);
		await write(
			resolve(dataRoot, 'projects/apps/harbour/STATUS.md'),
			`# Harbour status\n\nUpdated: ${updatedAt}\n\nReady.`
		);
		const snapshot = await scanWorkspace();
		expect(snapshot.projects[0]?.status).toEqual({ present: true, updatedAt, stale: false });
		expect(snapshot.summary.staleStatus).toBe(0);
	});

	it('refresh writes only Cadence cache and leaves the monitored repository unchanged', async () => {
		const cacheRoot = resolve(fixtureRoot, 'cache');
		await execFileAsync('git', ['init'], { cwd: resolve(workspaceRoot, 'apps/harbour') });
		const before = await execFileAsync('git', ['status', '--porcelain=v1'], {
			cwd: resolve(workspaceRoot, 'apps/harbour')
		});
		await execFileAsync('node', ['scripts/refresh.mjs', '--local-only'], {
			cwd: process.cwd(),
			env: { ...process.env, CADENCE_DATA_ROOT: dataRoot, CADENCE_CACHE_ROOT: cacheRoot }
		});
		const after = await execFileAsync('git', ['status', '--porcelain=v1'], {
			cwd: resolve(workspaceRoot, 'apps/harbour')
		});
		expect(after.stdout).toBe(before.stdout);
		const cache = JSON.parse(await readFile(resolve(cacheRoot, 'projects.json'), 'utf8'));
		expect(cache.projects).toHaveLength(1);
	});
});

async function cacheEntry(github: unknown, generatedAt: unknown = new Date().toISOString()) {
	const cacheRoot = resolve(fixtureRoot, 'cache');
	process.env.CADENCE_CACHE_ROOT = cacheRoot;
	await write(
		resolve(cacheRoot, 'projects.json'),
		JSON.stringify({ schemaVersion: 1, generatedAt, projects: [{ path: 'apps/harbour', github }] })
	);
}

describe('data availability', () => {
	it.each(['failed', 'unavailable', 'skipped'])(
		'preserves %s cache entries without zero counts',
		async (state) => {
			await execFileAsync('git', ['init'], { cwd: resolve(workspaceRoot, 'apps/harbour') });
			await cacheEntry({ state, issues: { totalCount: 0 }, pullRequests: { totalCount: 0 } });
			const snapshot = await scanWorkspace();
			expect(snapshot.projects[0].github).toMatchObject({
				state: state === 'skipped' ? 'absent' : state,
				openIssues: null,
				openPullRequests: null
			});
			expect(snapshot.summary.openIssues).toBeNull();
			expect(snapshot.summary.openPullRequests).toBeNull();
			if (state === 'skipped') expect(snapshot.projects[0].github.fetchedAt).toBeNull();
		}
	);
	it('retains confirmed zeros and makes missing or malformed counts unknown', async () => {
		await cacheEntry({
			state: 'updated',
			issues: { totalCount: 0 },
			pullRequests: { totalCount: -1 }
		});
		const snapshot = await scanWorkspace();
		expect(snapshot.projects[0].github).toMatchObject({
			state: 'ok',
			openIssues: 0,
			openPullRequests: null
		});
		expect(snapshot.summary.openIssues).toBe(0);
		expect(snapshot.summary.openPullRequests).toBeNull();
	});
	it.each(['2020-01-01T00:00:00Z', null, 'invalid-date', '2099-01-01T00:00:00Z'])(
		'marks data stale for timestamp %s',
		async (timestamp) => {
			await cacheEntry(
				{ state: 'updated', issues: { totalCount: 4 }, pullRequests: { totalCount: 2 } },
				timestamp
			);
			const snapshot = await scanWorkspace();
			expect(snapshot.projects[0].github).toMatchObject({
				state: 'stale',
				openIssues: 4,
				openPullRequests: 2
			});
		}
	);
	it.each(['{broken', '{"schemaVersion":2,"projects":[]}', 'null'])(
		'treats malformed caches as unavailable',
		async (content) => {
			await write(resolve(process.env.CADENCE_CACHE_ROOT!, 'projects.json'), content);
			expect((await scanWorkspace()).projects[0].github.state).toBe('unavailable');
		}
	);
	it('distinguishes a non-repository from failed Git inspection and confirmed clean', async () => {
		const directory = resolve(workspaceRoot, 'apps/harbour');
		let project = (await scanWorkspace()).projects[0];
		expect(project.git).toMatchObject({ isRepository: false, dirtyFiles: null });
		await write(resolve(directory, '.git'), 'gitdir: /nonexistent-cadence-test-gitdir');
		project = (await scanWorkspace()).projects[0];
		expect(project.git).toMatchObject({
			isRepository: true,
			dirtyFiles: null,
			branch: null,
			commitsByWeek: []
		});
		await rm(resolve(directory, '.git'));
		await execFileAsync('git', ['init'], { cwd: directory });
		await write(resolve(directory, '.gitignore'), '*');
		project = (await scanWorkspace()).projects[0];
		expect(project.git.dirtyFiles).toBe(0);
	});
});

describe('filesystem boundaries', () => {
	it('rejects a registered checkout symlink that escapes the workspace', async () => {
		const outside = resolve(fixtureRoot, 'outside');
		await write(resolve(outside, 'README.md'), '# Outside secret');
		await rm(resolve(workspaceRoot, 'apps/harbour'), { recursive: true });
		await symlink(outside, resolve(workspaceRoot, 'apps/harbour'));
		const result = await loadWorkspace();
		expect(result).toMatchObject({ state: 'invalid' });
		if (result.state === 'invalid')
			expect(result.errors.join(' ')).toContain('outside workspaceRoot');
	});
	it('does not read an escaping projects root', async () => {
		await rm(resolve(dataRoot, 'projects'), { recursive: true });
		await symlink(workspaceRoot, resolve(dataRoot, 'projects'));
		expect(await loadWorkspace()).toMatchObject({ state: 'invalid' });
	});
	it('excludes linked status, source documentation and generated record directories', async () => {
		const outside = resolve(fixtureRoot, 'secret.md');
		await write(outside, '# Outside secret');
		await rm(resolve(dataRoot, 'projects/apps/harbour/STATUS.md'));
		await symlink(outside, resolve(dataRoot, 'projects/apps/harbour/STATUS.md'));
		await rm(resolve(workspaceRoot, 'apps/harbour/README.md'));
		await symlink(outside, resolve(workspaceRoot, 'apps/harbour/README.md'));
		await write(resolve(dataRoot, 'projects/apps/harbour/notes/.private/secret.md'), '# Hidden');
		await write(
			resolve(dataRoot, 'projects/apps/harbour/notes/node_modules/secret.md'),
			'# Generated'
		);
		await write(resolve(dataRoot, 'projects/apps/harbour/notes/kept.md'), '# Kept');
		const detail = await getProjectDetail('apps-harbour');
		expect(detail?.project.status.present).toBe(false);
		expect(detail?.records.map((record) => record.title)).toEqual(['Kept']);
		expect(detail?.documents.map((document) => document.path)).not.toContain('README.md');
		expect(JSON.stringify(detail)).not.toContain('Outside secret');
	});
	it('labels oversized source and record previews without consuming their tails', async () => {
		const large = '# Large\n' + 'x'.repeat(512 * 1024) + 'TAIL_SENTINEL';
		await write(resolve(workspaceRoot, 'apps/harbour/docs/large.md'), large);
		await write(resolve(dataRoot, 'projects/apps/harbour/notes/large.md'), large);
		const detail = await getProjectDetail('apps-harbour', {
			document: 'docs/large.md',
			record: 'projects/apps/harbour/notes/large.md'
		});
		for (const record of [detail!.selectedDocument!, detail!.selectedRecord!]) {
			expect(record.html).toContain('Preview truncated at 512 KiB.');
			expect(record.html).not.toContain('TAIL_SENTINEL');
		}
	});
});
