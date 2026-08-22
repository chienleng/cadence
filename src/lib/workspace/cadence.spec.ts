import { describe, expect, it } from 'vitest';
import { CADENCE_WEEKS, weeklyCommitBuckets } from './cadence';

describe('weeklyCommitBuckets', () => {
	const now = new Date('2026-08-22T00:00:00Z');

	it('buckets commits into weeks, oldest first', () => {
		const buckets = weeklyCommitBuckets(
			[
				'2026-08-21T10:00:00Z', // this week
				'2026-08-20T10:00:00Z', // this week
				'2026-08-10T10:00:00Z', // ~2 weeks ago
				'2026-05-20T10:00:00Z' // ~13 weeks ago, outside window
			],
			now
		);
		expect(buckets).toHaveLength(CADENCE_WEEKS);
		expect(buckets.at(-1)).toBe(2);
		expect(buckets.at(-2)).toBe(1);
		expect(buckets.reduce((total, count) => total + count, 0)).toBe(3);
	});

	it('drops unparseable and future dates', () => {
		const buckets = weeklyCommitBuckets(['garbage', '2027-01-01T00:00:00Z'], now);
		expect(buckets.every((count) => count === 0)).toBe(true);
	});

	it('returns all zeroes for no commits', () => {
		expect(weeklyCommitBuckets([], now)).toEqual(new Array(CADENCE_WEEKS).fill(0));
	});
});
