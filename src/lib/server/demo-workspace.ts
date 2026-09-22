import { selectRecord } from '$lib/workspace/navigation';
import { EMPTY_JUDGMENT } from '$lib/workspace/data-quality';
import { workspaceSummary } from '$lib/workspace/summary';
import type {
	GithubSnapshot,
	GitSnapshot,
	ProjectDetail,
	PreviewSelection,
	ProjectSnapshot,
	StatusFreshness,
	StatusJudgment,
	WorkspaceLoadResult,
	WorkspaceSnapshot
} from '$lib/workspace/types';

const git = (
	branch: string,
	subject: string,
	daysAgo: number,
	options: Partial<Pick<GitSnapshot, 'dirtyFiles' | 'ahead' | 'behind' | 'commitsByWeek'>> = {}
): GitSnapshot => ({
	isRepository: true,
	branch,
	dirtyFiles: options.dirtyFiles ?? 0,
	lastCommitAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
	lastCommitHash: 'd3m0abc',
	lastCommitSubject: subject,
	remoteUrl: null,
	githubUrl: null,
	ahead: options.ahead ?? 0,
	behind: options.behind ?? 0,
	commitsByWeek: options.commitsByWeek ?? [0, 1, 0, 2, 1, 3, 2, 4, 3, 5, 4, 6]
});

const ABSENT_GITHUB: GithubSnapshot = {
	state: 'absent',
	fetchedAt: null,
	isPrivate: null,
	openIssues: null,
	openPullRequests: null,
	latestRelease: null
};

const github = (
	openIssues: number,
	openPullRequests: number,
	options: Partial<Omit<GithubSnapshot, 'state' | 'openIssues' | 'openPullRequests'>> = {}
): GithubSnapshot => ({
	state: 'ok',
	fetchedAt: new Date(Date.now() - 3_600_000).toISOString(),
	isPrivate: options.isPrivate ?? false,
	openIssues,
	openPullRequests,
	latestRelease: options.latestRelease ?? null
});

const judged = (
	parked: number,
	sections: NonNullable<StatusJudgment['sections']>
): StatusJudgment => ({
	state: 'confirmed',
	judgedAt: new Date(Date.now() - 3_600_000).toISOString(),
	model: 'jev-1.13.0',
	sections,
	parked
});

