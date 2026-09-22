import { attentionReasons } from './triage';
import type { ProjectSnapshot } from './types';

export type MetricFilter =
	'attention' | 'dirty' | 'behind' | 'stale' | 'standardized' | 'missing' | 'missing-status';

export type ProjectView = 'grouped' | 'table';

export interface FilterState {
	query: string;
	lifecycles: string[];
	groups: string[];
	tags: string[];
	metric: MetricFilter | null;
	view: ProjectView;
}

const METRICS = new Set<MetricFilter>([
	'attention',
	'dirty',
	'behind',
	'stale',
	'standardized',
	'missing',
	'missing-status'
]);

function list(params: URLSearchParams, key: string): string[] {
	return [
		...new Set(
			params
				.get(key)
				?.split(',')
				.map((value) => value.trim())
				.filter(Boolean) ?? []
		)
	];
}

export function parseFilters(params: URLSearchParams): FilterState {
	const metric = params.get('metric');
	return {
		query: params.get('q')?.trim() ?? '',
		lifecycles: list(params, 'lifecycle'),
		groups: list(params, 'group'),
		tags: list(params, 'tag'),
		metric: METRICS.has(metric as MetricFilter) ? (metric as MetricFilter) : null,
		view: params.get('view') === 'table' ? 'table' : 'grouped'
	};
}

export interface FilterPatch {
	query?: string | null;
	lifecycles?: string[];
	groups?: string[];
	tags?: string[];
	metric?: MetricFilter | null;
	view?: ProjectView | null;
}

const PARAM_KEYS = {
	query: 'q',
	lifecycles: 'lifecycle',
	groups: 'group',
	tags: 'tag',
	metric: 'metric',
	view: 'view'
} as const;

/**
 * The current URL with the patched filter params applied. Empty values
 * remove their param; `view: 'grouped'` and `metric: null` are the defaults
 * and stay out of the URL.
 */
export function filterHref(url: URL, patch: FilterPatch): string {
	const params = new URLSearchParams(url.searchParams);
	for (const [field, key] of Object.entries(PARAM_KEYS)) {
		const value = patch[field as keyof FilterPatch];
		if (value === undefined) continue;
		const serialized = Array.isArray(value) ? value.join(',') : value;
		if (!serialized || serialized === 'grouped') params.delete(key);
		else params.set(key, serialized);
	}
	const query = params.toString();
	return `${url.pathname}${query ? `?${query}` : ''}`;
}

export const METRIC_LABELS: Record<MetricFilter, string> = {
	attention: 'Needs attention',
	dirty: 'Dirty',
	behind: 'Behind upstream',
	stale: 'Stale status',
	standardized: 'Standardized',
	missing: 'Missing locally',
	'missing-status': 'Missing status'
};

export function resetFiltersHref(url: URL): string {
	return filterHref(url, { query: null, lifecycles: [], groups: [], tags: [], metric: null });
}

/** Each chip removes only its own selection; presentation preferences stay in the URL. */
export function activeFilters(
	state: FilterState
): { key: string; label: string; patch: FilterPatch }[] {
	const items: { key: string; label: string; patch: FilterPatch }[] = [];
	if (state.query)
		items.push({ key: 'query', label: `Search: ${state.query}`, patch: { query: null } });
	if (state.metric)
		items.push({
			key: 'metric',
			label: `Focus: ${METRIC_LABELS[state.metric]}`,
			patch: { metric: null }
		});
	for (const [key, label] of [
		['groups', 'Group'],
		['lifecycles', 'Lifecycle'],
		['tags', 'Tag']
	] as const) {
		for (const value of state[key])
			items.push({
				key: `${key}:${value}`,
				label: `${label}: ${value}`,
				patch: { [key]: state[key].filter((item) => item !== value) }
			});
	}
	return items;
}

/** Toggle link for a metric stat tile: clicking the active metric clears it. */
export function metricHref(url: URL, metric: MetricFilter, current: MetricFilter | null): string {
	return filterHref(url, { metric: current === metric ? null : metric });
}

/** Toggle one lifecycle while preserving any other selected lifecycle facets. */
export function lifecycleHref(url: URL, lifecycle: string, current: string[]): string {
	return filterHref(url, {
		lifecycles: current.includes(lifecycle)
			? current.filter((value) => value !== lifecycle)
			: [...current, lifecycle]
	});
}

/** Archived projects stay out of the dashboard unless a lifecycle facet names them. */
export function shownByDefault(project: Pick<ProjectSnapshot, 'lifecycle'>): boolean {
	return project.lifecycle !== 'archived';
}

export function matchesLifecycle(project: ProjectSnapshot, lifecycles: string[]): boolean {
	return lifecycles.length === 0 ? shownByDefault(project) : lifecycles.includes(project.lifecycle);
}

export function matchesMetric(
	project: ProjectSnapshot,
	metric: MetricFilter | null,
	now = new Date()
): boolean {
	if (metric === 'attention') return attentionReasons(project, now).length > 0;
	if (metric === 'dirty') return (project.git.dirtyFiles ?? 0) > 0;
	if (metric === 'behind') return (project.git.behind ?? 0) > 0;
	if (metric === 'stale') return project.status.stale;
	if (metric === 'standardized') return project.conventionScore === 100;
	if (metric === 'missing') return !project.exists;
	if (metric === 'missing-status') return project.lifecycle === 'active' && !project.status.present;
	return true;
}

export function applyFilters(
	projects: ProjectSnapshot[],
	state: FilterState,
	now = new Date()
): ProjectSnapshot[] {
	const query = state.query.toLowerCase();
	return projects.filter((project) => {
		const matchesQuery =
			!query ||
			project.name.toLowerCase().includes(query) ||
			project.summary.toLowerCase().includes(query) ||
			project.path.toLowerCase().includes(query) ||
			(project.tags ?? []).some((tag) => tag.toLowerCase().includes(query));
		return (
			matchesQuery &&
			matchesMetric(project, state.metric, now) &&
			matchesLifecycle(project, state.lifecycles) &&
			(state.groups.length === 0 || state.groups.includes(project.group)) &&
			(state.tags.length === 0 || (project.tags ?? []).some((tag) => state.tags.includes(tag)))
		);
	});
}
