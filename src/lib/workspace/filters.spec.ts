import { describe, expect, it } from 'vitest';
import {
	activeFilters,
	applyFilters,
	filterHref,
	lifecycleHref,
	metricHref,
	parseFilters,
	resetFiltersHref
} from './filters';
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
		const url = new URL('http://localhost/projects?q=api&metric=dirty');
		expect(filterHref(url, { metric: null })).toBe('/projects?q=api');
		expect(filterHref(url, { lifecycles: ['active'] })).toBe(
			'/projects?q=api&metric=dirty&lifecycle=active'
		);
	});

	it('toggles the active metric off via metricHref', () => {
		const url = new URL('http://localhost/demo?metric=dirty');
		expect(metricHref(url, 'dirty', 'dirty')).toBe('/demo');
		expect(metricHref(url, 'stale', 'dirty')).toBe('/demo?metric=stale');
	});

	it('toggles a lifecycle while preserving other lifecycle selections', () => {
		const url = new URL('http://localhost/projects?lifecycle=maintained');
		expect(lifecycleHref(url, 'active', ['maintained'])).toBe(
			'/projects?lifecycle=maintained%2Cactive'
		);
		expect(lifecycleHref(url, 'active', ['maintained', 'active'])).toBe(
			'/projects?lifecycle=maintained'
		);
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

describe('active filter controls', () => {
	it('lists all filters and removes one facet without clearing the others or table view', () => {
		const url = new URL(
			'http://cadence.localhost/demo?q=api&group=Products,Libraries&lifecycle=active&tag=typescript&metric=attention&view=table'
		);
		const state = parseFilters(url.searchParams);
		const chips = activeFilters(state);
		expect(chips.map((chip) => chip.label)).toEqual([
			'Search: api',
			'Focus: Needs attention',
			'Group: Products',
			'Group: Libraries',
			'Lifecycle: active',
			'Tag: typescript'
		]);
		const result = new URL(
			filterHref(url, chips.find((chip) => chip.key === 'groups:Products')!.patch),
			url
		);
		expect(parseFilters(result.searchParams)).toEqual({ ...state, groups: ['Libraries'] });
	});
	it('resets every filter while preserving view and unrelated URL parameters', () => {
		const url = new URL(
			'http://cadence.localhost/demo?q=api&group=Products&lifecycle=active&tag=typescript&metric=dirty&view=table&extra=keep'
		);
		expect(resetFiltersHref(url)).toBe('/demo?view=table&extra=keep');
		expect(activeFilters(parseFilters(new URLSearchParams('view=table')))).toEqual([]);
	});
	it('deduplicates facet values so URL repetition cannot create duplicate controls', () => {
		expect(
			activeFilters(parseFilters(new URLSearchParams('group=Products,Products&tag=api,api')))
		).toHaveLength(2);
	});
	it('includes active projects missing status in both focus filters', () => {
		const projects = [
			project({ id: 'missing', status: { present: false, updatedAt: null, stale: false } }),
			project({ id: 'present' }),
			project({
				id: 'paused',
				lifecycle: 'paused',
				status: { present: false, updatedAt: null, stale: false }
			})
		];
		for (const metric of ['attention', 'missing-status']) {
			expect(
				applyFilters(projects, parseFilters(new URLSearchParams(`metric=${metric}`))).map(
					(p) => p.id
				)
			).toEqual(['missing']);
		}
	});
});
