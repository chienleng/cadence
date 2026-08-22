<script lang="ts">
	import {
		Badge,
		Button,
		Card,
		CardAction,
		CardContent,
		CardHeader,
		CardTitle,
		EmptyState,
		PageHeader,
		Tooltip
	} from '@chienleng/stratum-ui/ui';
	import { lifecycleVariant, relativeDate } from '$lib/workspace/format';
	import type { ProjectRecordKind } from '$lib/workspace/types';

	import type { ProjectDetail as ProjectDetailData } from '$lib/workspace/types';

	let { data, backHref = '/' }: { data: ProjectDetailData; backHref?: string } = $props();
	let selectedRecordPath = $state('');
	let selectedRecord = $derived(
		data.records.find((record) => record.path === selectedRecordPath) ?? data.records[0]
	);
	let selectedDocumentPath = $state('');
	let selectedDocument = $derived(
		data.documents.find((document) => document.path === selectedDocumentPath) ?? data.documents[0]
	);
	const hasUpstream = $derived(data.project.git.ahead !== null || data.project.git.behind !== null);

	function githubFile(path: string): string | null {
		if (!data.project.git.githubUrl || !data.project.git.branch) return null;
		return `${data.project.git.githubUrl}/blob/${data.project.git.branch}/${path}`;
	}

	function recordLabel(value: ProjectRecordKind): string {
		return {
			status: 'Status',
			plan: 'Plan',
			decision: 'Decision',
			meeting: 'Meeting',
			note: 'Note',
			inbox: 'Inbox'
		}[value];
	}
</script>

<svelte:head>
	<title>{data.project.name} — Cadence</title>
	<meta name="description" content={data.project.summary} />
</svelte:head>

