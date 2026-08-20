import type {
	ProjectDetail,
	ProjectSnapshot,
	WorkspaceLoadResult,
	WorkspaceSnapshot
} from '$lib/workspace/types';

const git = (branch: string, subject: string, daysAgo: number) => ({
	isRepository: true,
	branch,
	dirtyFiles: 0,
	lastCommitAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
	lastCommitHash: 'd3m0abc',
	lastCommitSubject: subject,
	remoteUrl: null,
	githubUrl: null
});

const convention = [
	{ key: 'readme' as const, label: 'README', present: true },
	{ key: 'agents' as const, label: 'Agent guide', present: true },
	{ key: 'docs' as const, label: 'Documentation', present: true },
	{ key: 'metadata' as const, label: 'Project metadata', present: true },
	{ key: 'status' as const, label: 'Current status', present: true }
];

const projects: ProjectSnapshot[] = [
	{
		id: 'harbour-api',
		path: 'harbour-api',
		name: 'Harbour API',
		group: 'Products',
		summary: 'Typed service for coordinating fictional harbour operations.',
		lifecycle: 'active',
		exists: true,
		packageManager: 'pnpm',
		convention,
		conventionScore: 100,
		documentCount: 9,
		git: git('main', 'Document berth allocation workflow', 1)
	},
	{
		id: 'signal-console',
		path: 'signal-console',
		name: 'Signal Console',
		group: 'Products',
		summary: 'Operations dashboard for a fictional distributed sensor network.',
		lifecycle: 'active',
		exists: true,
		packageManager: 'npm',
		convention,
		conventionScore: 100,
		documentCount: 12,
		git: git('main', 'Add regional health summary', 3)
	},
	{
		id: 'tide-ui',
		path: 'libraries/tide-ui',
		name: 'Tide UI',
		group: 'Libraries',
		summary: 'Shared interface components for the fictional product suite.',
		lifecycle: 'maintained',
		exists: true,
		packageManager: 'pnpm',
		convention: convention.map((item) =>
			item.key === 'status' ? { ...item, present: false } : item
		),
		conventionScore: 80,
		documentCount: 6,
		git: git('main', 'Refine empty-state component', 8)
	}
];

const workspace: WorkspaceSnapshot = {
	mode: 'demo',
	name: 'Northstar Studio',
	root: 'Fictional workspace · no repository data is loaded',
	generatedAt: new Date().toISOString(),
	projects,
	summary: {
		total: projects.length,
		active: projects.filter((project) => project.lifecycle === 'active').length,
		dirty: 0,
		missing: 0,
		fullyStandardized: projects.filter((project) => project.conventionScore === 100).length
	}
};

function detail(project: ProjectSnapshot): ProjectDetail {
	return {
		project,
		documents: [
			{
				path: 'README.md',
				title: project.name,
				kind: 'readme',
				html: `<h1>${project.name}</h1><p>${project.summary}</p><h2>Development</h2><p>This fictional document demonstrates Cadence's project knowledge view.</p>`
			},
			{
				path: 'AGENTS.md',
				title: `${project.name} agent guide`,
				kind: 'agents',
				html: '<h1>Agent guide</h1><p>Read the repository documentation, preserve unrelated changes, and run the project checks before handoff.</p>'
			}
		],
		records: [
			{
				path: `projects/${project.path}/STATUS.md`,
				title: `${project.name} status`,
				kind: 'status',
				html: '<h1>Current status</h1><p>The core workflow is healthy. The next focus is clearer operational documentation.</p>',
				sourceUrl: null
			},
			{
				path: `projects/${project.path}/decisions/local-first.md`,
				title: 'Keep project knowledge local-first',
				kind: 'decision',
				html: '<h1>Keep project knowledge local-first</h1><p>Durable context remains in versioned files that people and their chosen tools can inspect.</p>',
				sourceUrl: null
			}
		],
		recentCommits: [
			{
				hash: project.git.lastCommitHash ?? 'd3m0abc',
				date: project.git.lastCommitAt ?? new Date().toISOString(),
				subject: project.git.lastCommitSubject ?? 'Update project documentation'
			}
		]
	};
}

export async function scanWorkspace(): Promise<WorkspaceSnapshot> {
	return workspace;
}

export async function loadWorkspace(): Promise<WorkspaceLoadResult> {
	return { state: 'ready', mode: 'demo', workspace };
}

export async function getProjectDetail(id: string): Promise<ProjectDetail | null> {
	const project = projects.find((candidate) => candidate.id === id);
	return project ? detail(project) : null;
}
