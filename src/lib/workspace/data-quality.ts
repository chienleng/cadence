import type {
	GithubSnapshot,
	GitSnapshot,
	ProjectSnapshot,
	StatusFreshness,
	StatusJudgment
} from './types';

export const EMPTY_GITHUB: GithubSnapshot = {
	state: 'absent',
	fetchedAt: null,
	isPrivate: null,
	openIssues: null,
	openPullRequests: null,
	latestRelease: null
};

export const EMPTY_JUDGMENT: StatusJudgment = {
	state: 'absent',
	judgedAt: null,
	model: null,
	sections: null,
	parked: null
};

/** A parked probability at or above this reads as "looks parked". */
export const PARKED_THRESHOLD = 0.7;

export function judgmentConfirmed(judgment: StatusJudgment): boolean {
	return judgment.state === 'confirmed' && judgment.sections !== null;
}

export function looksParked(status: StatusFreshness): boolean {
	return (
		status.judgment.state === 'confirmed' &&
		status.judgment.parked !== null &&
		status.judgment.parked >= PARKED_THRESHOLD
	);
}

export function judgmentLabel(judgment: StatusJudgment): string {
	return {
		confirmed: 'Judged reading cached',
		stale: 'Judged reading outdated',
		failed: 'Judgment failed',
		unavailable: 'Judgment unavailable',
		absent: 'Not judged',
		'not-applicable': 'Nothing to judge'
	}[judgment.state];
}

export const JUDGMENT_DESCRIPTION =
	'Section roles, item order and the parked signal (an explicit maintenance-mode or on-hold statement) come from a cached Jev (TypeSafe) reading of STATUS.md made by pnpm refresh. The file text is shown unchanged.';

/** GitHub snapshots older than 24 hours (or without a trustworthy date) are stale. */
export function staleGithub(fetchedAt: string | null, now = Date.now()): boolean {
	const time = fetchedAt ? Date.parse(fetchedAt) : NaN;
	return !Number.isFinite(time) || time > now || now - time > 86_400_000;
}

export function githubHasData(github: GithubSnapshot): boolean {
	return github.state === 'ok' || github.state === 'stale';
}

export function githubLabel(github: GithubSnapshot): string {
	if (github.state === 'ok' && (github.openIssues === null || github.openPullRequests === null)) {
		return 'GitHub data incomplete';
	}
	return {
		ok: 'GitHub cached',
		stale: 'GitHub stale',
		failed: 'GitHub refresh failed',
		unavailable: 'GitHub unavailable',
		absent: 'GitHub not refreshed',
		'not-applicable': 'No GitHub remote'
	}[github.state];
}

export function githubDate(value: string): string {
	return new Date(value).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}

export function githubTimestamp(github: GithubSnapshot): string {
	if (!github.fetchedAt) return 'No refresh date available';
	return `${githubHasData(github) ? 'Data from' : 'Last attempt'} ${githubDate(github.fetchedAt)}`;
}

/** Timestamp plus the failure reason, for hover text and detail rows. */
export function githubDetail(github: GithubSnapshot): string {
	const reason = github.state === 'failed' && github.error ? ` · ${github.error}` : '';
	return `${githubTimestamp(github)}${reason}`;
}

export function githubTotals(projects: ProjectSnapshot[]) {
	const expected = projects.filter((project) => project.github.state !== 'not-applicable');
	function total(field: 'openIssues' | 'openPullRequests') {
		const known = expected.filter(
			(project) => githubHasData(project.github) && project.github[field] !== null
		);
		return {
			value: known.length ? known.reduce((sum, project) => sum + project.github[field]!, 0) : null,
			known: known.length,
			expected: expected.length,
			partial: known.length < expected.length,
			stale: known.some((project) => project.github.state === 'stale')
		};
	}
	return { issues: total('openIssues'), prs: total('openPullRequests') };
}

export function gitBranchLabel(project: ProjectSnapshot): string {
	if (!project.exists) return 'Missing locally';
	if (!project.git.isRepository) return 'No Git repository';
	return project.git.branch === '' ? 'Detached HEAD' : (project.git.branch ?? 'Branch unavailable');
}

export function unknownWorkingTree(project: ProjectSnapshot): boolean {
	return project.exists && project.git.isRepository && project.git.dirtyFiles === null;
}

export const LOCAL_REFS_DESCRIPTION =
	'Ahead/behind compares locally known upstream refs. Cadence does not fetch or check the live remote.';

export function upstreamLabel(git: Pick<GitSnapshot, 'ahead' | 'behind'>): string {
	if (git.ahead === null && git.behind === null) return 'Comparison unavailable';
	if (git.ahead === 0 && git.behind === 0) return 'Matches local upstream';
	return `${git.ahead ?? 'Unknown'} ahead · ${git.behind ?? 'Unknown'} behind · local refs`;
}
