<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		Badge,
		Button,
		Card,
		CardContent,
		CardFooter,
		CardHeader,
		EmptyState,
		StatGrid,
		Switch,
		type BadgeVariant
	} from '@chienleng/stratum-ui/ui';
	import { SearchInput, Select, type SelectOption } from '@chienleng/stratum-ui/forms';
	import type { Lifecycle, ProjectSnapshot } from '$lib/workspace/types';

	type MetricFilter = 'registered' | 'active' | 'dirty' | 'standardized' | 'missing';
	type ProjectView = 'grouped' | 'updated';

	import type { WorkspaceSnapshot } from '$lib/workspace/types';

	let {
		workspace,
		projectBase = '/projects'
	}: { workspace: WorkspaceSnapshot; projectBase?: string } = $props();
	let search = $state('');
	let lifecycle = $state('all');
	let group = $state('all');
	let metric = $state<MetricFilter | null>(null);
	let projectView = $state<ProjectView>('grouped');

	const viewOptions = [
		{ label: 'Grouped', value: 'grouped' },
		{ label: 'Updated', value: 'updated' }
	];

	let metricOptions = $derived([
		{ label: 'Registered', value: workspace.summary.total, filter: 'registered' },
		{ label: 'Active', value: workspace.summary.active, filter: 'active' },
		{ label: 'Dirty trees', value: workspace.summary.dirty, filter: 'dirty' },
		{
			label: 'Standardized',
			value: workspace.summary.fullyStandardized,
			filter: 'standardized'
		},
		{ label: 'Missing locally', value: workspace.summary.missing, filter: 'missing' }
	] satisfies { label: string; value: number; filter: MetricFilter }[]);

	let availableGroups = $derived([...new Set(workspace.projects.map((project) => project.group))]);
	let groupOptions = $derived<SelectOption[]>([
		{ label: 'All groups', value: 'all' },
		...availableGroups.map((name) => ({ label: name, value: name }))
	]);
	const lifecycleOptions: SelectOption[] = [
		{ label: 'All lifecycles', value: 'all' },
		{ label: 'Active', value: 'active' },
		{ label: 'Maintained', value: 'maintained' },
		{ label: 'Paused', value: 'paused' },
		{ label: 'Dormant', value: 'dormant' },
		{ label: 'Unknown', value: 'unknown' }
	];
	let filteredProjects = $derived(
		workspace.projects.filter((project) => {
			const query = search.trim().toLowerCase();
			const matchesSearch =
				!query ||
				project.name.toLowerCase().includes(query) ||
				project.summary.toLowerCase().includes(query) ||
				project.path.toLowerCase().includes(query);
			return (
				matchesSearch &&
				matchesMetric(project) &&
				(lifecycle === 'all' || project.lifecycle === lifecycle) &&
				(group === 'all' || project.group === group)
			);
		})
	);
	let filteredGroups = $derived(
		availableGroups.filter((name) => filteredProjects.some((project) => project.group === name))
	);
	let updatedProjects = $derived(
		[...filteredProjects].sort((first, second) => {
			const recency = commitTimestamp(second) - commitTimestamp(first);
			return recency || first.name.localeCompare(second.name);
		})
	);

	function commitTimestamp(project: ProjectSnapshot): number {
		if (!project.git.lastCommitAt) return Number.NEGATIVE_INFINITY;
		const timestamp = Date.parse(project.git.lastCommitAt);
		return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
	}

	function relativeDate(value: string | null): string {
		if (!value) return 'No commits';
		const days = Math.round((new Date(value).getTime() - Date.now()) / 86_400_000);
		if (days === 0) return 'Today';
		return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(days, 'day');
	}

	function lifecycleVariant(value: Lifecycle): BadgeVariant {
		if (value === 'active') return 'success';
		if (value === 'maintained') return 'info';
		if (value === 'paused') return 'warning';
		return 'neutral';
	}

	function matchesMetric(project: ProjectSnapshot): boolean {
		if (metric === 'active') return project.lifecycle === 'active';
		if (metric === 'dirty') return project.git.dirtyFiles > 0;
		if (metric === 'standardized') return project.conventionScore === 100;
		if (metric === 'missing') return !project.exists;
		return true;
	}

	function toggleMetric(filter: MetricFilter): void {
		metric = metric === filter ? null : filter;
	}
</script>

<svelte:head>
	<title>Cadence — Workspace control room</title>
</svelte:head>

