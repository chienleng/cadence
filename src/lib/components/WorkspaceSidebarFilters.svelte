<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ChipGroup, MultiSelect, SearchInput } from '@chienleng/stratum-ui/forms';
	import { Button } from '@chienleng/stratum-ui/ui';
	import { X } from '@chienleng/stratum-ui/icons';
	import {
		filterHref,
		applyFilters,
		activeFilters,
		resetFiltersHref,
		parseFilters,
		type FilterPatch,
		type MetricFilter
	} from '$lib/workspace/filters';
	import type { WorkspaceSnapshot } from '$lib/workspace/types';

	type FacetKey = 'groups' | 'lifecycles' | 'tags';
	interface Facet {
		key: FacetKey;
		label: string;
		allLabel: string;
		options: { label: string; value: string }[];
		selected: string[];
	}

	let {
		workspace,
		announceResults = false
	}: { workspace: WorkspaceSnapshot; announceResults?: boolean } = $props();

	const filters = $derived(parseFilters(page.url.searchParams));

	// Deriving from the URL keeps the input in sync with external changes
	// (e.g. "Clear all filters"); typing writes a local override via bind.
	let searchValue = $derived(filters.query);

	const groupOptions = $derived(
		[...new Set(workspace.projects.map((project) => project.group))]
			.sort()
			.map((name) => ({ label: name, value: name }))
	);
	const tagOptions = $derived(
		[...new Set(workspace.projects.flatMap((project) => project.tags ?? []))]
			.sort()
			.map((tag) => ({ label: tag, value: tag }))
	);
	const lifecycleOptions = [
		{ label: 'Active', value: 'active' },
		{ label: 'Maintained', value: 'maintained' },
		{ label: 'Paused', value: 'paused' },
		{ label: 'Dormant', value: 'dormant' },
		{ label: 'Archived', value: 'archived' },
		{ label: 'Unknown', value: 'unknown' }
	];
	const metricOptions: { label: string; value: MetricFilter }[] = [
		{ label: 'Needs attention', value: 'attention' },
		{ label: 'Dirty', value: 'dirty' },
		{ label: 'Behind · local refs', value: 'behind' },
		{ label: 'Stale status', value: 'stale' },
		{ label: 'Missing status', value: 'missing-status' },
		{ label: 'Standardized', value: 'standardized' },
		{ label: 'Missing', value: 'missing' }
	];

	const facets = $derived<Facet[]>(
		[
			{
				key: 'groups' as const,
				label: 'Group',
				allLabel: 'All groups',
				options: groupOptions,
				selected: filters.groups
			},
			{
				key: 'lifecycles' as const,
				label: 'Lifecycle',
				allLabel: 'All lifecycles',
				options: lifecycleOptions,
				selected: filters.lifecycles
			},
			{
				key: 'tags' as const,
				label: 'Tags',
				allLabel: 'All tags',
				options: tagOptions,
				selected: filters.tags
			}
		].filter((facet) => facet.options.length > 1)
	);

	const hasFilters = $derived(activeFilters(filters).length > 0);

	function apply(patch: FilterPatch): void {
		// filterHref patches query params onto the already-resolved current path.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(filterHref(page.url, patch), { replaceState: true, keepFocus: true });
	}

	function applyMetric(values: string[]): void {
		const next = values.find((value) => value !== filters.metric) as MetricFilter | undefined;
		apply({ metric: next ?? null });
	}

	function labelFor(facet: Facet, value: string): string {
		return facet.options.find((option) => option.value === value)?.label ?? value;
	}

	function removeValue(facet: Facet, value: string): void {
		apply({ [facet.key]: facet.selected.filter((item) => item !== value) });
	}
</script>

<div class="sidebar-filters">
	<SearchInput
		bind:value={searchValue}
		debounce={300}
		placeholder="Search projects…"
		onsearch={(value) => apply({ query: value })}
	/>

	{#if announceResults}<p class="filter-result-count" role="status" aria-atomic="true">
			{applyFilters(workspace.projects, filters).length} of {workspace.summary.total} projects
		</p>{/if}

	<fieldset class="filter-section">
		<legend class="meta-label">Focus</legend>
		<ChipGroup
			options={metricOptions}
			selected={filters.metric ? [filters.metric] : []}
			onchange={applyMetric}
		/>
	</fieldset>

	{#each facets as facet (facet.key)}
		<fieldset class="filter-section">
			<legend class="meta-label">{facet.label}</legend>
			<MultiSelect
				compact
				label={facet.selected.length ? `${facet.selected.length} selected` : facet.allLabel}
				options={facet.options}
				selected={facet.selected}
				onchange={(values) => apply({ [facet.key]: values })}
			/>
			{#if facet.selected.length > 0}
				<ul class="filter-tags">
					{#each facet.selected as value (value)}
						<li>
							<button
								type="button"
								class="filter-tag"
								onclick={() => removeValue(facet, value)}
								aria-label={`Remove ${facet.label.toLowerCase()} filter ${labelFor(facet, value)}`}
							>
								<span>{labelFor(facet, value)}</span>
								<X size={12} aria-hidden="true" />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</fieldset>
	{/each}

	{#if hasFilters}
		<Button variant="ghost" size="sm" href={resetFiltersHref(page.url)}>Reset filters</Button>
	{/if}
</div>
