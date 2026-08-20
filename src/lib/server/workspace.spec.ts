import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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
	await rm(fixtureRoot, { recursive: true, force: true });
});

describe('local workspace provider', () => {
	it('discovers visible project records as the portfolio authority', async () => {
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
		expect(detail?.records[0]?.html).toContain('<h1>Harbour status</h1>');
	});

	it('returns a guided setup state when the data repository is absent', async () => {
		process.env.CADENCE_DATA_ROOT = resolve(fixtureRoot, 'missing');
		await expect(loadWorkspace()).resolves.toMatchObject({ state: 'setup' });
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
