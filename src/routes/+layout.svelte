<script lang="ts">
	import { resolve } from '$app/paths';
	import { navigating } from '$app/state';
	import { demoMode } from '$cadence-mode';
	import '@chienleng/stratum-ui/themes/neutral.css';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppSidebar from '$lib/components/AppSidebar.svelte';
	import ProjectLoading from '$lib/components/ProjectLoading.svelte';

	let { children } = $props();

	const projectsHref = demoMode ? resolve('/demo') : resolve('/');
	const projectPathPrefix = demoMode ? '/demo/projects/' : '/projects/';
	const pathChanged = $derived(
		navigating.to !== null && navigating.to.url.pathname !== navigating.from?.url.pathname
	);
	const enteringProjects = $derived(pathChanged && navigating.to?.url.pathname === projectsHref);
	const enteringProject = $derived(
		pathChanged && navigating.to?.url.pathname.startsWith(projectPathPrefix)
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta
		name="description"
		content="A private dashboard that gives you a visual view of all your Git projects, built for working with your own AI agent."
	/>
</svelte:head>

<div class="app-shell">
	<AppSidebar />
	<div class="app-main" aria-busy={enteringProjects || enteringProject}>
		{#if enteringProject}
			<ProjectLoading detail />
		{:else if enteringProjects}
			<ProjectLoading />
		{:else}
			{@render children()}
		{/if}
	</div>
</div>
