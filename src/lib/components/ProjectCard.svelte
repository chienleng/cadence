<script lang="ts">
	import { Badge, Card, CardContent, CardFooter, CardHeader } from '@chienleng/stratum-ui/ui';
	import { createSeriesStore, FillGauge, Sparkline } from '@chienleng/stratum-ui/charts';
	import { lifecycleVariant, projectHref, relativeDate } from '$lib/workspace/format';
	import type { ProjectSnapshot } from '$lib/workspace/types';

	let { project, demo = false }: { project: ProjectSnapshot; demo?: boolean } = $props();

	const WEEK_MS = 7 * 86_400_000;
	const cadence = $derived.by(() => {
		const weeks = project.git.commitsByWeek;
		if (!project.git.isRepository || weeks.length === 0) return null;
		const now = Date.now();
		return createSeriesStore(
			weeks.map((value, index) => ({
				date: new Date(now - (weeks.length - 1 - index) * WEEK_MS),
				value
			})),
			{ name: 'commits', label: 'Commits per week' }
		);
	});

	const ahead = $derived(project.git.ahead ?? 0);
	const behind = $derived(project.git.behind ?? 0);
	const visibleTags = $derived((project.tags ?? []).slice(0, 3));
	const hiddenTagCount = $derived((project.tags ?? []).length - visibleTags.length);
	const conventionTitle = $derived(
		project.convention.length
			? project.convention.map((item) => `${item.present ? '✓' : '✗'} ${item.label}`).join('  ·  ')
			: null
	);
</script>

<!-- projectHref resolves the route internally. -->
<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a class="project-link" href={projectHref(project.id, demo)}>
	<Card class="project-card">
		<CardHeader class="project-card-header">
			<div class="project-top">
				<span class="project-top-badges">
					<Badge variant={lifecycleVariant(project.lifecycle)}>{project.lifecycle}</Badge>
					{#if project.priority === 'high'}
						<Badge variant="warning">high priority</Badge>
					{/if}
				</span>
				<span class="project-top-badges">
					{#if project.git.dirtyFiles > 0}
						<Badge variant="danger">{project.git.dirtyFiles} changed</Badge>
					{/if}
					{#if project.status.stale}
						<Badge variant="warning">stale status</Badge>
					{/if}
				</span>
			</div>
			<h3>{project.name}</h3>
			<p>{project.summary}</p>
		</CardHeader>
		<CardContent class="project-card-content">
			{#if cadence}
				<div class="card-cadence" aria-label="Commits per week, last 12 weeks">
					<Sparkline chart={cadence} height={26} showArea strokeWidth={1.5} />
				</div>
			{/if}
			{#if project.git.lastCommitSubject}
				<p class="card-commit">
					<span class="card-commit-subject">{project.git.lastCommitSubject}</span>
					<span class="card-commit-time">{relativeDate(project.git.lastCommitAt)}</span>
				</p>
			{/if}
			<div class="card-facts">
				<span>{project.git.branch ?? (project.git.isRepository ? 'detached' : 'no git')}</span>
				{#if ahead > 0 || behind > 0}
					<span class="card-divergence">
						{#if ahead > 0}↑{ahead}{/if}
						{#if behind > 0}↓{behind}{/if}
					</span>
				{/if}
				{#if project.github.state === 'ok' && project.github.openIssues !== null}
					<span>{project.github.openIssues} issues</span>
				{/if}
				{#if project.github.state === 'ok' && project.github.openPullRequests !== null}
					<span>{project.github.openPullRequests} PRs</span>
				{/if}
				{#if project.documentCount > 0}
					<span>{project.documentCount} docs</span>
				{/if}
				{#if project.packageManager}
					<span>{project.packageManager}</span>
				{/if}
			</div>
			{#if visibleTags.length > 0}
				<div class="tag-row">
					{#each visibleTags as tag (tag)}
						<span class="tag">{tag}</span>
					{/each}
					{#if hiddenTagCount > 0}
						<span class="tag">+{hiddenTagCount}</span>
					{/if}
				</div>
			{/if}
		</CardContent>
		<CardFooter class="project-card-footer">
			<span class="document-path">{project.path}</span>
			{#if project.convention.length > 0}
				<span class="score-gauge" title={conventionTitle}>
					<span>{project.conventionScore}%</span>
					<FillGauge
						value={project.conventionScore}
						width={64}
						height={6}
						label={`${project.conventionScore}% convention coverage`}
					/>
				</span>
			{/if}
		</CardFooter>
	</Card>
</a>
