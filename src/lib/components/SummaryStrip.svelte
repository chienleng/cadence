<script lang="ts">
	import { page } from '$app/state';
	import { StatGrid, StatTile } from '@chienleng/stratum-ui/ui';
	import {
		lifecycleHref,
		metricHref,
		parseFilters,
		type MetricFilter
	} from '$lib/workspace/filters';
	import { attentionReasons } from '$lib/workspace/triage';
	import type { WorkspaceSnapshot } from '$lib/workspace/types';

	let { workspace }: { workspace: WorkspaceSnapshot } = $props();

	const filters = $derived(parseFilters(page.url.searchParams));
	const attentionCount = $derived(
		workspace.projects.filter((project) => attentionReasons(project).length > 0).length
	);

	interface SummaryTile {
		label: string;
		value: number;
		href: string;
		active: boolean;
	}

	function metricTile(label: string, value: number, metric: MetricFilter): SummaryTile {
		return {
			label,
			value,
			href: metricHref(page.url, metric, filters.metric),
			active: filters.metric === metric
		};
	}

	const tiles = $derived<SummaryTile[]>([
		metricTile('Needs attention', attentionCount, 'attention'),
		metricTile('Dirty trees', workspace.summary.dirty, 'dirty'),
		metricTile('Behind upstream', workspace.summary.behindUpstream, 'behind'),
		metricTile('Stale status', workspace.summary.staleStatus, 'stale'),
		{
			label: 'Active',
			value: workspace.summary.active,
			href: lifecycleHref(page.url, 'active', filters.lifecycles),
			active: filters.lifecycles.includes('active')
		},
		metricTile('Standardized', workspace.summary.fullyStandardized, 'standardized'),
		metricTile('Missing locally', workspace.summary.missing, 'missing')
	]);
</script>

<section class="summary-strip" aria-label="Workspace metrics and filters">
	<StatGrid columns={4}>
		{#each tiles as tile (tile.label)}
			<StatTile
				label={tile.label}
				value={tile.value}
				href={tile.href}
				class={tile.active ? 'stat-tile-active' : ''}
			/>
		{/each}
		<StatTile label="Open PRs" value={workspace.summary.openPullRequests}>
			{#snippet footer()}
				<span>{workspace.summary.openIssues} open issues</span>
			{/snippet}
		</StatTile>
	</StatGrid>
</section>
