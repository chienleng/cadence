<script lang="ts">
	import { Button, Card, CardContent, CardHeader } from '@chienleng/stratum-ui/ui';
</script>

<svelte:head><title>Set up Cadence</title></svelte:head>

<main class="shell docs-shell">
	<section class="hero">
		<p class="eyebrow">Setup</p>
		<h1>Let your own AI adapt Cadence to your workspace.</h1>
		<p class="lede">
			Cadence is a repository and an opinionated file contract—not an npm package or a hosted
			account.
		</p>
	</section>
	<Card>
		<CardHeader><h2>Start here</h2></CardHeader>
		<CardContent class="prose-stack">
			<ol>
				<li>Clone Cadence beside the repositories you want it to inspect.</li>
				<li>Install dependencies with <code>pnpm install</code>.</li>
				<li>
					Ask your coding agent to read <code>docs/setup-with-ai.md</code> and inspect the workspace.
				</li>
				<li>
					Review the proposed visible <code>cadence-workspace/projects/</code> records before allowing
					writes.
				</li>
				<li>
					Expose the approved workspace <code>AGENTS.md</code>, then run
					<code>pnpm context --audit</code> to verify agent discovery.
				</li>
				<li>
					Run <code>pnpm refresh --local-only</code>, then <code>pnpm dev</code>.
				</li>
			</ol>
			<p>
				Cadence never edits monitored repositories. Your agent should request explicit permission
				before changing their documentation.
			</p>
			<Button href="https://github.com/chienleng/cadence" target="_blank" rel="external noreferrer"
				>Open the repository</Button
			>
		</CardContent>
	</Card>
</main>
