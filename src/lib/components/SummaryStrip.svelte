<script lang="ts">
	import { page } from '$app/state';
	import { StatGrid, StatTile } from '@chienleng/stratum-ui/ui';
	import {
		lifecycleHref,
		metricHref,
		parseFilters,
		type MetricFilter
	} from '$lib/workspace/filters';
	import { githubDate, githubTotals, unknownWorkingTree } from '$lib/workspace/data-quality';
	import { attentionReasons } from '$lib/workspace/triage';
	import type { WorkspaceSnapshot } from '$lib/workspace/types';

	let { workspace }: { workspace: WorkspaceSnapshot } = $props();

	const filters = $derived(parseFilters(page.url.searchParams));
	const attentionCount = $derived(
		workspace.projects.filter((project) => attentionReasons(project).length > 0).length
	);

	const totals = $derived(githubTotals(workspace.projects));
	const unknownGit = $derived(workspace.projects.filter(unknownWorkingTree).length);
	const githubStates = $derived(
		['failed', 'unavailable', 'absent', 'stale']
			.map((state) => ({
				state,
				count: workspace.projects.filter((project) => project.github.state === state).length
			}))
			.filter((item) => item.count > 0)
	);
	const githubDates = $derived(
		workspace.projects
			.filter((project) => project.github.state === 'ok' || project.github.state === 'stale')
			.map((project) => project.github.fetchedAt)
			.filter((date): date is string => date !== null)
			.sort()
	);
	function countLabel(value: ReturnType<typeof githubTotals>['prs']) {
		return `${value.value ?? '—'}${value.partial && value.value !== null ? ' (partial)' : ''}${value.stale ? ' (stale)' : ''}`;
	}
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
		metricTile(
			unknownGit ? 'Dirty trees (partial)' : 'Dirty trees',
			workspace.summary.dirty,
			'dirty'
		),
		metricTile('Behind · local refs', workspace.summary.behindUpstream, 'behind'),
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
		<StatTile
			label={`Open PRs · ${totals.prs.partial ? 'partial' : 'cached'}${totals.prs.stale ? ' · stale' : ''}`}
			value={totals.prs.value ?? '—'}
		>
			{#snippet footer()}
				<span>{countLabel(totals.issues)} open issues</span>
			{/snippet}
		</StatTile>
	</StatGrid>
	<div class="data-coverage">
		<p>
			{#if totals.issues.known === totals.prs.known}
				GitHub counts from {totals.issues.known} of {totals.issues.expected} projects.
			{:else}
				GitHub counts: issues from {totals.issues.known} of {totals.issues.expected} projects; PRs from
				{totals.prs.known} of {totals.prs.expected}.
			{/if}
			{githubStates
				.map(
					(item) =>
						`${item.count} ${item.state === 'absent' ? 'not refreshed' : item.state === 'failed' ? 'refresh failed' : item.state}.`
				)
				.join(' ')}
			{#if githubDates[0]}Oldest data: {githubDate(githubDates[0])}.{/if}
		</p>
		{#if githubStates.length > 0 || totals.issues.partial || totals.prs.partial}
			<p>
				Missing counts are unknown. Cached data older than 24 hours is stale.
				{#if workspace.mode === 'local'}Run <code>pnpm refresh</code> in Cadence, then reload.{/if}
			</p>
		{/if}
		{#if unknownGit > 0}<p>
				Working tree unknown for {unknownGit}
				{unknownGit === 1 ? 'repository' : 'repositories'}; excluded from the dirty total.
			</p>{/if}
	</div>
</section>
