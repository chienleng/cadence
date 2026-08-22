import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
let fixtureRoot: string;
let dataRoot: string;
let workspaceRoot: string;
let cacheRoot: string;
const originalDataRoot = process.env.CADENCE_DATA_ROOT;

async function write(path: string, content: string): Promise<void> {
	await mkdir(resolve(path, '..'), { recursive: true });
	await writeFile(path, content);
}

async function context(args: string[]): Promise<string> {
	const result = await execFileAsync('node', ['scripts/context.mjs', ...args], {
		cwd: process.cwd(),
		env: { ...process.env, CADENCE_DATA_ROOT: dataRoot, CADENCE_CACHE_ROOT: cacheRoot }
	});
	return result.stdout;
}

beforeEach(async () => {
	fixtureRoot = await mkdtemp(resolve(tmpdir(), 'cadence-context-test-'));
	dataRoot = resolve(fixtureRoot, 'data');
	workspaceRoot = resolve(fixtureRoot, 'workspace');
	cacheRoot = resolve(fixtureRoot, 'cache');
	process.env.CADENCE_DATA_ROOT = dataRoot;
	await write(
		resolve(dataRoot, 'cadence.config.json'),
		JSON.stringify({ schemaVersion: 1, name: 'Test workspace', workspaceRoot: '../workspace' })
	);
	await write(
		resolve(dataRoot, 'projects/apps/harbour/project.json'),
		JSON.stringify({
			schemaVersion: 1,
			path: 'apps/harbour',
			name: 'Harbour',
			group: 'Products',
			summary: 'A fixture project.',
			lifecycle: 'active'
		})
	);
	await write(
		resolve(workspaceRoot, 'AGENTS.md'),
		'# Workspace guide\n\n## Cadence context\n\nRun `pnpm context --cwd "$PWD"`.\n'
	);
	await write(
		resolve(dataRoot, 'projects/apps/harbour/STATUS.md'),
		`# Harbour status\n\nUpdated: ${new Date().toISOString().slice(0, 10)}\n\nReady.\n`
	);
	await write(resolve(workspaceRoot, 'apps/harbour/src/index.ts'), 'export {};\n');
});

afterEach(async () => {
	if (originalDataRoot === undefined) delete process.env.CADENCE_DATA_ROOT;
	else process.env.CADENCE_DATA_ROOT = originalDataRoot;
	await rm(fixtureRoot, { recursive: true, force: true });
});

describe('agent context discovery', () => {
	it('resolves a nested working directory to the registered project', async () => {
		await write(
			resolve(dataRoot, 'projects/apps/project.json'),
			JSON.stringify({
				schemaVersion: 1,
				path: 'apps',
				name: 'Apps',
				group: 'Products',
				summary: 'The parent workspace.',
				lifecycle: 'active'
			})
		);
		const output = await context(['--cwd', resolve(workspaceRoot, 'apps/harbour/src'), '--json']);
		const resolved = JSON.parse(output);

		expect(resolved.project.path).toBe('apps/harbour');
		expect(resolved.state).toBe('ready');
		expect(resolved.workspaceGuidePresent).toBe(true);
		expect(resolved.statusText).toContain('Ready.');
	});

	it('prints a reviewable project pointer without writing it', async () => {
		const snippet = await context(['--cwd', resolve(workspaceRoot, 'apps/harbour'), '--snippet']);

		expect(snippet).toContain('<!-- cadence-context:start -->');
		expect(snippet).toContain('context --cwd .');
		expect(snippet).toContain('GitHub Issues remain the source of actionable work.');
	});

	it('audits missing project status separately from discovery', async () => {
		await write(
			resolve(dataRoot, 'projects/tools/anchor/project.json'),
			JSON.stringify({
				schemaVersion: 1,
				path: 'tools/anchor',
				name: 'Anchor',
				group: 'Tools',
				summary: 'Another fixture.',
				lifecycle: 'active'
			})
		);
		await write(resolve(workspaceRoot, 'tools/anchor/README.md'), '# Anchor\n');

		const audit = JSON.parse(await context(['--audit', '--json']));

		expect(audit.summary.ready).toBe(1);
		expect(audit.summary['no-status']).toBe(1);
	});
});

