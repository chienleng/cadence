import type { ProjectRecord } from './types';

const DASHBOARD_KEYS = ['q', 'lifecycle', 'group', 'tag', 'metric', 'view'] as const;

/** Carry only dashboard state, never a user-supplied redirect destination. */
export function dashboardParams(source: URLSearchParams): URLSearchParams {
	const params = new URLSearchParams();
	for (const key of DASHBOARD_KEYS) {
		const value = source.get(key);
		if (value !== null) params.set(key, value);
	}
	return params;
}

export function dashboardHref(base: string, source: URLSearchParams): string {
	const query = dashboardParams(source).toString();
	return `${base}${query ? `?${query}` : ''}`;
}

export function recordHref(url: URL, path: string): string {
	const params = dashboardParams(url.searchParams);
	const document = url.searchParams.get('document');
	if (document !== null) params.set('document', document);
	params.set('record', path);
	return `${url.pathname}?${params}#project-workflow`;
}

export function documentHref(url: URL, path: string): string {
	const params = dashboardParams(url.searchParams);
	const record = url.searchParams.get('record');
	if (record !== null) params.set('record', record);
	params.set('document', path);
	return `${url.pathname}?${params}#knowledge-map`;
}

export function selectRecord<T extends Pick<ProjectRecord, 'path' | 'kind'>>(
	records: T[],
	path: string | null
): T | undefined {
	return (
		records.find((record) => record.path === path) ??
		records.find((record) => record.kind === 'status') ??
		records[0]
	);
}
