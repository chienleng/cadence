<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { EmptyState, SwitchTabs } from '@chienleng/stratum-ui/ui';
	import { applyFilters, filterHref, parseFilters, type ProjectView } from '$lib/workspace/filters';
	import type { WorkspaceSnapshot } from '$lib/workspace/types';
	import AttentionStrip from './AttentionStrip.svelte';
	import ProjectCard from './ProjectCard.svelte';
	import ProjectTable from './ProjectTable.svelte';
	import SummaryStrip from './SummaryStrip.svelte';

	let { workspace, demo = false }: { workspace: WorkspaceSnapshot; demo?: boolean } = $props();

	const filters = $derived(parseFilters(page.url.searchParams));
	const filteredProjects = $derived(applyFilters(workspace.projects, filters));
	const filteredGroups = $derived(
		[...new Set(workspace.projects.map((project) => project.group))].filter((name) =>
			filteredProjects.some((project) => project.group === name)
		)
	);

	const viewOptions = [
		{ label: 'Grouped', value: 'grouped' },
		{ label: 'Table', value: 'table' }
	];

	function setView(value: string): void {
		// filterHref patches query params onto the already-resolved current path.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(filterHref(page.url, { view: value as ProjectView }), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}
</script>

<svelte:head>
	<title>Cadence — Workspace control room</title>
</svelte:head>

<main class="shell dashboard-shell">
	<h1 class="visually-hidden">
		{workspace.mode === 'demo' ? 'Fictional demo projects' : 'Workspace projects'}
	</h1>

	<AttentionStrip projects={workspace.projects} {demo} />
	<SummaryStrip {workspace} />

	<div class="dashboard-toolbar">
		<span class="result-count">
			{filteredProjects.length} of {workspace.summary.total} projects
		</span>
		<SwitchTabs buttons={viewOptions} selected={filters.view} onchange={setView} />
	</div>

	{#if filteredProjects.length === 0}
		<EmptyState
			title="No matching projects"
			description="Try a different search or filter combination."
			variant="card"
		/>
	{:else if filters.view === 'grouped'}
		{#each filteredGroups as groupName (groupName)}
			{@const groupProjects = filteredProjects.filter((project) => project.group === groupName)}
			<section class="group" aria-labelledby={`group-${groupName}`}>
				<div class="group-heading">
					<h2 id={`group-${groupName}`}>{groupName}</h2>
					<span>{groupProjects.length} {groupProjects.length === 1 ? 'project' : 'projects'}</span>
				</div>
				<div class="project-grid">
					{#each groupProjects as project (project.id)}
						<ProjectCard {project} {demo} />
					{/each}
				</div>
			</section>
		{/each}
	{:else}
		<section class="group" aria-label="All matching projects">
			<ProjectTable projects={filteredProjects} {demo} />
		</section>
	{/if}
</main>
