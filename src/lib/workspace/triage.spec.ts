import { describe, expect, it } from 'vitest';
import { attentionRank, attentionReasons } from './triage';
import type { ProjectSnapshot } from './types';

const now = new Date('2026-08-22T00:00:00Z');

function project(overrides: {
	dirtyFiles?: number;
	ahead?: number | null;
	behind?: number | null;
	openPullRequests?: number | null;
	stale?: boolean;
	updatedAt?: string | null;
}): ProjectSnapshot {
	return {
		id: 'fixture',
		path: 'fixture',
		name: 'Fixture',
		group: 'Test',
		summary: 'A fixture project.',
		lifecycle: 'active',
		exists: true,
		packageManager: null,
		convention: [],
		conventionScore: 0,
		documentCount: 0,
		git: {
			isRepository: true,
			branch: 'main',
			dirtyFiles: overrides.dirtyFiles ?? 0,
			lastCommitAt: null,
			lastCommitHash: null,
			lastCommitSubject: null,
			remoteUrl: null,
			githubUrl: null,
			ahead: overrides.ahead ?? null,
			behind: overrides.behind ?? null,
			commitsByWeek: []
		},
		github: {
			state: overrides.openPullRequests == null ? 'absent' : 'ok',
			fetchedAt: null,
			isPrivate: null,
			openIssues: null,
			openPullRequests: overrides.openPullRequests ?? null,
			latestRelease: null
		},
		status: {
			present: overrides.stale !== undefined,
			updatedAt: overrides.updatedAt ?? null,
			stale: overrides.stale ?? false
		}
	};
}

describe('attentionReasons', () => {
	it('returns nothing for a clean project', () => {
		expect(attentionReasons(project({}), now)).toEqual([]);
	});

	it('reports dirty, unpushed, behind, PRs, and stale status in triage order', () => {
		const reasons = attentionReasons(
			project({
				dirtyFiles: 3,
				ahead: 2,
				behind: 1,
				openPullRequests: 2,
				stale: true,
				updatedAt: '2026-07-01'
			}),
			now
		);
		expect(reasons.map((reason) => reason.key)).toEqual([
			'dirty',
			'ahead',
			'behind',
			'prs',
			'stale'
		]);
		expect(reasons[0]?.label).toBe('3 uncommitted');
		expect(reasons.at(-1)?.label).toBe('STATUS stale 52d');
	});

	it('treats a missing upstream as nothing to report', () => {
		expect(attentionReasons(project({ ahead: null, behind: null }), now)).toEqual([]);
	});
});

describe('attentionRank', () => {
	it('ranks dirty work above every other signal combined', () => {
		const dirty = attentionRank(project({ dirtyFiles: 1 }), now);
		const everythingElse = attentionRank(
			project({ ahead: 5, behind: 5, openPullRequests: 5, stale: true }),
			now
		);
		expect(everythingElse).toBeGreaterThan(0);
		expect(dirty).toBeGreaterThan(everythingElse);
		expect(attentionRank(project({}), now)).toBe(0);
	});
});
