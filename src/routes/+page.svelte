<script lang="ts">
	import { resolve } from '$app/paths';
	import { demoMode } from '$cadence-mode';
	import { Button, Card, CardContent, CardHeader } from '@chienleng/stratum-ui/ui';

	const projectsHref = demoMode ? resolve('/demo') : resolve('/projects');
</script>

<svelte:head>
	<title>Cadence | A private dashboard for your Git projects</title>
</svelte:head>

<main class="shell landing-shell">
	<section class="hero landing-hero" aria-labelledby="page-title">
		<p class="eyebrow">A private dashboard for your Git projects</p>
		<h1 id="page-title">See every project clearly. Keep the work where it belongs.</h1>
		<p class="lede">
			Cadence brings project status, plans, notes, and local Git activity into one visual view. You
			run it on your own computer with your own AI agent alongside — each project stays in its
			existing folder, and your real workspace is not uploaded.
		</p>
		<div class="hero-actions">
			<Button href={projectsHref} variant="primary">
				{demoMode ? 'Explore the demo' : 'Open projects'}
			</Button>
			<Button href={resolve('/docs')} variant="outline">Set up Cadence</Button>
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
					Your projects remain separate. Cadence reads their Git status and turns the useful context
					into one visual dashboard — what exists, what is active, what changed.
				</p></CardContent
			>
		</Card>
		<Card>
			<CardHeader><h2>Built for you and your own AI agent</h2></CardHeader>
			<CardContent
				><p>
					The coding agent you already trust reads the same workspace structure — it can set Cadence
					up for your folders, keep status and plans current, and answer questions about your
					projects. There is no built-in AI account or provider.
				</p></CardContent
			>
		</Card>
		<Card>
			<CardHeader><h2>Private by default</h2></CardHeader>
			<CardContent
				><p>
					Your real dashboard runs on your computer. Keep its <code>cadence-workspace</code> folder private
					and backed up; the public site contains fictional demo data only.
				</p></CardContent
			>
		</Card>
	</section>
</main>