describe('workspace overview', () => {
	it('aggregates statuses by recency and reports the missing refresh cache', async () => {
		await write(
			resolve(dataRoot, 'projects/tools/anchor/project.json'),
			JSON.stringify({
				schemaVersion: 1,
				path: 'tools/anchor',
				name: 'Anchor',
				group: 'Tools',
				summary: 'Another fixture.',
				lifecycle: 'maintained'
			})
		);
		await write(resolve(workspaceRoot, 'tools/anchor/README.md'), '# Anchor\n');
		await write(
			resolve(dataRoot, 'projects/tools/anchor/STATUS.md'),
			'# Anchor status\n\nUpdated: 2020-01-01\n\n## Current\n\n- Dormant.\n'
		);
		await write(
			resolve(dataRoot, 'projects/apps/harbour/STATUS.md'),
			`# Harbour status\n\nUpdated: ${new Date().toISOString().slice(0, 10)}\n\n## Current\n\n- Shipping.\n\n## Next\n\n- Iterate.\n`
		);

		const overview = JSON.parse(await context(['--overview', '--json']));

		expect(overview.cache.present).toBe(false);
		expect(overview.activity).toBeNull();
		expect(overview.statuses.map((status: { path: string }) => status.path)).toEqual([
			'apps/harbour',
			'tools/anchor'
		]);
		expect(overview.statuses[0].stale).toBe(false);
		expect(overview.statuses[0].current).toEqual(['Shipping.']);
		expect(overview.statuses[0].next).toEqual(['Iterate.']);
		expect(overview.statuses[1].stale).toBe(true);

		const text = await context(['--overview']);
		expect(text).toContain('Refresh cache: missing');
		expect(text).toContain('pnpm refresh');
	});

	it('joins repository activity from the refresh cache', async () => {
		await write(
			resolve(cacheRoot, 'projects.json'),
			JSON.stringify({
				schemaVersion: 1,
				generatedAt: new Date().toISOString(),
				mode: 'local-and-github',
				summary: { total: 1, repositories: 1, dirty: 1, githubFailures: 0 },
				projects: [
					{
						path: 'apps/harbour',
						git: {
							branch: 'main',
							dirtyFiles: 3,
							lastCommitAt: new Date().toISOString(),
							lastCommitHash: 'abc1234',
							lastCommitSubject: 'Ship the harbour',
							ahead: 2,
							behind: 0
						},
						github: { state: 'updated', pullRequests: { totalCount: 2 }, issues: { totalCount: 0 } }
					}
				]
			})
		);

		const overview = JSON.parse(await context(['--overview', '--json']));

		expect(overview.cache.present).toBe(true);
		expect(overview.cache.ageDays).toBe(0);
		expect(overview.cache.stale).toBe(false);
		expect(overview.activity.dirty).toEqual([
			{ path: 'apps/harbour', branch: 'main', dirtyFiles: 3 }
		]);
		expect(overview.activity.diverged).toEqual([
			{ path: 'apps/harbour', branch: 'main', ahead: 2, behind: 0 }
		]);
		expect(overview.activity.recentCommits[0].subject).toBe('Ship the harbour');
		expect(overview.activity.openPullRequests).toEqual([{ path: 'apps/harbour', count: 2 }]);
		expect(overview.activity.openIssues).toEqual([]);
	});

	it('filters recent records to the requested window', async () => {
		const today = new Date().toISOString().slice(0, 10);
		await write(
			resolve(dataRoot, `projects/apps/harbour/decisions/${today}-adopt-fixture.md`),
			'# Adopt the fixture\n'
		);
		await write(
			resolve(dataRoot, 'projects/apps/harbour/notes/2020-01-01-ancient-note.md'),
			'# Ancient note\n'
		);

		const overview = JSON.parse(await context(['--overview', '--json', '--days', '7']));

		expect(overview.recentDays).toBe(7);
		expect(overview.recentRecords).toHaveLength(1);
		expect(overview.recentRecords[0]).toMatchObject({
			projectPath: 'apps/harbour',
			kind: 'decision',
			date: today,
			title: 'Adopt the fixture'
		});
	});

	it('rejects invalid overview flag combinations', async () => {
		await expect(context(['--overview', '--cwd', workspaceRoot])).rejects.toThrow();
		await expect(context(['--overview', '--days', 'potato'])).rejects.toThrow();
	});
});
