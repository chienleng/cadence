<script lang="ts">
	import { Skeleton, Spinner } from '@chienleng/stratum-ui/ui';

	let { detail = false }: { detail?: boolean } = $props();

	const placeholders = [0, 1, 2, 3, 4, 5];
	const label = $derived(detail ? 'Loading project' : 'Loading projects');
	const title = $derived(detail ? 'Loading project…' : 'Loading your projects…');
	const description = $derived(
		detail
			? 'Reading project details, records, and recent Git activity.'
			: 'Checking project status, Git activity, and workspace records.'
	);
</script>

<main class="shell project-loading" aria-labelledby="project-loading-title" aria-live="polite">
	<section class="project-loading-status">
		<Spinner size="lg" {label} />
		<div>
			<p class="eyebrow">{detail ? 'Project' : 'Projects'}</p>
			<h1 id="project-loading-title">{title}</h1>
			<p>{description}</p>
		</div>
	</section>
	<div class="project-grid project-loading-grid" aria-hidden="true">
		{#each placeholders as placeholder (placeholder)}
			<Skeleton variant="card" />
		{/each}
	</div>
</main>
