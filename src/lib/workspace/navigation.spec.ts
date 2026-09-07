import { describe, expect, it } from 'vitest';
import {
	dashboardHref,
	dashboardParams,
	documentHref,
	recordHref,
	selectRecord
} from './navigation';
import type { ProjectRecord } from './types';

const records: ProjectRecord[] = [
	{
		path: 'projects/harbour/notes/ideas & café.md',
		title: 'Ideas',
		kind: 'note',
		html: '',
		sourceUrl: null
	},
	{ path: 'projects/harbour/STATUS.md', title: 'Status', kind: 'status', html: '', sourceUrl: null }
];

describe('project navigation', () => {
	it('round-trips every dashboard filter and view without carrying record selection', () => {
		const params = new URLSearchParams(
			'q=api+test&lifecycle=active,paused&group=Products&tag=api&metric=attention&view=table&record=private'
		);
		const back = new URL(dashboardHref('/demo', params), 'https://cadence.example');
		expect(back.pathname).toBe('/demo');
		expect(back.searchParams.get('record')).toBeNull();
		for (const key of ['q', 'lifecycle', 'group', 'tag', 'metric', 'view']) {
			expect(back.searchParams.get(key)).toBe(params.get(key));
		}
	});
	it('uses the trusted dashboard route and ignores redirect destinations', () => {
		const params = new URLSearchParams(
			'returnTo=https://evil.example&next=//evil.example&record=one'
		);
		expect(dashboardHref('/projects', params)).toBe('/projects');
		expect(dashboardParams(params).size).toBe(0);
	});
	it('encodes exact record paths while retaining return context and replacing selection', () => {
		const url = new URL(
			'https://cadence.example/projects/harbour?q=api&view=table&record=old#project-state'
		);
		const next = new URL(recordHref(url, records[0].path), url);
		expect(next.pathname).toBe(url.pathname);
		expect(next.searchParams.get('record')).toBe(records[0].path);
		expect(next.searchParams.get('q')).toBe('api');
		expect(next.searchParams.get('view')).toBe('table');
		expect(next.hash).toBe('#project-workflow');
	});
	it('keeps document and record selections independent and excludes both from dashboard return', () => {
		const url = new URL('https://cadence.example/demo/projects/harbour?q=api&record=status');
		const document = new URL(documentHref(url, 'docs/café & ideas.md'), url);
		expect(document.searchParams.get('record')).toBe('status');
		expect(document.searchParams.get('document')).toBe('docs/café & ideas.md');
		expect(document.hash).toBe('#knowledge-map');
		const record = new URL(recordHref(document, 'next'), url);
		expect(record.searchParams.get('document')).toBe('docs/café & ideas.md');
		expect(dashboardHref('/demo', record.searchParams)).toBe('/demo?q=api');
	});
	it('defaults to status regardless of record order, and honors direct selections', () => {
		expect(selectRecord(records, null)).toBe(records[1]);
		expect(selectRecord(records, records[0].path)).toBe(records[0]);
	});
	it('handles deleted links, projects without status, and empty records', () => {
		expect(selectRecord(records, 'deleted.md')).toBe(records[1]);
		expect(selectRecord([records[0]], null)).toBe(records[0]);
		expect(selectRecord([], 'deleted.md')).toBeUndefined();
	});
});
