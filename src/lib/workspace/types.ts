export type Lifecycle = 'active' | 'maintained' | 'paused' | 'dormant' | 'unknown';

export interface ProjectDefinition {
	path: string;
	name: string;
	group: string;
	summary: string;
	lifecycle: Lifecycle;
	priority?: 'low' | 'normal' | 'high';
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
}

export interface ProjectSnapshot extends ProjectDefinition {
	id: string;
	exists: boolean;
	packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun' | null;
	convention: ConventionCheck[];
	conventionScore: number;
	documentCount: number;
	git: GitSnapshot;
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
