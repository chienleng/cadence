import { resolve } from '$app/paths';
import type { BadgeVariant } from '@chienleng/stratum-ui/ui';
import type { Lifecycle, ProjectSnapshot } from './types';

export function commitTimestamp(project: ProjectSnapshot): number {
	if (!project.git.lastCommitAt) return Number.NEGATIVE_INFINITY;
	const timestamp = Date.parse(project.git.lastCommitAt);
	return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function relativeDate(value: string | null): string {
	if (!value) return 'No commits';
	const days = Math.round((new Date(value).getTime() - Date.now()) / 86_400_000);
	if (days === 0) return 'Today';
	return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(days, 'day');
}

export function lifecycleVariant(value: Lifecycle): BadgeVariant {
	if (value === 'active') return 'success';
	if (value === 'maintained') return 'info';
	if (value === 'paused') return 'warning';
	return 'neutral';
}

/** Detail-page link for a project; `resolve` needs the route ids as literals. */
export function projectHref(id: string, demo: boolean): string {
	return demo
		? resolve('/demo/projects/[slug]', { slug: id })
		: resolve('/projects/[slug]', { slug: id });
}
