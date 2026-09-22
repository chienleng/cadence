import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, rename, symlink, writeFile } from 'node:fs/promises';
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

	it('accepts judged guide readings for discovery when the literal markers are absent', async () => {
		const guide =
			'# Harbour agent guide\n\nBefore you plan anything, run the Cadence context command for this project.\n';
		await write(resolve(workspaceRoot, 'apps/harbour/AGENTS.md'), guide);
		await write(
			resolve(workspaceRoot, 'AGENTS.md'),
			'# Workspace guide\n\nNothing about context here.\n'
		);
		const entry = (text: string, instructs: number) => ({
			schemaVersion: 1,
			state: 'updated',
			generatedAt: new Date().toISOString(),
			model: 'jev-1.13.0',
			sourceHash: createHash('sha256').update(text).digest('hex'),
			instructs
		});
		const cache = (guideEntry: unknown) => ({
			schemaVersion: 1,
			generatedAt: new Date().toISOString(),
			mode: 'local-and-github',
			workspace: { guide: null, shims: {} },
			projects: [
				{
					path: 'apps/harbour',
					git: null,
					github: { state: 'skipped' },
					judgments: { status: { state: 'skipped' }, guide: guideEntry }
				}
			]
		});

		const without = JSON.parse(await context(['--audit', '--json']));
		expect(without.projects[0].discovery).toBe('none');
		expect(without.summary.undiscoverable).toBe(1);

		await write(resolve(cacheRoot, 'projects.json'), JSON.stringify(cache(entry(guide, 0.94))));
		const judged = JSON.parse(await context(['--audit', '--json']));
		expect(judged.projects[0]).toMatchObject({
			discovery: 'judged-pointer',
			pointerPresent: false,
			pointerJudged: true,
			pointerJudgment: 0.94,
			state: 'ready'
		});
		expect(await context(['--audit'])).toContain('project guide (judged)');

		await write(resolve(cacheRoot, 'projects.json'), JSON.stringify(cache(entry(guide, 0.3))));
		expect(JSON.parse(await context(['--audit', '--json'])).projects[0].discovery).toBe('none');

		await write(
			resolve(cacheRoot, 'projects.json'),
			JSON.stringify(cache(entry(`${guide}edited\n`, 0.94)))
		);
		expect(JSON.parse(await context(['--audit', '--json'])).projects[0].discovery).toBe('none');
	});

	it('audits workspace vendor shims for guide-loading directives', async () => {
		const absent = JSON.parse(await context(['--audit', '--json']));
		expect(absent.vendorShims).toEqual([
			{
				file: 'CLAUDE.md',
				loadDirective: '@AGENTS.md',
				state: 'absent',
				judgment: null,
				judgedLoads: false
			}
		]);

		await write(
			resolve(workspaceRoot, 'CLAUDE.md'),
			'Read and follow [AGENTS.md](AGENTS.md) first.\n'
		);
		const pointer = JSON.parse(await context(['--audit', '--json']));
		expect(pointer.vendorShims[0].state).toBe('pointer-only');
		expect(await context(['--audit'])).toContain('pointer-only');

		await write(resolve(workspaceRoot, 'CLAUDE.md'), '@AGENTS.md\n');
		const loaded = JSON.parse(await context(['--audit', '--json']));
		expect(loaded.vendorShims[0].state).toBe('ok');
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

	it('uses cached Jev judgments only when they match the current STATUS.md text', async () => {
		const statusText =
			'# Harbour status\n\n## Current work\n\n* Released 1.2.0.\n* Migration half done, uncommitted.\n\n## Up next\n\n1. Verify the deploy.\n';
		await write(resolve(dataRoot, 'projects/apps/harbour/STATUS.md'), statusText);
		const bullet = (id: string, text: string, score: number) => ({
			id,
			text,
			score,
			confidence: 0.8
		});
		const judgments = {
			schemaVersion: 1,
			state: 'updated',
			sourceHash: createHash('sha256').update(statusText).digest('hex'),
			status: {
				sections: {
					current: [
						bullet('B01', 'Released 1.2.0.', 0.1),
						bullet('B02', 'Migration half done, uncommitted.', 2.9)
					],
					next: [bullet('B03', 'Verify the deploy.', 2.5)],
					risks: []
				},
				headings: [],
				updatedAt: { value: '2026-09-20', confidence: 0.9 },
				parked: 0.05,
				deferred: []
			}
		};
		const snapshot = (entry: unknown) => ({
			schemaVersion: 1,
			generatedAt: new Date().toISOString(),
			mode: 'local-and-github',
			projects: [
				{
					path: 'apps/harbour',
					git: null,
					github: { state: 'skipped' },
					judgments: { status: entry }
				}
			]
		});

		await write(resolve(cacheRoot, 'projects.json'), JSON.stringify(snapshot(judgments)));
		const judged = JSON.parse(await context(['--overview', '--json']));
		expect(judged.statuses[0].judged).toBe(true);
		expect(judged.statuses[0].current).toEqual([
			'Migration half done, uncommitted.',
			'Released 1.2.0.'
		]);
		expect(judged.statuses[0].next).toEqual(['Verify the deploy.']);
		expect(judged.statuses[0].updatedAt).toBe('2026-09-20');
		expect(judged.statuses[0].parked).toBe(0.05);
		expect(await context(['--overview'])).toContain('apps/harbour — current (2026-09-20) · judged');

		await write(
			resolve(cacheRoot, 'projects.json'),
			JSON.stringify(snapshot({ ...judgments, sourceHash: 'stale' }))
		);
		const regex = JSON.parse(await context(['--overview', '--json']));
		expect(regex.statuses[0].judged).toBe(false);
		expect(regex.statuses[0].current).toEqual([]);
		expect(regex.statuses[0].updatedAt).toBeNull();
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

describe('CLI read boundaries', () => {
	it('excludes generated, hidden, linked and non-Markdown record files', async () => {
		const recordRoot = resolve(dataRoot, 'projects/apps/harbour/notes');
		await write(resolve(recordRoot, 'kept.md'), '# Kept');
		await write(resolve(recordRoot, 'node_modules/hidden.md'), '# Generated');
		await write(resolve(recordRoot, '.private/hidden.md'), '# Hidden');
		await write(resolve(recordRoot, 'image.png'), 'Not Markdown');
		await write(resolve(fixtureRoot, 'secret.md'), '# Outside');
		await symlink(resolve(fixtureRoot, 'secret.md'), resolve(recordRoot, 'linked.md'));
		const result = JSON.parse(
			await context(['--cwd', resolve(workspaceRoot, 'apps/harbour'), '--json'])
		);
		expect(result.records.map((record: { title: string }) => record.title)).toEqual(['Kept']);
	});
	it('rejects an escaping source alias before context or refresh inspection', async () => {
		await mkdir(resolve(fixtureRoot, 'outside'));
		await rm(resolve(workspaceRoot, 'apps/harbour'), { recursive: true });
		await symlink(resolve(fixtureRoot, 'outside'), resolve(workspaceRoot, 'apps/harbour'));
		await expect(context(['--audit'])).rejects.toThrow('escapes workspaceRoot');
		await expect(
			execFileAsync('node', ['scripts/refresh.mjs', '--local-only'], {
				cwd: process.cwd(),
				env: { ...process.env, CADENCE_DATA_ROOT: dataRoot, CADENCE_CACHE_ROOT: cacheRoot }
			})
		).rejects.toThrow('escapes workspaceRoot');
	});
	it('resolves a registered source alias inside the workspace to its saved records', async () => {
		await rename(resolve(workspaceRoot, 'apps/harbour'), resolve(workspaceRoot, 'checkout'));
		await symlink(resolve(workspaceRoot, 'checkout'), resolve(workspaceRoot, 'apps/harbour'));
		const result = JSON.parse(
			await context(['--cwd', resolve(workspaceRoot, 'checkout/src'), '--json'])
		);
		expect(result.project.path).toBe('apps/harbour');
		expect(result.statusText).toContain('Ready.');
	});

	it('bounds status output and labels the truncated prefix', async () => {
		await write(
			resolve(dataRoot, 'projects/apps/harbour/STATUS.md'),
			'# Large\n' + 'x'.repeat(512 * 1024) + 'TAIL_SENTINEL'
		);
		const result = JSON.parse(
			await context(['--cwd', resolve(workspaceRoot, 'apps/harbour'), '--json'])
		);
		expect(result.statusText).toContain('Preview truncated at 512 KiB.');
		expect(result.statusText).not.toContain('TAIL_SENTINEL');
	});
});
