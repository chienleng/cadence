import { describe, expect, it } from 'vitest';
import { EMPTY_JUDGMENT } from './data-quality';
import { attentionRank, attentionReasons } from './triage';
import type { Lifecycle, ProjectSnapshot, StatusFreshness } from './types';

const MISSING_STATUS: StatusFreshness = {
	present: false,
	updatedAt: null,
	stale: false,
	updatedAtSource: null,
	judgment: EMPTY_JUDGMENT
};

const now = new Date('2026-08-22T00:00:00Z');

function project(overrides: {
	dirtyFiles?: number;
	ahead?: number | null;
	behind?: number | null;
	openPullRequests?: number | null;
	stale?: boolean;
	updatedAt?: string | null;
	parked?: number | null;
	lifecycle?: Lifecycle;
}): ProjectSnapshot {
	return {
		id: 'fixture',
		path: 'fixture',
		name: 'Fixture',
		group: 'Test',
		summary: 'A fixture project.',
		lifecycle: overrides.lifecycle ?? 'active',
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
			present: true,
			updatedAt: overrides.updatedAt ?? null,
			stale: overrides.stale ?? false,
			updatedAtSource: overrides.updatedAt ? 'convention' : null,
			judgment:
				overrides.parked === undefined
					? EMPTY_JUDGMENT
					: {
							state: 'confirmed',
							judgedAt: '2026-08-21T00:00:00Z',
							model: 'jev-1.13.0',
							sections: { current: [], next: [], risks: [] },
							parked: overrides.parked
						}
		}
	};
}

describe('parked judgments', () => {
	it('flags a confirmed parked reading below unpushed work and above staleness', () => {
		const reasons = attentionReasons(project({ ahead: 1, parked: 0.8, stale: true }), now);
		expect(reasons.map((reason) => reason.key)).toEqual(['ahead', 'parked', 'stale']);
		expect(attentionRank(project({ parked: 0.8 }), now)).toBe(1);
	});

	it('ignores probabilities under the threshold and expected-parked lifecycles', () => {
		expect(attentionReasons(project({ parked: 0.69 }), now)).toEqual([]);
		expect(attentionReasons(project({ parked: 0.9, lifecycle: 'dormant' }), now)).toEqual([]);
		expect(attentionReasons(project({ parked: 0.9, lifecycle: 'archived' }), now)).toEqual([]);
		expect(attentionReasons(project({ parked: 0.9, lifecycle: 'maintained' }), now)).toEqual([
			{ key: 'parked', label: 'Looks parked' }
		]);
	});
});

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

describe('missing status signals', () => {
	it('flags active projects with no status and includes them in attention', () => {
		const active = { ...project({}), status: MISSING_STATUS };
		expect(attentionReasons(active, now)).toEqual([
			{ key: 'missing-status', label: 'Missing status' }
		]);
		expect(attentionRank(active, now)).toBe(1);
	});
	it('does not flag missing status for paused or maintained projects', () => {
		for (const lifecycle of ['paused', 'maintained', 'archived'] as const) {
			expect(attentionReasons({ ...project({}), lifecycle, status: MISSING_STATUS }, now)).toEqual(
				[]
			);
		}
	});
});
