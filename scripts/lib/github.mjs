// Only the issues connection is paginated; pull requests remain a count.
const query = `query($owner: String!, $name: String!, $endCursor: String) {
	repository(owner: $owner, name: $name) {
		isPrivate
		issues(first: 100, after: $endCursor, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) {
			totalCount
			nodes { number title url updatedAt }
			pageInfo { hasNextPage endCursor }
		}
		pullRequests(states: OPEN) { totalCount }
		latestRelease { name tagName url publishedAt }
	}
}`;

/** Read all open issue pages with the authenticated GitHub CLI. A failed or
 * incomplete response replaces prior data, just like the other refresh facts.
 * @param {string} nameWithOwner
 * @param {(command: string, args: string[], timeout: number) => Promise<{ok: boolean, value?: string, error?: string}>} run
 */
export async function fetchGithub(nameWithOwner, run) {
	const [owner, name] = nameWithOwner.split('/');
	const response = await run(
		'gh',
		[
			'api',
			'graphql',
			'--paginate',
			'--slurp',
			'-f',
			`owner=${owner}`,
			'-f',
			`name=${name}`,
			'-f',
			`query=${query}`
		],
		30_000
	);
	if (!response.ok) return { state: 'failed', error: response.error };
	try {
		const pages = JSON.parse(response.value ?? '');
		if (!Array.isArray(pages) || !pages.length) throw new Error('Missing pages');
		const issues = new Map();
		for (const [index, page] of pages.entries()) {
			const connection = page?.data?.repository?.issues;
			if (
				page.errors?.length ||
				!Array.isArray(connection?.nodes) ||
				connection.pageInfo?.hasNextPage !== index < pages.length - 1
			) {
				throw new Error('Incomplete pages');
			}
			for (const issue of connection.nodes) {
				if (
					!issue ||
					!Number.isSafeInteger(issue.number) ||
					issue.number <= 0 ||
					typeof issue.title !== 'string' ||
					typeof issue.url !== 'string' ||
					!Number.isFinite(Date.parse(issue.updatedAt))
				)
					throw new Error('Invalid issue');
				issues.set(issue.number, issue);
			}
		}
		const repository = pages[0].data.repository;
		return {
			state: 'updated',
			isPrivate: repository.isPrivate,
			issues: {
				totalCount: repository.issues.totalCount,
				nodes: [...issues.values()].sort(
					(a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
				)
			},
			pullRequests: repository.pullRequests,
			latestRelease: repository.latestRelease
		};
	} catch {
		return { state: 'failed', error: 'GitHub returned unreadable or incomplete issue data.' };
	}
}
