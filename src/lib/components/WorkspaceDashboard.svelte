<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button, EmptyState, Switch } from '@chienleng/stratum-ui/ui';
	import { X } from '@chienleng/stratum-ui/icons';
	import { onMount } from 'svelte';
	import {
		activeFilters,
		applyFilters,
		filterHref,
		parseFilters,
		resetFiltersHref,
		type ProjectView,
		type FilterPatch
	} from '$lib/workspace/filters';
	import {
		readStarredProjectIds,
		starredProjectsStorageKey,
		toggleStarredProjectId,
		writeStarredProjectIds,
		type StarredProjectsStorage
	} from '$lib/workspace/stars';
	import type { WorkspaceSnapshot } from '$lib/workspace/types';
	import AttentionStrip from './AttentionStrip.svelte';
	import ProjectCard from './ProjectCard.svelte';
	import ProjectTable from './ProjectTable.svelte';
	import SummaryStrip from './SummaryStrip.svelte';

	let { workspace, demo = false }: { workspace: WorkspaceSnapshot; demo?: boolean } = $props();
	let starredProjectIds = $state<Set<string>>(new Set());
	let starredStorage: StarredProjectsStorage | null = null;

	const filters = $derived(parseFilters(page.url.searchParams));
	const selections = $derived(activeFilters(filters));
	const hasFilters = $derived(selections.length > 0);
	let resultCount: HTMLSpanElement;
	const filteredProjects = $derived(applyFilters(workspace.projects, filters));
	const starredProjects = $derived(
		filteredProjects
			.filter((project) => starredProjectIds.has(project.id))
			.sort((first, second) => first.name.localeCompare(second.name))
	);
	const unstarredProjects = $derived(
		filteredProjects.filter((project) => !starredProjectIds.has(project.id))
	);
	const filteredGroups = $derived(
		[...new Set(workspace.projects.map((project) => project.group))].filter((name) =>
			unstarredProjects.some((project) => project.group === name)
		)
	);
	const storageKey = $derived(starredProjectsStorageKey(workspace));

	const viewOptions = [
		{ label: 'Grouped', value: 'grouped' },
		{ label: 'Table', value: 'table' }
	];

	onMount(() => {
		try {
			starredStorage = window.localStorage;
			starredProjectIds = readStarredProjectIds(
				starredStorage,
				storageKey,
				workspace.projects.map((project) => project.id)
			);
		} catch {
			// Keep stars available for this session when the browser blocks local storage.
			starredStorage = null;
		}
	});

	function toggleStarred(projectId: string): void {
		starredProjectIds = toggleStarredProjectId(starredProjectIds, projectId);
		if (starredStorage) writeStarredProjectIds(starredStorage, storageKey, starredProjectIds);
	}

	async function changeFilters(href: string): Promise<void> {
		// href is built from the resolved current URL by filterHref/resetFiltersHref.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(href);
		resultCount?.focus({ preventScroll: true });
	}
	function removeFilter(patch: FilterPatch): void {
		void changeFilters(filterHref(page.url, patch));
	}

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

	{#if !hasFilters}
		<AttentionStrip projects={workspace.projects} {demo} />
		<SummaryStrip {workspace} />
	{/if}

	<div class="dashboard-toolbar">
		<span
			class="result-count"
			bind:this={resultCount}
			tabindex="-1"
			role="status"
			aria-live="polite"
			aria-atomic="true"
		>
			{filteredProjects.length} of {workspace.summary.total} projects
		</span>
		<div role="group" aria-label="Project view">
			<Switch size="sm" buttons={viewOptions} selected={filters.view} onchange={setView} />
		</div>
	</div>

	{#if hasFilters}
		<section class="active-filters" aria-label="Active filters">
			<ul>
				{#each selections as selection (selection.key)}
					<li>
						<Button
							variant="outline"
							size="sm"
							class="active-filter-button"
							aria-label={`Remove ${selection.label}`}
							onclick={() => removeFilter(selection.patch)}
						>
							<span>{selection.label}</span><X size={14} aria-hidden="true" />
						</Button>
					</li>
				{/each}
			</ul>
			<Button variant="ghost" size="sm" onclick={() => changeFilters(resetFiltersHref(page.url))}
				>Reset filters</Button
			>
		</section>
	{/if}

	{#if filteredProjects.length === 0}
		<EmptyState
			title="No matching projects"
			description="Try a different search or filter combination."
			variant="card"
		/>
	{:else if filters.view === 'grouped'}
		{#if starredProjects.length > 0}
			<section class="group starred-group" aria-labelledby="group-starred">
				<div class="group-heading">
					<h2 id="group-starred">Starred</h2>
					<span>
						{starredProjects.length}
						{starredProjects.length === 1 ? 'project' : 'projects'}
					</span>
				</div>
				<div class="project-grid">
					{#each starredProjects as project (project.id)}
						<ProjectCard {project} {demo} starred ontogglestar={toggleStarred} />
					{/each}
				</div>
			</section>
		{/if}
		{#each filteredGroups as groupName (groupName)}
			{@const groupProjects = unstarredProjects.filter((project) => project.group === groupName)}
			<section class="group" aria-labelledby={`group-${groupName}`}>
				<div class="group-heading">
					<h2 id={`group-${groupName}`}>{groupName}</h2>
					<span>{groupProjects.length} {groupProjects.length === 1 ? 'project' : 'projects'}</span>
				</div>
				<div class="project-grid">
					{#each groupProjects as project (project.id)}
						<ProjectCard {project} {demo} starred={false} ontogglestar={toggleStarred} />
					{/each}
				</div>
			</section>
		{/each}
	{:else}
		<section class="group" aria-label="All matching projects">
			<ProjectTable
				projects={filteredProjects}
				{demo}
				{starredProjectIds}
				ontogglestar={toggleStarred}
			/>
		</section>
	{/if}
	{#if hasFilters}
		<details class="workspace-overview">
			<summary>Workspace overview · all {workspace.summary.total} projects</summary>
			<div class="workspace-overview-content">
				<AttentionStrip projects={workspace.projects} {demo} />
				<SummaryStrip {workspace} />
			</div>
		</details>
	{/if}
</main>
