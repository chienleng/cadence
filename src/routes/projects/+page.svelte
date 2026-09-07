<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button, Card, CardContent, CardHeader, EmptyState } from '@chienleng/stratum-ui/ui';
	import WorkspaceDashboard from '$lib/components/WorkspaceDashboard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Projects | Cadence</title>
</svelte:head>

{#if data.result.state === 'ready'}
	<WorkspaceDashboard workspace={data.result.workspace} />
{:else if data.result.state === 'setup'}
	<main class="shell setup-shell">
		<EmptyState
			title="Set up your Cadence workspace"
			description={`Cadence could not find its workspace folder at ${data.result.dataRoot}. Open the setup guide, then ask your coding agent to help create or connect it.`}
			variant="card"
		/>
		<div class="hero-actions">
			<Button href={resolve('/docs')} variant="primary">Open setup guide</Button>
		</div>
	</main>
{:else}
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
