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
const originalDataRoot = process.env.CADENCE_DATA_ROOT;

async function write(path: string, content: string): Promise<void> {
	await mkdir(resolve(path, '..'), { recursive: true });
	await writeFile(path, content);
}

async function context(args: string[]): Promise<string> {
	const result = await execFileAsync('node', ['scripts/context.mjs', ...args], {
		cwd: process.cwd(),
		env: { ...process.env, CADENCE_DATA_ROOT: dataRoot }
	});
	return result.stdout;
}

beforeEach(async () => {
	fixtureRoot = await mkdtemp(resolve(tmpdir(), 'cadence-context-test-'));
	dataRoot = resolve(fixtureRoot, 'data');
	workspaceRoot = resolve(fixtureRoot, 'workspace');
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
