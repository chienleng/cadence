import { githubTotals, judgmentConfirmed } from './data-quality';
import { shownByDefault } from './filters';
import type { ProjectSnapshot, WorkspaceSnapshot } from './types';

/** Archived projects are kept for reference and left out of every count but total. */
export function workspaceSummary(projects: ProjectSnapshot[]): WorkspaceSnapshot['summary'] {
	const counted = projects.filter(shownByDefault);
	return {
		total: projects.length,
		archived: projects.length - counted.length,
		active: counted.filter((project) => project.lifecycle === 'active').length,
		dirty: counted.filter((project) => (project.git.dirtyFiles ?? 0) > 0).length,
		missing: counted.filter((project) => !project.exists).length,
		fullyStandardized: counted.filter((project) => project.conventionScore === 100).length,
		behindUpstream: counted.filter((project) => (project.git.behind ?? 0) > 0).length,
		staleStatus: counted.filter((project) => project.status.stale).length,
		judgedStatus: counted.filter((project) => judgmentConfirmed(project.status.judgment)).length,
		openIssues: githubTotals(counted).issues.value,
		openPullRequests: githubTotals(counted).prs.value
	};
}
