export type Lifecycle = 'active' | 'maintained' | 'paused' | 'dormant' | 'archived' | 'unknown';

export interface ProjectDefinition {
	path: string;
	name: string;
	group: string;
	summary: string;
	lifecycle: Lifecycle;
	owners?: string[];
	tags?: string[];
}

export interface WorkspaceConfig {
	schemaVersion: number;
	name: string;
	workspaceRoot: string;
}

export type WorkspaceMode = 'local' | 'demo';

export type WorkspaceLoadResult =
	| { state: 'ready'; mode: WorkspaceMode; workspace: WorkspaceSnapshot }
	| { state: 'setup'; mode: 'local'; dataRoot: string }
	| { state: 'invalid'; mode: 'local'; dataRoot: string; errors: string[] };

export interface ConventionCheck {
	key: 'readme' | 'agents' | 'docs' | 'metadata' | 'status';
	label: string;
	present: boolean;
}

export interface GitSnapshot {
	isRepository: boolean;
	branch: string | null;
	/** null means the working tree could not be inspected or is not a repository. */
	dirtyFiles: number | null;
	lastCommitAt: string | null;
	lastCommitHash: string | null;
	lastCommitSubject: string | null;
	remoteUrl: string | null;
	githubUrl: string | null;
	/** Commits ahead of upstream; null when there is no upstream to compare. */
	ahead: number | null;
	/** Commits behind upstream; null when there is no upstream to compare. */
	behind: number | null;
	/** Commit counts per week over the recent past, oldest week first. */
	commitsByWeek: number[];
}

export interface GithubRelease {
	name: string;
	tagName: string;
	url: string;
	publishedAt: string;
}

/** GitHub data comes from the refresh cache; missing counts are never confirmed zeros. */
export interface GithubSnapshot {
	state: 'ok' | 'stale' | 'failed' | 'unavailable' | 'absent' | 'not-applicable';
	fetchedAt: string | null;
	isPrivate: boolean | null;
	openIssues: number | null;
	openPullRequests: number | null;
	latestRelease: GithubRelease | null;
}

/** Jev (TypeSafe) reading of STATUS.md from the refresh cache. Items are
 *  verbatim lines from the file, ordered by judged actionability. */
export interface StatusJudgment {
	/** confirmed: computed from the current file text. stale: the file changed
	 *  since. failed/absent/unavailable/not-applicable mirror GitHub states. */
	state: 'confirmed' | 'stale' | 'failed' | 'absent' | 'unavailable' | 'not-applicable';
	judgedAt: string | null;
	model: string | null;
	sections: { current: string[]; next: string[]; risks: string[] } | null;
	/** Probability that the status declares the project parked or in maintenance mode. */
	parked: number | null;
}

export interface StatusFreshness {
	present: boolean;
	updatedAt: string | null;
	/** True when STATUS.md exists but is undated or older than 30 days. */
	stale: boolean;
	/** Where updatedAt came from: the Updated: line, or a confirmed judgment
	 *  when that line could not be read by convention. */
	updatedAtSource: 'convention' | 'judged' | null;
	judgment: StatusJudgment;
}

export interface ProjectSnapshot extends ProjectDefinition {
	id: string;
	exists: boolean;
	packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun' | null;
	convention: ConventionCheck[];
	conventionScore: number;
	documentCount: number;
	git: GitSnapshot;
	github: GithubSnapshot;
	status: StatusFreshness;
}

export interface WorkspaceSnapshot {
	mode: WorkspaceMode;
	name: string;
	root: string;
	generatedAt: string;
	projects: ProjectSnapshot[];
	/** Counts other than total and archived exclude archived projects. */
	summary: {
		total: number;
		archived: number;
		active: number;
		dirty: number;
		missing: number;
		fullyStandardized: number;
		behindUpstream: number;
		staleStatus: number;
		judgedStatus: number;
		openIssues: number | null;
		openPullRequests: number | null;
	};
}

export interface ProjectDocument {
	path: string;
	title: string;
	kind:
		| 'readme'
		| 'agents'
		| 'status'
		| 'plan'
		| 'decision'
		| 'meeting'
		| 'note'
		| 'inbox'
		| 'documentation';
	html: string;
}

export type ProjectRecordKind = 'status' | 'plan' | 'decision' | 'meeting' | 'note' | 'inbox';

export interface ProjectRecord {
	path: string;
	title: string;
	kind: ProjectRecordKind;
	html: string;
	sourceUrl: string | null;
}

export interface RecentCommit {
	hash: string;
	date: string;
	subject: string;
}

export interface ProjectDetail {
	project: ProjectSnapshot;
	documents: Omit<ProjectDocument, 'html'>[];
	records: Omit<ProjectRecord, 'html'>[];
	selectedDocument: ProjectDocument | null;
	selectedRecord: ProjectRecord | null;
	recentCommits: RecentCommit[];
}

export interface PreviewSelection {
	record?: string | null;
	document?: string | null;
}
