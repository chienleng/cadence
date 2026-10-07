<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardAction,
		CardContent,
		EmptyState
	} from '@chienleng/stratum-ui/ui';
	import { githubDetail, githubHasData } from '$lib/workspace/data-quality';
	import { relativeDate } from '$lib/workspace/format';
	import type { GithubSnapshot } from '$lib/workspace/types';
	import GithubStatus from './GithubStatus.svelte';

	let {
		github,
		demo = false,
		archived = false
	}: { github: GithubSnapshot; demo?: boolean; archived?: boolean } = $props();
	const issues = $derived(githubHasData(github) ? github.issueList : null);
</script>

<Card class="full">
	<CardHeader>
		<CardTitle><h2 id="project-issues">Open issues</h2></CardTitle>
		<CardAction><GithubStatus {github} /></CardAction>
	</CardHeader>
	<CardContent>
		<section aria-labelledby="project-issues">
			{#if issues !== null}
				<p class="preview-caveat">
					{githubDetail(github)}. Most recently updated first.{github.state === 'stale'
						? ' This list is stale; issues may have changed on GitHub.'
						: ''}
				</p>
				{#if issues.length}
					<ul class="issue-list">
						{#each issues as issue (issue.number)}
							<li>
								<a href={issue.url} target="_blank" rel="external noreferrer"
									>#{issue.number} · {issue.title}</a
								>
								<span class="meta-label">Updated {relativeDate(issue.updatedAt)}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<EmptyState
						title="No open issues"
						description="No open issues were found at the last GitHub refresh."
					/>
				{/if}
			{:else}
				<EmptyState
					title="Issue list unavailable"
					description={archived
						? 'GitHub refresh is skipped for archived projects.'
						: github.state === 'not-applicable'
							? 'This project has no GitHub remote.'
							: github.state === 'failed'
								? githubDetail(github)
								: 'Open issue details have not been cached for this project.'}
				/>
			{/if}
			{#if !demo && !archived && github.state !== 'not-applicable'}
				<p class="local-ref-note">
					Run <code>pnpm refresh</code> in Cadence, then reload to update this list.
				</p>
			{/if}
		</section>
	</CardContent>
</Card>

<style>
	.issue-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.issue-list li {
		display: flex;
		flex-direction: column;
		gap: var(--su-space-2);
		padding: var(--su-space-3) 0;
		border-bottom: 1px solid var(--su-border-muted);
	}
	.issue-list li:last-child {
		border-bottom: 0;
	}
	.issue-list a {
		overflow-wrap: anywhere;
	}
</style>
