import { describe, expect, it } from 'vitest';
import { applyFilters, filterHref, lifecycleHref, metricHref, parseFilters } from './filters';
import type { ProjectSnapshot } from './types';

function project(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
	return {
		id: 'fixture',
		path: 'fixture',
		name: 'Fixture',
		group: 'Products',
		summary: 'A fixture project.',
		lifecycle: 'active',
		exists: true,
		packageManager: null,
		convention: [],
		conventionScore: 100,
		documentCount: 0,
		git: {
			isRepository: true,
			branch: 'main',
			dirtyFiles: 0,
			lastCommitAt: null,
			lastCommitHash: null,
			lastCommitSubject: null,
			remoteUrl: null,
			githubUrl: null,
			ahead: 0,
			behind: 0,
			commitsByWeek: []
		},
		github: {
			state: 'absent',
			fetchedAt: null,
			isPrivate: null,
			openIssues: null,
			openPullRequests: null,
			latestRelease: null
		},
		status: { present: true, updatedAt: '2026-08-20', stale: false },
		...overrides
	};
}

describe('parseFilters', () => {
	it('reads all filter params with sane defaults', () => {
		const state = parseFilters(
			new URLSearchParams('q=api&lifecycle=active,paused&tag=sveltekit&metric=dirty&view=table')
		);
		expect(state).toEqual({
			query: 'api',
			lifecycles: ['active', 'paused'],
			groups: [],
			tags: ['sveltekit'],
			metric: 'dirty',
			view: 'table'
		});
	});

	it('drops unknown metrics and views', () => {
		const state = parseFilters(new URLSearchParams('metric=active&view=bogus'));
		expect(state.metric).toBeNull();
		expect(state.view).toBe('grouped');
	});
});

describe('filterHref', () => {
	it('applies patches and removes empty params', () => {
		const url = new URL('http://localhost/?q=api&metric=dirty');
		expect(filterHref(url, { metric: null })).toBe('/?q=api');
		expect(filterHref(url, { lifecycles: ['active'] })).toBe(
			'/?q=api&metric=dirty&lifecycle=active'
		);
	});

	it('toggles the active metric off via metricHref', () => {
		const url = new URL('http://localhost/demo?metric=dirty');
		expect(metricHref(url, 'dirty', 'dirty')).toBe('/demo');
		expect(metricHref(url, 'stale', 'dirty')).toBe('/demo?metric=stale');
	});

	it('toggles a lifecycle while preserving other lifecycle selections', () => {
		const url = new URL('http://localhost/?lifecycle=maintained');
		expect(lifecycleHref(url, 'active', ['maintained'])).toBe('/?lifecycle=maintained%2Cactive');
		expect(lifecycleHref(url, 'active', ['maintained', 'active'])).toBe('/?lifecycle=maintained');
	});
});

describe('applyFilters', () => {
	const projects = [
		project({ id: 'a', name: 'Harbour API', tags: ['api'] }),
		project({
			id: 'b',
			name: 'Tide UI',
			group: 'Libraries',
			lifecycle: 'maintained',
			status: { present: true, updatedAt: '2026-05-01', stale: true }
		}),
		project({
			id: 'c',
			name: 'Signal Console',
			git: { ...project().git, dirtyFiles: 2, behind: 1 }
		})
	];
	const state = parseFilters(new URLSearchParams());

	it('matches search across name, path, summary, and tags', () => {
		expect(applyFilters(projects, { ...state, query: 'api' }).map((p) => p.id)).toEqual(['a']);
	});

	it('filters by facet lists', () => {
		expect(applyFilters(projects, { ...state, groups: ['Libraries'] }).map((p) => p.id)).toEqual([
			'b'
		]);
	});

	it('filters by metric, including the new triage metrics', () => {
		expect(applyFilters(projects, { ...state, metric: 'dirty' }).map((p) => p.id)).toEqual(['c']);
		expect(applyFilters(projects, { ...state, metric: 'behind' }).map((p) => p.id)).toEqual(['c']);
		expect(applyFilters(projects, { ...state, metric: 'stale' }).map((p) => p.id)).toEqual(['b']);
		expect(applyFilters(projects, { ...state, metric: 'attention' }).map((p) => p.id)).toEqual([
			'b',
			'c'
		]);
	});
});
