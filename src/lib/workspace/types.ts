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
	dirtyFiles: number;
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

/** GitHub data comes from the refresh cache; 'absent' means render nothing. */
export interface GithubSnapshot {
	state: 'ok' | 'absent';
	fetchedAt: string | null;
	isPrivate: boolean | null;
	openIssues: number | null;
	openPullRequests: number | null;
	latestRelease: GithubRelease | null;
}

export interface StatusFreshness {
	present: boolean;
	updatedAt: string | null;
	/** True when STATUS.md exists but is undated or older than 30 days. */
	stale: boolean;
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
	summary: {
		total: number;
		active: number;
		dirty: number;
		missing: number;
		fullyStandardized: number;
		behindUpstream: number;
		staleStatus: number;
		openIssues: number;
		openPullRequests: number;
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
	documents: ProjectDocument[];
	records: ProjectRecord[];
	recentCommits: RecentCommit[];
}