<main id="project-overview" class="shell detail-shell">
	<PageHeader
		title={data.project.name}
		subtitle={data.project.summary}
		{backHref}
		backLabel="Projects"
	>
		{#snippet meta()}
			<Badge variant={lifecycleVariant(data.project.lifecycle)}>{data.project.lifecycle}</Badge>
			<span class="document-path">{data.project.group} · {data.project.path}</span>
		{/snippet}
		{#snippet actions()}
			{#if data.project.git.githubUrl}
				<Button
					href={data.project.git.githubUrl}
					variant="primary"
					target="_blank"
					rel="external noreferrer">Repository</Button
				>
				<Button
					href={`${data.project.git.githubUrl}/issues`}
					variant="outline"
					target="_blank"
					rel="external noreferrer">Issues</Button
				>
			{/if}
		{/snippet}
	</PageHeader>

	<div class="detail-grid">
		<Card>
			<CardHeader>
				<CardTitle><h2 id="project-state">Project state</h2></CardTitle>
			</CardHeader>
			<CardContent>
				<ul class="check-list">
					<li><span>Branch</span><strong>{data.project.git.branch ?? 'Not available'}</strong></li>
					<li>
						<span>Working tree</span>
						{#if data.project.git.dirtyFiles > 0}
							<Badge variant="danger">{data.project.git.dirtyFiles} changed files</Badge>
						{:else}
							<Badge variant="success">Clean</Badge>
						{/if}
					</li>
					<li>
						<span>Upstream</span>
						{#if !hasUpstream}
							<strong>No upstream</strong>
						{:else if (data.project.git.ahead ?? 0) === 0 && (data.project.git.behind ?? 0) === 0}
							<Badge variant="success">In sync</Badge>
						{:else}
							<strong>
								{#if (data.project.git.ahead ?? 0) > 0}↑{data.project.git.ahead} ahead{/if}
								{#if (data.project.git.behind ?? 0) > 0}↓{data.project.git.behind} behind{/if}
							</strong>
						{/if}
					</li>
					{#if data.project.git.lastCommitSubject}
						<li>
							<span>Last commit</span>
							<strong>
								{data.project.git.lastCommitSubject} · {relativeDate(data.project.git.lastCommitAt)}
							</strong>
						</li>
					{/if}
					<li>
						<span>Status record</span>
						{#if !data.project.status.present}
							<Badge variant="neutral">No STATUS.md</Badge>
						{:else if data.project.status.stale}
							<Badge variant="warning">
								Stale{data.project.status.updatedAt
									? ` · ${data.project.status.updatedAt}`
									: ' · undated'}
							</Badge>
						{:else}
							<Badge variant="success">Updated {data.project.status.updatedAt}</Badge>
						{/if}
					</li>
					{#if data.project.github.state === 'ok'}
						<li>
							<span>Open issues · PRs</span>
							<strong>
								{data.project.github.openIssues ?? '—'} · {data.project.github.openPullRequests ??
									'—'}
							</strong>
						</li>
						{#if data.project.github.latestRelease}
							<li>
								<span>Latest release</span>
								<a
									class="release-link"
									href={data.project.github.latestRelease.url}
									target="_blank"
									rel="external noreferrer"
								>
									{data.project.github.latestRelease.tagName}
								</a>
							</li>
						{/if}
					{/if}
					<li>
						<span>Package manager</span><strong
							>{data.project.packageManager ?? 'Not detected'}</strong
						>
					</li>
					<li><span>Knowledge documents</span><strong>{data.project.documentCount}</strong></li>
				</ul>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle><h2 id="convention-coverage">Convention coverage</h2></CardTitle>
				<CardAction><Badge variant="info">{data.project.conventionScore}%</Badge></CardAction>
			</CardHeader>
			<CardContent>
				<ul class="check-list">
					{#each data.project.convention as item (item.key)}
						<li>
							<span>{item.label}</span>
							<Badge variant={item.present ? 'success' : 'neutral'}>
								{item.present ? 'Present' : 'Missing'}
							</Badge>
						</li>
					{/each}
				</ul>
			</CardContent>
		</Card>

		<Card class="full">
			<CardHeader>
				<CardTitle><h2 id="project-workflow">Project workflow</h2></CardTitle>
				<CardAction><Badge variant="info">{data.records.length} records</Badge></CardAction>
			</CardHeader>
			<CardContent>
				{#if selectedRecord}
					<div class="workflow-layout">
						<nav class="workflow-nav" aria-label="Project workflow records">
							{#each data.records as record (record.path)}
								<Button
									variant={record.path === selectedRecord.path ? 'secondary' : 'ghost'}
									size="sm"
									class="workflow-record-button"
									onclick={() => (selectedRecordPath = record.path)}
								>
									<span class="workflow-record-copy">
										<span>{record.title}</span>
										<span>{recordLabel(record.kind)}</span>
									</span>
								</Button>
							{/each}
						</nav>

						<article class="project-markdown">
							<div class="record-meta">
								<Badge>{recordLabel(selectedRecord.kind)}</Badge>
								<span class="document-path">{selectedRecord.path}</span>
								{#if selectedRecord.sourceUrl}
									<Button
										href={selectedRecord.sourceUrl}
										variant="outline"
										size="sm"
										target="_blank"
										rel="external noreferrer">Source</Button
									>
								{/if}
							</div>
							<!-- Raw HTML is disabled in the server-side Markdown renderer. -->
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							<div class="markdown-body">{@html selectedRecord.html}</div>
						</article>
					</div>
				{:else}
					<EmptyState
						title="No project workflow records"
						description="Add STATUS.md, a plan, decision, meeting, note, or inbox record under the project's visible Cadence data directory."
					/>
				{/if}
			</CardContent>
		</Card>

		<Card class="full">
			<CardHeader>
				<CardTitle><h2 id="recent-commits">Recent commits</h2></CardTitle>
				<CardAction><span class="meta-label">Local Git</span></CardAction>
			</CardHeader>
			<CardContent>
				{#if data.recentCommits.length}
					<ul class="commit-list">
						{#each data.recentCommits as commit (commit.hash)}
							<li>
								<div class="commit-copy">
									<span>{commit.subject}</span>
									<span class="commit-meta">{commit.hash} · {relativeDate(commit.date)}</span>
								</div>
							</li>
						{/each}
					</ul>
				{:else}
					<EmptyState
						title="No Git history"
						description="No commits are available for this project."
					/>
				{/if}
			</CardContent>
		</Card>

		<Card class="full">
			<CardHeader>
				<CardTitle><h2 id="knowledge-map">Knowledge map</h2></CardTitle>
				<CardAction><Badge>{data.documents.length} files</Badge></CardAction>
			</CardHeader>
			<CardContent>
				{#if selectedDocument}
					<div class="workflow-layout">
						<nav class="workflow-nav" aria-label="Markdown documents">
							{#each data.documents as document (document.path)}
								<Tooltip
									text={document.path}
									side="right"
									delayDuration={300}
									class="workflow-record-tooltip"
								>
									<Button
										variant={document.path === selectedDocument.path ? 'secondary' : 'ghost'}
										size="sm"
										class="workflow-record-button"
										onclick={() => (selectedDocumentPath = document.path)}
									>
										<span class="workflow-record-copy">
											<span>{document.title}</span>
											<span>{document.path}</span>
										</span>
									</Button>
								</Tooltip>
							{/each}
						</nav>

						<article class="project-markdown">
							<div class="record-meta">
								<Badge>{selectedDocument.kind}</Badge>
								<span class="document-path">{selectedDocument.path}</span>
								{#if githubFile(selectedDocument.path)}
									<Button
										href={githubFile(selectedDocument.path) ?? ''}
										variant="outline"
										size="sm"
										target="_blank"
										rel="external noreferrer">Check on GitHub</Button
									>
								{/if}
							</div>
							{#if githubFile(selectedDocument.path)}
								<p class="preview-caveat">
									This preview reflects the local file and may be outdated. Check GitHub for the
									latest committed version.
								</p>
							{:else}
								<p class="preview-caveat">
									This preview reflects the local file and may be outdated. No GitHub source is
									available for this project.
								</p>
							{/if}
							<!-- Raw HTML is disabled in the server-side Markdown renderer. -->
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							<div class="markdown-body">{@html selectedDocument.html}</div>
						</article>
					</div>
				{:else}
					<EmptyState
						title="No knowledge files"
						description="No project documentation was discovered."
					/>
				{/if}
			</CardContent>
		</Card>
	</div>
</main>
