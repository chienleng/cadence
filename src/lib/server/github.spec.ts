import { describe, expect, it, vi } from 'vitest';
import { fetchGithub } from '../../../scripts/lib/github.mjs';

const issue = (number: number) => ({
	number,
	title: `Issue ${number}`,
	url: `https://github.com/example/project/issues/${number}`,
	updatedAt: `2026-09-${number === 1 ? '20' : '21'}T00:00:00Z`
});
const page = (nodes: ReturnType<typeof issue>[], hasNextPage = false) => ({
	data: {
		repository: {
			isPrivate: true,
			issues: {
				totalCount: nodes.length,
				nodes,
				pageInfo: { hasNextPage, endCursor: hasNextPage ? 'next' : null }
			},
			pullRequests: { totalCount: 3 },
			latestRelease: null
		}
	}
});

describe('GitHub issue refresh', () => {
	it('requests all open issue pages and combines them without duplicate issues or pull requests', async () => {
		const run = vi.fn().mockResolvedValue({
			ok: true,
			value: JSON.stringify([page([issue(1)], true), page([issue(1), issue(2)])])
		});
		const result = await fetchGithub('example/project', run);
		expect(result).toMatchObject({
			state: 'updated',
			isPrivate: true,
			issues: { nodes: [issue(2), issue(1)] },
			pullRequests: { totalCount: 3 }
		});
		const args = run.mock.calls[0][1] as string[];
		expect(args).toEqual(
			expect.arrayContaining(['--paginate', '--slurp', 'owner=example', 'name=project'])
		);
		expect(args.find((arg) => arg.startsWith('query='))).toContain('states: OPEN');
	});
	it('preserves a successfully fetched empty list', async () => {
		expect(
			await fetchGithub('example/project', async () => ({
				ok: true,
				value: JSON.stringify([page([])])
			}))
		).toMatchObject({ state: 'updated', issues: { totalCount: 0, nodes: [] } });
	});
	it.each([
		'broken',
		'[]',
		JSON.stringify([page([], true)]),
		JSON.stringify([{ errors: [{ message: 'denied' }], ...page([]) }]),
		JSON.stringify([page([null as never])])
	])('rejects malformed or incomplete responses: %s', async (value) => {
		expect(await fetchGithub('example/project', async () => ({ ok: true, value }))).toMatchObject({
			state: 'failed'
		});
	});
	it('retains the CLI error on auth, timeout or API failure', async () => {
		expect(
			await fetchGithub('example/project', async () => ({
				ok: false,
				error: 'API rate limit exceeded'
			}))
		).toEqual({ state: 'failed', error: 'API rate limit exceeded' });
	});
});
