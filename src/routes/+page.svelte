<script lang="ts">
	import { Button, Card, CardContent, CardHeader, EmptyState } from '@chienleng/stratum-ui/ui';
	import WorkspaceDashboard from '$lib/components/WorkspaceDashboard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Cadence — Understand a workspace without merging it</title>
</svelte:head>

{#if data.hosted}
	<main class="shell landing-shell">
		<section class="hero landing-hero" aria-labelledby="page-title">
			<p class="eyebrow">Local-first project intelligence</p>
			<h1 id="page-title">Keep independent repositories. See the whole workspace.</h1>
			<p class="lede">
				Cadence turns versioned project knowledge, local Git state, and explicit conventions into a
				legible portfolio—without uploading your workspace or choosing an AI provider for you.
			</p>
			<div class="hero-actions">
				<Button href="/demo" variant="primary">Explore the fictional demo</Button>
				<Button href="/docs" variant="outline">Read the setup guide</Button>
				<Button
					href="https://github.com/chienleng/cadence"
					variant="ghost"
					target="_blank"
					rel="external noreferrer">View source</Button
				>
			</div>
		</section>

		<section class="principle-grid" aria-label="Cadence principles">
			<Card>
				<CardHeader><h2>Your files stay authoritative</h2></CardHeader>
				<CardContent
					><p>
						Cadence reads repositories and visible workspace records; it is a lens, not another
						issue tracker.
					</p></CardContent
				>
			</Card>
			<Card>
				<CardHeader><h2>Bring your own AI</h2></CardHeader>
				<CardContent
					><p>
						Ask the coding agent you already trust to inspect the documented contract and tailor the
						data repository to your workspace.
					</p></CardContent
				>
			</Card>
			<Card>
				<CardHeader><h2>Local by design</h2></CardHeader>
				<CardContent
					><p>
						The hosted site uses fictional fixtures. Real filesystem and Git inspection runs only in
						your local checkout.
					</p></CardContent
				>
			</Card>
		</section>
	</main>
{:else if data.result?.state === 'ready'}
	<WorkspaceDashboard workspace={data.result.workspace} />
{:else if data.result?.state === 'setup'}
	<main class="shell setup-shell">
		<EmptyState
			title="Connect your workspace data"
			description={`Cadence expected a data repository at ${data.result.dataRoot}. Ask your AI to read docs/setup-with-ai.md and configure this workspace.`}
			variant="card"
		/>
		<div class="hero-actions"><Button href="/docs" variant="primary">Open setup guide</Button></div>
	</main>
{:else if data.result?.state === 'invalid'}
	<main class="shell setup-shell">
		<section class="hero">
			<p class="eyebrow">Configuration needs attention</p>
			<h1>Cadence found the data repository, but could not load it.</h1>
			<p class="lede">{data.result.dataRoot}</p>
		</section>
		<Card>
			<CardHeader><h2>Validation errors</h2></CardHeader>
			<CardContent>
				<ul class="validation-errors">
					{#each data.result.errors as issue (issue)}<li>{issue}</li>{/each}
				</ul>
				<p>Run <code>pnpm validate</code> after correcting the data.</p>
			</CardContent>
		</Card>
	</main>
{/if}
