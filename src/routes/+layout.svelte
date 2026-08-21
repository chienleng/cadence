<script lang="ts">
	import { resolve } from '$app/paths';
	import { demoMode } from '$cadence-mode';
	import { Button } from '@chienleng/stratum-ui/ui';
	import '@chienleng/stratum-ui/themes/neutral.css';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
	const hosted = demoMode;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta
		name="description"
		content="A private dashboard that brings all your Git projects into one clear view."
	/>
</svelte:head>

<header class="site-header">
	<a class="brand" href={resolve('/')} aria-label="Cadence home">
		<span class="brand-mark" aria-hidden="true">CA</span>
		<span>Cadence</span>
	</a>
	<nav aria-label="Primary navigation">
		<Button href={hosted ? resolve('/demo') : resolve('/')} variant="ghost" size="sm"
			>Portfolio</Button
		>
		<Button href={resolve('/docs')} variant="ghost" size="sm">Docs</Button>
		<Button
			href="https://github.com/chienleng/cadence"
			variant="ghost"
			size="sm"
			target="_blank"
			rel="external noreferrer">GitHub</Button
		>
	</nav>
</header>

{@render children()}