const status = (daysAgo: number, judgment: StatusJudgment = EMPTY_JUDGMENT): StatusFreshness => {
	const updatedAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
	return {
		present: true,
		updatedAt,
		stale: daysAgo > 30,
		updatedAtSource: 'convention',
		judgment
	};
};

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
		tags: ['typescript', 'api'],
		exists: true,
		packageManager: 'pnpm',
		convention,
		conventionScore: 100,
		documentCount: 9,
		git: git('main', 'Document berth allocation workflow', 1, {
			commitsByWeek: [2, 3, 1, 4, 2, 5, 3, 4, 6, 3, 5, 7]
		}),
		github: github(4, 1, {
			latestRelease: {
				name: 'Harbour API v1.4.0',
				tagName: 'v1.4.0',
				url: 'https://example.com/harbour-api/releases/v1.4.0',
				publishedAt: new Date(Date.now() - 6 * 86_400_000).toISOString()
			}
		}),
		status: status(
			3,
			judged(0.08, {
				current: [
					'Berth allocation API is live behind the feature flag; the harbour master pilot starts next week.',
					'Contract tests cover every published endpoint after the v1.4.0 release.',
					'The service has run without incident since the pilot cutover.'
				],
				next: [
					'Remove the feature flag once the pilot signs off.',
					'Document the berth allocation workflow for the operations team.'
				],
				risks: ['Tide tables come from an external feed with no uptime guarantee.']
			})
		)
	},
	{
		id: 'signal-console',
		path: 'signal-console',
		name: 'Signal Console',
		group: 'Products',
		summary: 'Operations dashboard for a fictional distributed sensor network.',
		lifecycle: 'active',
		tags: ['dashboard', 'realtime'],
		exists: true,
		packageManager: 'npm',
		convention,
		conventionScore: 100,
		documentCount: 12,
		git: git('main', 'Add regional health summary', 3, {
			dirtyFiles: 2,
			ahead: 2,
			commitsByWeek: [0, 0, 1, 0, 2, 1, 0, 3, 2, 4, 1, 2]
		}),
		github: github(2, 0, { isPrivate: true }),
		status: status(5, {
			...EMPTY_JUDGMENT,
			state: 'failed',
			judgedAt: new Date(Date.now() - 3_600_000).toISOString(),
			model: 'jev-latest'
		})
	},
	{
		id: 'tide-ui',
		path: 'libraries/tide-ui',
		name: 'Tide UI',
		group: 'Libraries',
		summary: 'Shared interface components for the fictional product suite.',
		lifecycle: 'maintained',
		tags: ['components'],
		exists: true,
		packageManager: 'pnpm',
		convention: convention.map((item) =>
			item.key === 'status' ? { ...item, present: false } : item
		),
		conventionScore: 80,
		documentCount: 6,
		git: git('main', 'Refine empty-state component', 8, {
			behind: 3,
			commitsByWeek: [3, 2, 4, 1, 2, 1, 0, 1, 0, 0, 1, 0]
		}),
		github: ABSENT_GITHUB,
		status: status(
			60,
			judged(0.86, {
				current: [
					'Version 2.3.0 shipped the empty-state component and closed the component request backlog.',
					'The library is in maintenance: no feature work is planned until the design refresh lands.'
				],
				next: ['Adopt the new design tokens when the product suite refresh is approved.'],
				risks: ['Consumers pin exact versions, so releases need coordinated upgrades.']
			})
		)
	}
];

const workspace: WorkspaceSnapshot = {
	mode: 'demo',
	name: 'Northstar Studio',
	root: 'Fictional workspace · no repository data is loaded',
	generatedAt: new Date().toISOString(),
	projects,
	summary: workspaceSummary(projects)
};

function detail(project: ProjectSnapshot) {
	return {
		project,
		documents: [
			{
				path: 'README.md',
				title: project.name,
				kind: 'readme' as const,
				html: `<h1>${project.name}</h1><p>${project.summary}</p><h2>Development</h2><p>This fictional document demonstrates Cadence's project knowledge view.</p>`
			},
			{
				path: 'AGENTS.md',
				title: `${project.name} agent guide`,
				kind: 'agents' as const,
				html: '<h1>Agent guide</h1><p>Read the repository documentation, preserve unrelated changes, and run the project checks before handoff.</p>'
			}
		],
		records: [
			{
				path: `projects/${project.path}/STATUS.md`,
				title: `${project.name} status`,
				kind: 'status' as const,
				html: '<h1>Current status</h1><p>The core workflow is healthy. The next focus is clearer operational documentation.</p>',
				sourceUrl: null
			},
			{
				path: `projects/${project.path}/decisions/local-first.md`,
				title: 'Keep project knowledge local-first',
				kind: 'decision' as const,
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

export async function getProjectDetail(
	id: string,
	selection: PreviewSelection = {}
): Promise<ProjectDetail | null> {
	const project = projects.find((candidate) => candidate.id === id);
	if (!project) return null;
	const full = detail(project);
	const selectedRecord = selectRecord(full.records, selection.record ?? null) ?? null;
	const selectedDocument =
		full.documents.find((item) => item.path === selection.document) ?? full.documents[0] ?? null;
	return {
		...full,
		records: full.records.map(({ path, title, kind, sourceUrl }) => ({
			path,
			title,
			kind,
			sourceUrl
		})),
		documents: full.documents.map(({ path, title, kind }) => ({ path, title, kind })),
		selectedRecord,
		selectedDocument
	};
}
