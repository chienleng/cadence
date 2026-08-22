<script lang="ts">
	import { Button, Card, CardContent, CardHeader, EmptyState } from '@chienleng/stratum-ui/ui';
	import WorkspaceDashboard from '$lib/components/WorkspaceDashboard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Cadence | A private dashboard for your Git projects</title>
</svelte:head>

{#if data.hosted}
	<main class="shell landing-shell">
		<section class="hero landing-hero" aria-labelledby="page-title">
			<p class="eyebrow">A private dashboard for your Git projects</p>
			<h1 id="page-title">See every project clearly. Keep the work where it belongs.</h1>
			<p class="lede">
				Cadence brings project status, plans, notes, and local Git activity into one visual view.
				You run it on your own computer with your own AI agent alongside — each project stays in its
				existing folder, and your real workspace is not uploaded.
			</p>
			<div class="hero-actions">
				<Button href="/demo" variant="primary">Explore the demo</Button>
				<Button href="/docs" variant="outline">Set up Cadence</Button>
				<Button
					href="https://github.com/chienleng/cadence"
					variant="ghost"
					target="_blank"
					rel="external noreferrer">View on GitHub</Button
				>
			</div>
		</section>

		<section class="principle-grid" aria-label="Cadence principles">
			<Card>
				<CardHeader><h2>One view, without moving your work</h2></CardHeader>
				<CardContent
					><p>
						Your projects remain separate. Cadence reads their Git status and turns the useful
						context into one visual dashboard — what exists, what is active, what changed.
					</p></CardContent
				>
			</Card>
			<Card>
				<CardHeader><h2>Built for you and your own AI agent</h2></CardHeader>
				<CardContent
					><p>
						The coding agent you already trust reads the same workspace structure — it can set
						Cadence up for your folders, keep status and plans current, and answer questions about
						your projects. There is no built-in AI account or provider.
					</p></CardContent
				>
			</Card>
			<Card>
				<CardHeader><h2>Private by default</h2></CardHeader>
				<CardContent
					><p>
						Your real dashboard runs on your computer. Keep its <code>cadence-workspace</code> folder
						private and backed up; the public site contains fictional demo data only.
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
			title="Set up your Cadence workspace"
			description={`Cadence could not find its workspace folder at ${data.result.dataRoot}. Open the setup guide, then ask your coding agent to help create or connect it.`}
			variant="card"
		/>
		<div class="hero-actions"><Button href="/docs" variant="primary">Open setup guide</Button></div>
	</main>
{:else if data.result?.state === 'invalid'}
	<main class="shell setup-shell">
		<section class="hero">
			<p class="eyebrow">Workspace setup needs attention</p>
			<h1>Cadence found your workspace folder, but could not read it.</h1>
			<p class="lede">{data.result.dataRoot}</p>
		</section>
		<Card>
			<CardHeader><h2>What needs fixing</h2></CardHeader>
			<CardContent>
				<ul class="validation-errors">
					{#each data.result.errors as issue (issue)}<li>{issue}</li>{/each}
				</ul>
				<p>Run <code>pnpm validate</code> after correcting the data.</p>
			</CardContent>
		</Card>
	</main>
{/if}