<main class="shell">
	<section class="hero" aria-labelledby="page-title">
		<p class="eyebrow">
			{workspace.mode === 'demo' ? 'Fictional demo' : 'Local portfolio'} · {workspace.summary.total}
			registered projects
		</p>
		<h1 id="page-title">One workspace, clearly held.</h1>
		<p class="lede">
			A visual view of independent repositories — their activity, local state, and shared project
			knowledge — kept current by you and your own agent. The files remain the source; this is the
			lens.
		</p>
	</section>

	<section class="workspace-stats" aria-label="Project metric filters">
		<StatGrid columns={5}>
			{#each metricOptions as option (option.filter)}
				<Button
					variant="outline"
					class="metric-filter"
					aria-pressed={metric === option.filter}
					onclick={() => toggleMetric(option.filter)}
				>
					<span class="metric-label">{option.label}</span>
					<span class="metric-value">{option.value}</span>
				</Button>
			{/each}
		</StatGrid>
	</section>

	<div class="toolbar" aria-label="Project filters">
		<SearchInput
			bind:value={search}
			debounce={0}
			placeholder="Search projects, paths, and purpose…"
		/>
		<Select
			selected={group}
			options={groupOptions}
			label="All groups"
			variant="field"
			onchange={(value) => (group = value)}
		/>
		<Select
			selected={lifecycle}
			options={lifecycleOptions}
			label="All lifecycles"
			variant="field"
			onchange={(value) => (lifecycle = value)}
		/>
		<fieldset class="view-toggle">
			<legend>View</legend>
			<Switch
				buttons={viewOptions}
				selected={projectView}
				size="sm"
				onchange={(value) => (projectView = value as ProjectView)}
			/>
		</fieldset>
	</div>

	{#if filteredProjects.length === 0}
		<EmptyState
			title="No matching projects"
			description="Try a different search or filter combination."
			variant="card"
		/>
	{:else if projectView === 'grouped'}
		{#each filteredGroups as groupName (groupName)}
			<section class="group" aria-labelledby={`group-${groupName}`}>
				<div class="group-heading">
					<h2 id={`group-${groupName}`}>{groupName}</h2>
					<span
						>{filteredProjects.filter((project) => project.group === groupName).length} projects</span
					>
				</div>
				<div class="project-grid">
					{#each filteredProjects.filter((project) => project.group === groupName) as project (project.id)}
						<a
							class="project-link"
							href={projectBase === '/demo/projects'
								? resolve('/demo/projects/[slug]', { slug: project.id })
								: resolve('/projects/[slug]', { slug: project.id })}
						>
							<Card class="project-card">
								<CardHeader class="project-card-header">
									<div class="project-top">
										<Badge variant={lifecycleVariant(project.lifecycle)}>{project.lifecycle}</Badge>
										{#if project.git.dirtyFiles > 0}
											<Badge variant="danger">{project.git.dirtyFiles} changed</Badge>
										{/if}
									</div>
									<h3>{project.name}</h3>
									<p>{project.summary}</p>
								</CardHeader>
								<CardContent class="project-card-content">
									<div class="project-meta">
										<span
											>{project.git.branch ??
												(project.git.isRepository ? 'Detached' : 'No Git')}</span
										>
										<span>{relativeDate(project.git.lastCommitAt)}</span>
										{#if project.packageManager}<span>{project.packageManager}</span>{/if}
									</div>
								</CardContent>
								<CardFooter class="project-card-footer">
									<span class="document-path">{project.path}</span>
									<div class="score" aria-label={`${project.conventionScore}% convention coverage`}>
										<span>{project.conventionScore}% standard</span>
										<div class="score-track">
											<div class="score-fill" style:width={`${project.conventionScore}%`}></div>
										</div>
									</div>
								</CardFooter>
							</Card>
						</a>
					{/each}
				</div>
			</section>
		{/each}
	{:else}
		<section class="group" aria-labelledby="updated-projects">
			<div class="group-heading">
				<h2 id="updated-projects">Recently updated</h2>
				<span>{updatedProjects.length} projects · newest first</span>
			</div>
			<ol class="updated-list">
				{#each updatedProjects as project (project.id)}
					<li>
						<a
							class="project-link updated-project-link"
							href={projectBase === '/demo/projects'
								? resolve('/demo/projects/[slug]', { slug: project.id })
								: resolve('/projects/[slug]', { slug: project.id })}
						>
							<Card class="updated-project-card">
								<CardContent class="updated-project-content">
									<div class="updated-project-identity">
										<div class="project-top">
											<Badge variant={lifecycleVariant(project.lifecycle)}
												>{project.lifecycle}</Badge
											>
											{#if project.git.dirtyFiles > 0}
												<Badge variant="danger">{project.git.dirtyFiles} changed</Badge>
											{/if}
										</div>
										<h3>{project.name}</h3>
										<span class="document-path">{project.path}</span>
									</div>
									<p class="updated-project-summary">{project.summary}</p>
									<div class="updated-project-activity">
										<span>Last commit</span>
										<strong>{relativeDate(project.git.lastCommitAt)}</strong>
										<span
											>{project.git.branch ??
												(project.git.isRepository ? 'Detached' : 'No Git')}</span
										>
									</div>
								</CardContent>
							</Card>
						</a>
					</li>
				{/each}
			</ol>
		</section>
	{/if}

	<p class="path-note">
		Snapshot {new Date(workspace.generatedAt).toLocaleString()} · {workspace.root}
	</p>
</main>
