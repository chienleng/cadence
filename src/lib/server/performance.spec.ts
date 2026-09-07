import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as files from '../../../scripts/lib/files.mjs';
import { getProjectDetail, scanWorkspace } from './local-workspace';

const processes = vi.hoisted(() => ({ active: 0, peak: 0, calls: [] as string[][], fail: false }));
vi.mock('node:child_process', async (original) => {
	const actual = await original<typeof import('node:child_process')>();
	const execFile = Object.assign(() => {}, {
		[Symbol.for('nodejs.util.promisify.custom')]: async (_command: string, args: string[]) => {
			processes.calls.push(args);
			processes.peak = Math.max(processes.peak, ++processes.active);
			try {
				await new Promise((resolve) => setTimeout(resolve, 5));
				if (processes.fail) throw new Error('Git unavailable');
				return { stdout: args[2] === 'branch' ? 'main' : '', stderr: '' };
			} finally {
				processes.active--;
			}
		}
	});
	return { ...actual, execFile };
});

let fixture: string;
let workspace: string;
let data: string;
const originalData = process.env.CADENCE_DATA_ROOT;
const originalCache = process.env.CADENCE_CACHE_ROOT;

async function write(path: string, text: string) {
	await mkdir(resolve(path, '..'), { recursive: true });
	await writeFile(path, text);
}

beforeEach(async () => {
	fixture = await realpath(await mkdtemp(resolve(tmpdir(), 'cadence-performance-')));
	workspace = resolve(fixture, 'workspace');
	data = resolve(fixture, 'data');
	process.env.CADENCE_DATA_ROOT = data;
	process.env.CADENCE_CACHE_ROOT = resolve(fixture, 'cache');
	processes.calls = [];
	processes.peak = 0;
	processes.fail = false;
	await write(
		resolve(data, 'cadence.config.json'),
		JSON.stringify({ schemaVersion: 1, name: 'Fixture', workspaceRoot: '../workspace' })
	);
	for (let i = 0; i < 8; i++) {
		await write(
			resolve(data, `projects/project-${i}/project.json`),
			JSON.stringify({
				path: `project-${i}`,
				name: `Project ${i}`,
				group: 'Fixtures',
				summary: 'Test',
				lifecycle: 'active'
			})
		);
		await write(resolve(data, `projects/project-${i}/STATUS.md`), '# Status\n\nCurrent work.');
		await write(resolve(workspace, `project-${i}/README.md`), '# Readme\n\nSource body.');
		await mkdir(resolve(workspace, `project-${i}/.git`));
	}
});

afterEach(async () => {
	vi.restoreAllMocks();
	if (originalData === undefined) delete process.env.CADENCE_DATA_ROOT;
	else process.env.CADENCE_DATA_ROOT = originalData;
	if (originalCache === undefined) delete process.env.CADENCE_CACHE_ROOT;
	else process.env.CADENCE_CACHE_ROOT = originalCache;
	await rm(fixture, { recursive: true, force: true });
});

describe('local loading work budgets', () => {
	it('inspects only the requested project and does no Git work for an unknown ID', async () => {
		const reads = vi.spyOn(files, 'readMarkdown');
		const scans = vi.spyOn(files, 'findFiles');
		const detail = await getProjectDetail('project-3');
		expect(detail?.project.id).toBe('project-3');
		expect(processes.calls).toHaveLength(7);
		expect(processes.calls.every((args) => args[1] === resolve(workspace, 'project-3'))).toBe(true);
		expect(reads.mock.calls.every(([, path]) => path.includes('project-3/'))).toBe(true);
		expect(
			scans.mock.calls
				.filter(([root]) => root.startsWith(workspace))
				.every(([root]) => root.endsWith('project-3'))
		).toBe(true);
		processes.calls = [];
		expect(await getProjectDetail('unknown')).toBeNull();
		expect(processes.calls).toHaveLength(0);
	});

	it('keeps Git concurrency bounded across simultaneous requests and releases failed slots', async () => {
		processes.fail = true;
		const results = await Promise.all([
			scanWorkspace(),
			getProjectDetail('project-1'),
			getProjectDetail('project-2')
		]);
		expect(results).toHaveLength(3);
		expect(processes.calls.length).toBeGreaterThan(40);
		expect(processes.peak).toBe(4);
		expect(processes.active).toBe(0);
		processes.fail = false;
		expect((await getProjectDetail('project-1'))?.project.git.branch).toBe('main');
	});

	it('reads only title prefixes for unselected files and sends only selected bodies', async () => {
		const sourcePath = resolve(workspace, 'project-0/docs/large.md');
		const recordPath = resolve(data, 'projects/project-0/notes/large.md');
		const text = '# Large\n\n' + 'filler '.repeat(10000) + '\nUNSELECTED_BODY_SENTINEL';
		await write(sourcePath, text);
		await write(recordPath, text);
		const bodyReads = vi.spyOn(files, 'readMarkdown');
		const prefixReads = vi.spyOn(files, 'readBoundedText');
		const detail = await getProjectDetail('project-0');
		expect(detail?.documents).toHaveLength(2);
		expect(detail?.records).toHaveLength(2);
		expect(JSON.stringify(detail)).not.toContain('UNSELECTED_BODY_SENTINEL');
		expect(detail?.documents.every((item) => !('html' in item))).toBe(true);
		expect(detail?.records.every((item) => !('html' in item))).toBe(true);
		expect(
			bodyReads.mock.calls.some(([, path]) => path === sourcePath || path === recordPath)
		).toBe(false);
		expect(
			prefixReads.mock.calls
				.filter(([, path]) => path === sourcePath || path === recordPath)
				.map(([, , limit]) => limit)
		).toEqual([4096, 4096]);
		const selected = await getProjectDetail('project-0', {
			document: 'docs/large.md',
			record: 'projects/project-0/notes/large.md'
		});
		expect(selected?.selectedDocument?.html).toContain('UNSELECTED_BODY_SENTINEL');
		expect(selected?.selectedRecord?.html).toContain('UNSELECTED_BODY_SENTINEL');
		await write(recordPath, '# Revised\n\nFresh body after edit.');
		expect(
			(await getProjectDetail('project-0', { record: 'projects/project-0/notes/large.md' }))
				?.selectedRecord?.html
		).toContain('Fresh body after edit.');
	});

	it('validates selections against discovered lists and falls back when a selected file vanishes', async () => {
		const path = resolve(data, 'projects/project-0/notes/vanishing.md');
		await write(path, '# Vanishing');
		const read = files.readMarkdown;
		vi.spyOn(files, 'readMarkdown').mockImplementation(async (root, candidate) => {
			if (candidate === path) await rm(path, { force: true });
			return read(root, candidate);
		});
		const detail = await getProjectDetail('project-0', {
			record: 'projects/project-0/notes/vanishing.md',
			document: '../../outside.md'
		});
		expect(detail?.selectedRecord?.kind).toBe('status');
		expect(detail?.records.some((item) => item.path.endsWith('vanishing.md'))).toBe(false);
		expect(detail?.selectedDocument?.path).toBe('README.md');
	});
});
