<script lang="ts">
	import { Badge, Table } from '@chienleng/stratum-ui/ui';
	import { commitTimestamp, projectHref, relativeDate } from '$lib/workspace/format';
	import { attentionRank } from '$lib/workspace/triage';
	import type { ProjectSnapshot } from '$lib/workspace/types';

	let { projects, demo = false }: { projects: ProjectSnapshot[]; demo?: boolean } = $props();

	const sorted = $derived(
		[...projects].sort(
			(first, second) =>
				attentionRank(second) - attentionRank(first) ||
				commitTimestamp(second) - commitTimestamp(first) ||
				first.name.localeCompare(second.name)
		)
	);

	const headers = [
		'Project',
		'Branch',
		{ label: '± upstream', class: 'num' },
		'Last commit',
		{ label: 'Issues', class: 'num' },
		{ label: 'PRs', class: 'num' },
		'Status',
		{ label: 'Score', class: 'num' }
	];

	function divergence(project: ProjectSnapshot): string {
		const ahead = project.git.ahead ?? 0;
		const behind = project.git.behind ?? 0;
		if (project.git.ahead === null && project.git.behind === null) return '—';
		if (ahead === 0 && behind === 0) return '·';
		return [ahead > 0 ? `↑${ahead}` : '', behind > 0 ? `↓${behind}` : ''].join(' ').trim();
	}
</script>

<Table variant="card" compact cellUtils caption="Projects by attention, then recency" {headers}>
	{#each sorted as project (project.id)}
		<tr>
			<td class="row-link">
				<!-- projectHref resolves the route internally. -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={projectHref(project.id, demo)}>{project.name}</a>
				<span class="document-path">{project.path}</span>
			</td>
			<td class="mono">
				{project.git.branch ?? (project.git.isRepository ? 'detached' : 'no git')}
				{#if project.git.dirtyFiles > 0}
					<Badge variant="danger">{project.git.dirtyFiles}</Badge>
				{/if}
			</td>
			<td class="num mono">{divergence(project)}</td>
			<td>
				{#if project.git.lastCommitSubject}
					<span class="table-commit-subject">{project.git.lastCommitSubject}</span>
					<span class="date-cell">{relativeDate(project.git.lastCommitAt)}</span>
				{:else}
					<span class="muted">No commits</span>
				{/if}
			</td>
			<td class="num">{project.github.openIssues ?? '—'}</td>
			<td class="num">{project.github.openPullRequests ?? '—'}</td>
			<td>
				{#if !project.status.present}
					<span class="muted">—</span>
				{:else if project.status.stale}
					<Badge variant="warning">stale</Badge>
				{:else}
					<span class="date-cell">{project.status.updatedAt}</span>
				{/if}
			</td>
			<td class="num">{project.convention.length > 0 ? `${project.conventionScore}%` : '—'}</td>
		</tr>
	{/each}
</Table>
