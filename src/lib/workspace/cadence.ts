/** Weeks of commit history shown in the per-project cadence sparkline. */
export const CADENCE_WEEKS = 12;

const WEEK_MS = 7 * 86_400_000;

/**
 * Buckets commit dates into per-week counts covering the `weeks` weeks up to
 * `now`, oldest week first. Dates outside the window (or unparseable) are
 * dropped.
 */
export function weeklyCommitBuckets(
	dates: string[],
	now = new Date(),
	weeks = CADENCE_WEEKS
): number[] {
	const buckets = new Array<number>(weeks).fill(0);
	const end = now.getTime();
	for (const value of dates) {
		const time = Date.parse(value);
		if (Number.isNaN(time) || time > end) continue;
		const weeksAgo = Math.floor((end - time) / WEEK_MS);
		if (weeksAgo >= weeks) continue;
		buckets[weeks - 1 - weeksAgo] += 1;
	}
	return buckets;
}
