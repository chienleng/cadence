// STATUS.md freshness convention, shared with scripts/context.mjs: a status
// records its date as a literal "Updated: YYYY-MM-DD" line and goes stale
// after 30 days.

export function statusDate(source: string | null): string | null {
	return source?.match(/^Updated:\s*(\d{4}-\d{2}-\d{2})$/m)?.[1] ?? null;
}

export function staleStatus(
	updatedAt: string | null,
	now = new Date(),
	staleAfterDays = 30
): boolean {
	if (!updatedAt) return true;
	const updated = new Date(`${updatedAt}T00:00:00Z`);
	return (
		!Number.isFinite(updated.getTime()) ||
		now.getTime() - updated.getTime() > staleAfterDays * 86_400_000
	);
}
