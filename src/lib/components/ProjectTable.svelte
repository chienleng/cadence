<script lang="ts">
	import { page } from '$app/state';
	import GithubStatus from './GithubStatus.svelte';
	import {
		gitBranchLabel,
		upstreamLabel,
		LOCAL_REFS_DESCRIPTION,
		githubHasData,
		looksParked,
		unknownWorkingTree
	} from '$lib/workspace/data-quality';
	import { Badge, Table } from '@chienleng/stratum-ui/ui';
	import { ButtonIcon } from '@chienleng/stratum-ui/forms';
	import { commitTimestamp, projectHref, relativeDate } from '$lib/workspace/format';
	import { compareStarredProjects } from '$lib/workspace/stars';
	import { attentionRank } from '$lib/workspace/triage';
	import type { ProjectSnapshot } from '$lib/workspace/types';
	import Star from './icons/Star.svelte';

	let {
		projects,
		demo = false,
		starredProjectIds,
		ontogglestar
	}: {
		projects: ProjectSnapshot[];
		demo?: boolean;
		starredProjectIds: Set<string>;
		ontogglestar: (projectId: string) => void;
	} = $props();

	const sorted = $derived(
		[...projects].sort(
			(first, second) =>
				compareStarredProjects(first, second, starredProjectIds) ||
				attentionRank(second) - attentionRank(first) ||
				commitTimestamp(second) - commitTimestamp(first) ||
				first.name.localeCompare(second.name)
		)
	);

	const headers = [
		{ label: 'Starred', class: 'star-column', srOnly: true },
		'Project',
		'Status',
		{ label: 'Issues', class: 'num' },
		{ label: 'PRs', class: 'num' },
		'Local Git',
		'Last commit',
		{ label: 'Coverage', class: 'num' }
	];
</script>

<Table
	class="project-comparison"
	variant="card"
	compact
	cellUtils
	caption="Projects with starred first, then by attention and recency"
	{headers}
>
	{#each sorted as project (project.id)}
		<tr>
			<td class="star-column">
				<ButtonIcon
					class={`star-button${starredProjectIds.has(project.id) ? ' starred' : ''}`}
					aria-label={`${starredProjectIds.has(project.id) ? 'Unstar' : 'Star'} ${project.name}`}
					aria-pressed={starredProjectIds.has(project.id)}
					title={`${starredProjectIds.has(project.id) ? 'Unstar' : 'Star'} ${project.name}`}
					onclick={() => ontogglestar(project.id)}
				>
					<Star size={16} filled={starredProjectIds.has(project.id)} aria-hidden="true" />
				</ButtonIcon>
			</td>
			<td class="row-link">
				<!-- projectHref resolves the route internally. -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={projectHref(project.id, demo, page.url.searchParams)}>{project.name}</a>
				<span class="document-path">{project.path}</span>
				<GithubStatus github={project.github} />
			</td>
			<td>
				{#if project.lifecycle === 'active' && !project.status.present}
					<Badge variant="warning">Missing status</Badge>
				{:else if !project.status.present}
					<span class="muted">—</span>
				{:else if project.status.stale}
					<Badge variant="warning">stale</Badge>
				{:else if project.status.updatedAtSource === 'judged'}
					<span class="date-cell" title="Date read by Jev; the Updated: line could not be parsed"
						>{project.status.updatedAt} · judged</span
					>
				{:else}
					<span class="date-cell">{project.status.updatedAt}</span>
				{/if}
				{#if looksParked(project.status)}
					<Badge variant="warning">parked</Badge>
				{/if}
			</td>
			{@render workCount(project, project.github.openIssues, 'issues')}
			{@render workCount(project, project.github.openPullRequests, 'pulls')}
			<td class="table-git">
				<span class="mono">{gitBranchLabel(project)}</span>
				{#if unknownWorkingTree(project)}
					<Badge variant="warning">Git status unknown</Badge>
				{/if}
				{#if (project.git.dirtyFiles ?? 0) > 0}
					<Badge variant="danger">{project.git.dirtyFiles} changed</Badge>
				{/if}
				{#if project.git.ahead !== null || project.git.behind !== null}
					<span class="date-cell" title={LOCAL_REFS_DESCRIPTION}>{upstreamLabel(project.git)}</span>
				{/if}
			</td>
			<td class="table-activity">
				{#if project.git.lastCommitSubject}
					<span class="date-cell">{relativeDate(project.git.lastCommitAt)}</span>
					<details class="table-commit">
						<summary aria-label={`Commit message for ${project.name}`}>Commit message</summary>
						<p>{project.git.lastCommitSubject}</p>
					</details>
				{:else}
					<span class="muted">No history available</span>
				{/if}
			</td>
			<td class="num">{project.convention.length > 0 ? `${project.conventionScore}%` : '—'}</td>
		</tr>
	{/each}
</Table>

{#snippet workCount(project: ProjectSnapshot, count: number | null, kind: 'issues' | 'pulls')}
	<td class="num">
		{#if githubHasData(project.github) && count !== null}
			{#if project.git.githubUrl}
				<a
					class="table-work-link"
					href={`${project.git.githubUrl}/${kind}`}
					target="_blank"
					rel="external noreferrer"
					aria-label={`${project.name}: ${count} cached open ${kind === 'issues' ? 'issues' : 'pull requests'}${project.github.state === 'stale' ? ' (stale)' : ''}. Open GitHub in a new tab`}
					>{count}</a
				>
			{:else}
				{count}
			{/if}
		{:else}
			<span aria-label={`${kind === 'issues' ? 'Issue' : 'Pull request'} count unavailable`}>—</span
			>
		{/if}
	</td>
{/snippet}
