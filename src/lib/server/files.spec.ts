import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, open, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	containedPath,
	findFiles,
	MARKDOWN_LIMIT,
	readBoundedText,
	readMarkdown
} from '../../../scripts/lib/files.mjs';

let fixture: string;
let root: string;
beforeEach(async () => {
	fixture = await mkdtemp(join(tmpdir(), 'cadence-files-'));
	root = join(fixture, 'root');
	await mkdir(root);
});
afterEach(async () => {
	await rm(fixture, { recursive: true, force: true });
});

describe('bounded contained reads', () => {
	it('reads a bounded prefix of a sparse oversized file and labels truncation', async () => {
		const path = join(root, 'large.md');
		const handle = await open(path, 'w');
		await handle.write('# Large\n');
		await handle.truncate(1024 * 1024 * 1024);
		await handle.close();
		const result = await readBoundedText(root, path);
		expect(result?.truncated).toBe(true);
		expect(Buffer.byteLength(result!.text)).toBe(MARKDOWN_LIMIT);
		expect(await readMarkdown(root, path)).toContain('[Preview truncated at 512 KiB.]');
	});
	it('does not split UTF-8 characters at the byte limit or mark exact-size files truncated', async () => {
		const path = join(root, 'utf8.md');
		await writeFile(path, 'abc€tail');
		expect(await readBoundedText(root, path, 5)).toEqual({ text: 'abc', truncated: true });
		await writeFile(path, 'abc');
		expect(await readBoundedText(root, path, 3)).toEqual({ text: 'abc', truncated: false });
	});
	it('rejects sibling-prefix escapes, linked files and linked ancestors outside the root', async () => {
		const outside = join(fixture, 'root-other');
		await mkdir(outside);
		await writeFile(join(outside, 'secret.md'), 'OUTSIDE');
		await symlink(join(outside, 'secret.md'), join(root, 'linked.md'));
		await symlink(outside, join(root, 'linked-dir'));
		expect(await readMarkdown(root, join(outside, 'secret.md'))).toBeNull();
		expect(await readMarkdown(root, join(root, 'linked.md'))).toBeNull();
		expect(await readMarkdown(root, join(root, 'linked-dir/secret.md'))).toBeNull();
		expect(
			await containedPath(root, join(root, 'linked-dir/absent/deeper'), { allowMissing: true })
		).toBeNull();
	});
	it('accepts a configured root alias and safe absent descendants', async () => {
		const alias = join(fixture, 'alias');
		await symlink(root, alias);
		await writeFile(join(root, 'ok.md'), 'Inside');
		expect(await readMarkdown(alias, join(alias, 'ok.md'))).toBe('Inside');
		expect(await containedPath(alias, join(alias, 'missing/deeper'), { allowMissing: true })).toBe(
			join(await realpath(root), 'missing/deeper')
		);
	});
	it('skips nonregular files without blocking, and tolerates removed optional files', async () => {
		const fifo = join(root, 'pipe.md');
		execFileSync('mkfifo', [fifo]);
		expect(await readMarkdown(root, fifo)).toBeNull();
		expect(await readMarkdown(root, root)).toBeNull();
		await writeFile(join(root, 'gone.md'), 'Gone');
		expect(await findFiles(root, root)).toEqual(['gone.md']);
		await rm(join(root, 'gone.md'));
		expect(await readMarkdown(root, join(root, 'gone.md'))).toBeNull();
	});
	it('uses sorted bounded traversal and shared hidden/generated/link exclusions', async () => {
		for (const directory of ['notes', 'node_modules', 'build', '.private', 'notes/dist']) {
			await mkdir(join(root, directory), { recursive: true });
			await writeFile(join(root, directory, 'z.md'), '# Excluded unless notes');
		}
		await writeFile(join(root, 'notes/a.md'), '# A');
		await symlink(join(root, 'notes'), join(root, 'alias-notes'));
		expect(await findFiles(root, root)).toEqual(['notes/a.md', 'notes/z.md']);
		expect(await findFiles(root, root, { limit: 1 })).toEqual(['notes/a.md']);
		expect(await findFiles(root, root, { maxDepth: 0 })).toEqual([]);
	});
});
