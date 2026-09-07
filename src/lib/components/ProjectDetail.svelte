<script lang="ts">
	import { navigating, page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Select } from '@chienleng/stratum-ui/forms';
	import { dashboardHref, documentHref, recordHref } from '$lib/workspace/navigation';
	import GithubStatus from './GithubStatus.svelte';
	import {
		gitBranchLabel,
		githubHasData,
		githubTimestamp,
		upstreamLabel,
		LOCAL_REFS_DESCRIPTION
	} from '$lib/workspace/data-quality';
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

	let { data, backHref = resolve('/projects') }: { data: ProjectDetailData; backHref?: string } =
		$props();

	const returnHref = $derived(dashboardHref(backHref, page.url.searchParams));
	const requestedRecord = $derived(page.url.searchParams.get('record'));
	const selectedRecord = $derived(data.selectedRecord);
	const selectedDocument = $derived(data.selectedDocument);
	const loadingPreview = $derived(
		navigating.to?.url.pathname === page.url.pathname &&
			navigating.to?.url.search !== page.url.search
	);
	const requestedDocument = $derived(page.url.searchParams.get('document'));
	const missingDocument = $derived(
		requestedDocument !== null &&
			!data.documents.some((document) => document.path === requestedDocument)
	);
	const missingRecord = $derived(
		requestedRecord !== null && !data.records.some((record) => record.path === requestedRecord)
	);
	const recordOptions = $derived(
		data.records.map((record) => ({
			value: record.path,
			label: `${recordLabel(record.kind)} · ${record.title}`
		}))
	);
	function chooseRecord(path: string): void {
		// recordHref uses the resolved current route and only loaded record paths.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(recordHref(page.url, path), { keepFocus: true, noScroll: true });
	}

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
		backHref={returnHref}
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

	<div class="detail-grid" aria-busy={loadingPreview}>
		{#if loadingPreview}<p class="meta-label full" role="status">Loading preview…</p>{/if}
		<Card class="full">
			<CardHeader>
				<CardTitle><h2 id="project-workflow">Status and work</h2></CardTitle>
				<CardAction><Badge variant="info">{data.records.length} records</Badge></CardAction>
			</CardHeader>
			<CardContent>
				{#if !data.project.exists}
					<p class="preview-caveat" role="status">
						Source folder unavailable: <code>{data.project.path}</code>. Cadence records are stored
						separately. Restore the folder at its registered path, then reload to see local Git
						activity and source documentation.
					</p>
				{/if}
				{#if missingRecord}<p class="preview-caveat" role="status">
						This record is unavailable. Showing {selectedRecord
							? 'the default record'
							: 'no record'} instead.
					</p>{/if}
				{#if !data.records.some((record) => record.kind === 'status')}
					<p class="preview-caveat">
						No current status record. Add STATUS.md to this project's Cadence records.
					</p>
				{/if}
				{#if selectedRecord}
					<div class="mobile-record-picker">
						<label for="project-record-picker" class="meta-label">Project record</label>
						<Select
							id="project-record-picker"
							portalTarget="main"
							variant="field"
							label="Project record"
							options={recordOptions}
							selected={selectedRecord.path}
							onchange={chooseRecord}
						/>
					</div>
					<div class="workflow-layout record-layout">
						<nav
							class="workflow-nav"
							aria-label="Project workflow records"
							data-sveltekit-preload-data="off"
						>
							{#each data.records as record (record.path)}
								<Button
									variant={record.path === selectedRecord.path ? 'secondary' : 'ghost'}
									size="sm"
									class="workflow-record-button"
									href={recordHref(page.url, record.path)}
									aria-current={record.path === selectedRecord.path ? 'page' : undefined}
									data-sveltekit-keepfocus
									data-sveltekit-noscroll
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
								{#if selectedRecord.kind === 'status'}
									<Badge variant={data.project.status.stale ? 'warning' : 'neutral'}>
										{data.project.status.stale ? 'Stale' : 'Updated'}
										{data.project.status.updatedAt ?? '· undated'}
									</Badge>
								{/if}
								<Button href={recordHref(page.url, selectedRecord.path)} variant="outline" size="sm"
									>Record link</Button
								>
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
						title="No status or work records"
						description="Add STATUS.md, a plan, decision, meeting, note, or inbox record under the project's visible Cadence data directory."
					/>
				{/if}
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle><h2 id="project-state">Project state</h2></CardTitle>
			</CardHeader>
			<CardContent>
				<ul class="check-list">
					<li><span>Branch</span><strong>{gitBranchLabel(data.project)}</strong></li>
					<li>
						<span>Working tree</span>
						{#if !data.project.exists}
							<Badge variant="warning">Source unavailable</Badge>
						{:else if !data.project.git.isRepository}
							<Badge variant="neutral">No Git repository</Badge>
						{:else if data.project.git.dirtyFiles === null}
							<Badge variant="warning">Unknown · inspection failed</Badge>
						{:else if data.project.git.dirtyFiles > 0}
							<Badge variant="danger">{data.project.git.dirtyFiles} changed files</Badge>
						{:else}
							<Badge variant="success">Clean</Badge>
						{/if}
					</li>
					<li>
						<span>Upstream · local refs</span>
						<strong>{upstreamLabel(data.project.git)}</strong>
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
							<Badge variant={data.project.lifecycle === 'active' ? 'warning' : 'neutral'}
								>No STATUS.md</Badge
							>
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
					<li>
						<span>GitHub</span>
						<GithubStatus github={data.project.github} />
					</li>
					{#if data.project.github.state !== 'not-applicable'}
						<li>
							<span>GitHub refresh</span><strong>{githubTimestamp(data.project.github)}</strong>
						</li>
					{/if}
					{#if githubHasData(data.project.github)}
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
							>{data.project.exists
								? (data.project.packageManager ?? 'Not detected')
								: 'Unavailable'}</strong
						>
					</li>
					<li>
						<span>Knowledge documents</span><strong
							>{data.project.exists ? data.project.documentCount : 'Unavailable'}</strong
						>
					</li>
				</ul>
				<p class="local-ref-note">{LOCAL_REFS_DESCRIPTION}</p>
				{#if data.project.github.state !== 'not-applicable'}
					<p class="preview-caveat">
						GitHub counts are cached. Data older than 24 hours is marked stale.
						{#if !backHref.startsWith('/demo')}Run <code>pnpm refresh</code> in Cadence, then reload to
							try again.{/if}
					</p>
				{/if}
			</CardContent>
		</Card>

		<Card>
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
						title={data.project.exists ? 'No history available' : 'Source folder unavailable'}
						description={data.project.exists
							? 'Git history could not be loaded, or this repository has no commits.'
							: 'Local commit history will be available when the source folder is restored.'}
					/>
				{/if}
			</CardContent>
		</Card>

		<Card class="full">
			<CardHeader>
				<CardTitle><h2 id="convention-coverage">Convention coverage</h2></CardTitle>
				{#if data.project.exists}
					<CardAction><Badge variant="info">{data.project.conventionScore}%</Badge></CardAction>
				{/if}
			</CardHeader>
			<CardContent>
				{#if !data.project.exists}
					<EmptyState
						title="Convention checks unavailable"
						description="Restore the source folder to check README, agent guidance and documentation alongside the saved Cadence records."
					/>
				{:else}
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
				{/if}
			</CardContent>
		</Card>

		<Card class="full">
			<CardHeader>
				<CardTitle><h2 id="knowledge-map">Knowledge map</h2></CardTitle>
				{#if data.project.exists}
					<CardAction><Badge>{data.documents.length} files</Badge></CardAction>
				{/if}
			</CardHeader>
			<CardContent>
				{#if missingDocument}<p class="preview-caveat" role="status">
						This document is unavailable. Showing {selectedDocument
							? 'the default document'
							: 'no document'} instead.
					</p>{/if}
				{#if selectedDocument}
					<div class="workflow-layout">
						<nav
							class="workflow-nav"
							aria-label="Markdown documents"
							data-sveltekit-preload-data="off"
						>
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
										href={documentHref(page.url, document.path)}
										aria-current={document.path === selectedDocument.path ? 'page' : undefined}
										data-sveltekit-keepfocus
										data-sveltekit-noscroll
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
						title={data.project.exists ? 'No knowledge files' : 'Source documentation unavailable'}
						description={data.project.exists
							? 'No project documentation was discovered.'
							: 'README, agent guidance and technical documentation live in the source folder. See Status and work for saved Cadence records.'}
					/>
				{/if}
			</CardContent>
		</Card>
	</div>
</main>
