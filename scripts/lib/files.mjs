import { constants } from 'node:fs';
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { StringDecoder } from 'node:string_decoder';

export const MARKDOWN_LIMIT = 512 * 1024;
export const TRUNCATION_NOTICE = '\n\n[Preview truncated at 512 KiB.]';
const skipped = new Set(['build', 'coverage', 'dist', 'node_modules', 'target', 'vendor']);

/** @param {string} root @param {string} path */
export function isWithin(root, path) {
	const fromRoot = relative(root, path);
	return fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot);
}

/** Resolve aliases before checking containment, including ancestors of absent paths.
 * @param {string} root @param {string} path
 * @param {{allowMissing?: boolean}} options
 * @returns {Promise<string | null>}
 */
export async function containedPath(root, path, { allowMissing = false } = {}) {
	root = resolve(root);
	path = resolve(path);
	if (!isWithin(root, path)) return null;
	try {
		const canonicalRoot = await realpath(root);
		let current = path;
		const missing = [];
		for (;;) {
			try {
				const canonical = resolve(await realpath(current), ...missing);
				return isWithin(canonicalRoot, canonical) ? canonical : null;
			} catch (error) {
				if (
					!allowMissing ||
					!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
				)
					return null;
				// A dangling link is not an absent directory we can safely append to.
				try {
					await lstat(current);
					return null;
				} catch (error) {
					if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
						return null;
				}
				if (current === root) return null;
				missing.unshift(basename(current));
				current = dirname(current);
			}
		}
	} catch {
		return null;
	}
}

/** @param {string} root @param {string} path @returns {Promise<string | null>} */
export async function containedDirectory(root, path) {
	const canonical = await containedPath(root, path);
	try {
		return canonical && (await stat(canonical)).isDirectory() ? canonical : null;
	} catch {
		return null;
	}
}

/** Read at most limit + one detection byte, never an entire unbounded file.
 * @param {string} root @param {string} path @param {number} limit
 * @returns {Promise<{text: string, truncated: boolean} | null>}
 */
export async function readBoundedText(root, path, limit = MARKDOWN_LIMIT) {
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 8 * 1024 * 1024)
		throw new RangeError('Invalid read limit');
	const canonical = await containedPath(root, path);
	if (!canonical) return null;
	let handle;
	try {
		// Nonblocking prevents a replaced file/FIFO from hanging open. Do not follow a
		// final symlink introduced after resolution. This is not an OS sandbox.
		handle = await open(
			canonical,
			constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
		);
		const opened = await handle.stat();
		if (!opened.isFile()) return null;
		const checked = await containedPath(root, path);
		if (checked !== canonical) return null;
		const current = await stat(checked);
		if (current.dev !== opened.dev || current.ino !== opened.ino) return null;
		const buffer = Buffer.alloc(limit + 1);
		let length = 0;
		while (length < buffer.length) {
			const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
			if (!bytesRead) break;
			length += bytesRead;
		}
		const truncated = length > limit || opened.size > limit;
		const decoder = new StringDecoder('utf8');
		const text =
			decoder.write(buffer.subarray(0, Math.min(length, limit))) + (truncated ? '' : decoder.end());
		return { text, truncated };
	} catch {
		return null;
	} finally {
		await handle?.close();
	}
}

/** @param {string} root @param {string} path */
export async function readMarkdown(root, path) {
	const result = await readBoundedText(root, path);
	return result ? result.text + (result.truncated ? TRUNCATION_NOTICE : '') : null;
}

/** Deterministic, non-symlink traversal with shared exclusions and a visit budget.
 * @param {string} root @param {string} directory
 * @param {{accept?: (path: string) => boolean, limit?: number, maxDepth?: number}} options
 * @returns {Promise<string[]>} Paths relative to directory.
 */
export async function findFiles(
	root,
	directory,
	{ accept = (path) => path.toLowerCase().endsWith('.md'), limit = 200, maxDepth = 12 } = {}
) {
	/** @type {string[]} */
	const paths = [];
	let visits = 0;
	/** @param {string} current @param {number} depth */
	async function visit(current, depth) {
		if (paths.length >= limit || depth > maxDepth || visits++ >= 2000) return;
		const canonical = await containedDirectory(root, current);
		if (!canonical) return;
		let entries;
		try {
			entries = await readdir(canonical, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			if (paths.length >= limit) break;
			if (entry.isSymbolicLink() || entry.name.startsWith('.') || skipped.has(entry.name)) continue;
			const absolute = resolve(current, entry.name);
			if (entry.isDirectory()) await visit(absolute, depth + 1);
			else if (entry.isFile() && accept(relative(directory, absolute)))
				paths.push(relative(directory, absolute));
		}
	}
	await visit(directory, 0);
	return paths;
}
