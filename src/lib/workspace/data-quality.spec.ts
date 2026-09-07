import { describe, expect, it } from 'vitest';
import {
	EMPTY_GITHUB,
	githubTotals,
	staleGithub,
	unknownWorkingTree,
	upstreamLabel
} from './data-quality';
import { scanWorkspace } from '$lib/server/demo-workspace';

describe('GitHub coverage', () => {
	it('counts only known values and keeps partial and stale totals explicit', async () => {
		const { projects } = await scanWorkspace();
		const fixture = projects[0];
		const totals = githubTotals([
			{ ...fixture, github: { ...EMPTY_GITHUB, state: 'ok', openIssues: 0, openPullRequests: 2 } },
			{ ...fixture, github: { ...EMPTY_GITHUB, state: 'stale', openIssues: 3 } },
			{ ...fixture, github: { ...EMPTY_GITHUB, state: 'failed' } },
			{ ...fixture, github: { ...EMPTY_GITHUB, state: 'not-applicable' } }
		]);
		expect(totals.issues).toEqual({ value: 3, known: 2, expected: 3, partial: true, stale: true });
		expect(totals.prs).toEqual({ value: 2, known: 1, expected: 3, partial: true, stale: false });
		expect(githubTotals([{ ...fixture, github: EMPTY_GITHUB }]).prs.value).toBeNull();
		expect(githubTotals([]).prs).toMatchObject({
			value: null,
			known: 0,
			expected: 0,
			partial: false
		});
	});
	it('marks snapshots stale after 24 hours and rejects unknown or future dates', () => {
		const now = Date.parse('2026-09-06T12:00:00Z');
		expect(staleGithub('2026-09-05T12:00:00Z', now)).toBe(false);
		expect(staleGithub('2026-09-05T11:59:59Z', now)).toBe(true);
		expect(staleGithub(null, now)).toBe(true);
		expect(staleGithub('invalid', now)).toBe(true);
		expect(staleGithub('2026-09-07T12:00:00Z', now)).toBe(true);
	});
	it('counts failed working-tree inspections separately from clean and non-repositories', async () => {
		const { projects } = await scanWorkspace();
		const project = projects[0];
		expect(unknownWorkingTree(project)).toBe(false);
		expect(unknownWorkingTree({ ...project, git: { ...project.git, dirtyFiles: null } })).toBe(
			true
		);
		expect(
			unknownWorkingTree({
				...project,
				git: { ...project.git, isRepository: false, dirtyFiles: null }
			})
		).toBe(false);
	});
});

describe('local upstream wording', () => {
	it('distinguishes matching local refs, divergence and unknown comparisons', () => {
		expect(upstreamLabel({ ahead: 0, behind: 0 })).toBe('Matches local upstream');
		expect(upstreamLabel({ ahead: 2, behind: 3 })).toBe('2 ahead · 3 behind · local refs');
		expect(upstreamLabel({ ahead: null, behind: null })).toBe('Comparison unavailable');
		expect(upstreamLabel({ ahead: null, behind: 0 })).toBe('Unknown ahead · 0 behind · local refs');
	});
});
