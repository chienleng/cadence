<script lang="ts">
	import { page } from '$app/state';
	import { metricHref, parseFilters } from '$lib/workspace/filters';
	import { projectHref } from '$lib/workspace/format';
	import { attentionRank, attentionReasons } from '$lib/workspace/triage';
	import type { ProjectSnapshot } from '$lib/workspace/types';

	let { projects, demo = false }: { projects: ProjectSnapshot[]; demo?: boolean } = $props();

	// Keep the triage strip scannable; the full list is one click away.
	const MAX_ROWS = 8;

	const filters = $derived(parseFilters(page.url.searchParams));
	const items = $derived(
		projects
			.map((project) => ({
				project,
				reasons: attentionReasons(project),
				rank: attentionRank(project)
			}))
			.filter((item) => item.reasons.length > 0)
			.sort((a, b) => b.rank - a.rank || a.project.name.localeCompare(b.project.name))
	);
	const visible = $derived(items.slice(0, MAX_ROWS));
	const hiddenCount = $derived(items.length - visible.length);
</script>

{#if items.length > 0 && filters.metric !== 'attention'}
	<section class="attention-strip" aria-labelledby="attention-heading">
		<div class="group-heading">
			<h2 id="attention-heading">Needs attention</h2>
			<span>
				{#if hiddenCount > 0}
					<!-- metricHref patches query params onto the already-resolved current path. -->
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a class="attention-more" href={metricHref(page.url, 'attention', filters.metric)}>
						View all {items.length} →
					</a>
				{:else}
					{items.length} {items.length === 1 ? 'project' : 'projects'}
				{/if}
			</span>
		</div>
		<ol class="attention-list">
			{#each visible as { project, reasons } (project.id)}
				<li>
					<!-- projectHref resolves the route internally. -->
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a class="attention-row" href={projectHref(project.id, demo)}>
						<span class="attention-name">{project.name}</span>
						<span class="attention-reasons">
							{#each reasons as reason (reason.key)}
								<span class="attention-reason" data-key={reason.key}>{reason.label}</span>
							{/each}
						</span>
					</a>
				</li>
			{/each}
		</ol>
	</section>
{/if}
