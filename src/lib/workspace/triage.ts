import type { ProjectSnapshot } from './types';

export interface AttentionReason {
	key: 'dirty' | 'ahead' | 'behind' | 'prs' | 'stale';
	label: string;
}

function staleLabel(updatedAt: string | null, now: Date): string {
	if (!updatedAt) return 'STATUS undated';
	const updated = Date.parse(`${updatedAt}T00:00:00Z`);
	if (Number.isNaN(updated)) return 'STATUS undated';
	const days = Math.max(0, Math.floor((now.getTime() - updated) / 86_400_000));
	return `STATUS stale ${days}d`;
}

/**
 * Why a project needs the owner's attention, in triage order: uncommitted
 * work, then unpushed commits, then divergence from upstream, then open
 * pull requests, then a stale status record.
 */
export function attentionReasons(project: ProjectSnapshot, now = new Date()): AttentionReason[] {
	const reasons: AttentionReason[] = [];
	if (project.git.dirtyFiles > 0) {
		reasons.push({ key: 'dirty', label: `${project.git.dirtyFiles} uncommitted` });
	}
	if ((project.git.ahead ?? 0) > 0) {
		reasons.push({ key: 'ahead', label: `↑${project.git.ahead} unpushed` });
	}
	if ((project.git.behind ?? 0) > 0) {
		reasons.push({ key: 'behind', label: `↓${project.git.behind} behind` });
	}
	const pullRequests = project.github.openPullRequests ?? 0;
	if (pullRequests > 0) {
		reasons.push({ key: 'prs', label: `${pullRequests} open PR${pullRequests === 1 ? '' : 's'}` });
	}
	if (project.status.stale) {
		reasons.push({ key: 'stale', label: staleLabel(project.status.updatedAt, now) });
	}
	return reasons;
}

const WEIGHTS: Record<AttentionReason['key'], number> = {
	dirty: 16,
	ahead: 8,
	behind: 4,
	prs: 2,
	stale: 1
};

/** Higher = more urgent; 0 = nothing outstanding. */
export function attentionRank(project: ProjectSnapshot, now = new Date()): number {
	return attentionReasons(project, now).reduce((rank, reason) => rank + WEIGHTS[reason.key], 0);
}
