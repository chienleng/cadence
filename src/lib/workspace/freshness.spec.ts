import { describe, expect, it } from 'vitest';
import { staleStatus, statusDate } from './freshness';

describe('statusDate', () => {
	it('extracts a literal Updated line', () => {
		expect(statusDate('# Status\n\nUpdated: 2026-08-20\n\nAll good.')).toBe('2026-08-20');
	});

	it('ignores dates that are not on their own Updated line', () => {
		expect(statusDate('# Status\n\nLast touched 2026-08-20.')).toBeNull();
		expect(statusDate(null)).toBeNull();
	});
});

describe('staleStatus', () => {
	const now = new Date('2026-08-22T00:00:00Z');

	it('treats a recent date as fresh', () => {
		expect(staleStatus('2026-08-01', now)).toBe(false);
	});

	it('treats an old date as stale', () => {
		expect(staleStatus('2026-06-01', now)).toBe(true);
	});

	it('treats undated or unparseable statuses as stale', () => {
		expect(staleStatus(null, now)).toBe(true);
		expect(staleStatus('not-a-date', now)).toBe(true);
	});
});
