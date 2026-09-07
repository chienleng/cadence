<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { navigating, page } from '$app/state';
	import { dashboardHref } from '$lib/workspace/navigation';
	import { demoMode } from '$cadence-mode';
	import { Button, OptionsMenu, OptionsMenuItem, Sheet } from '@chienleng/stratum-ui/ui';
	import { ChevronDown } from '@chienleng/stratum-ui/icons';
	import ExternalLink from './icons/ExternalLink.svelte';
	import WorkspaceSidebarFilters from './WorkspaceSidebarFilters.svelte';

	const hosted = demoMode;
	const homeHref = resolve('/');
	const projectsBase = hosted ? resolve('/demo') : resolve('/projects');
	const projectsHref = $derived(dashboardHref(projectsBase, page.url.searchParams));
	const docsHref = resolve('/docs');
	const projectsPath = hosted ? '/demo' : '/projects';
	const projectPathPrefix = hosted ? '/demo/projects/' : '/projects/';
	const docsSections = [
		{ label: 'Overview', hash: '#overview' },
		{ label: 'Local setup', hash: '#local-setup' },
		{ label: 'Workspace files', hash: '#workspace-shape' },
		{ label: 'Privacy and backup', hash: '#privacy-and-hosting' }
	] as const;
	const projectSections = [
		{ label: 'Overview', hash: '#project-overview' },
		{ label: 'Status and work', hash: '#project-workflow' },
		{ label: 'Project state', hash: '#project-state' },
		{ label: 'Recent commits', hash: '#recent-commits' },
		{ label: 'Convention coverage', hash: '#convention-coverage' },
		{ label: 'Knowledge map', hash: '#knowledge-map' }
	] as const;

	let { filtersOpen = $bindable(false) }: { filtersOpen?: boolean } = $props();
	onMount(() => {
		const desktop = window.matchMedia('(min-width: 1001px)');
		const closeOnDesktop = () => {
			if (desktop.matches) filtersOpen = false;
		};
		desktop.addEventListener('change', closeOnDesktop);
		return () => desktop.removeEventListener('change', closeOnDesktop);
	});

	const workspace = $derived(
		page.data.workspace ??
			(page.data.result?.state === 'ready' ? page.data.result.workspace : undefined)
	);
	const activePath = $derived(navigating.to?.url.pathname ?? page.url.pathname);
	const onDocs = $derived(activePath === docsHref || activePath.startsWith(`${docsHref}/`));
	const onProjects = $derived(workspace !== undefined && activePath === projectsPath);
	const onProject = $derived(activePath.startsWith(projectPathPrefix));
	const currentSection = $derived(onDocs ? 'Docs' : onProjects || onProject ? 'Projects' : 'Home');
	const githubDataAsOf = $derived(
		workspace?.projects
			.filter((project) => project.github.state === 'ok' || project.github.state === 'stale')
			.map((project) => project.github.fetchedAt)
			.filter((date): date is string => date !== null)
			.sort()[0] ?? null
	);

	afterNavigate(({ from, to }) => {
		if (from?.url.pathname !== to?.url.pathname) filtersOpen = false;
	});

	function navigate(href: string, close: () => void): void {
		close();
		// href comes from resolve() above.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(href);
	}
</script>

{#snippet brand()}
	<a class="brand" href={homeHref} aria-label="Cadence home">
		<span class="brand-mark" aria-hidden="true">CA</span>
		<span>Cadence</span>
	</a>
{/snippet}

{#snippet navMenu()}
	<OptionsMenu>
		{#snippet trigger({ props })}
			<button {...props} type="button" class="nav-menu-trigger">
				<span>{currentSection}</span>
				<ChevronDown size={14} aria-hidden="true" />
			</button>
		{/snippet}
		{#snippet sections({ close })}
			<OptionsMenuItem onclick={() => navigate(projectsHref, close)}>Projects</OptionsMenuItem>
			<OptionsMenuItem onclick={() => navigate(docsHref, close)}>Docs</OptionsMenuItem>
			<OptionsMenuItem
				href="https://github.com/chienleng/cadence"
				icon={ExternalLink}
				onclick={close}>GitHub</OptionsMenuItem
			>
		{/snippet}
	</OptionsMenu>
{/snippet}

{#snippet docsNav()}
	<nav class="sidebar-section-nav" aria-label="Documentation sections">
		<p>On this page</p>
		<ul>
			{#each docsSections as section (section.hash)}
				{@const active =
					page.url.hash === section.hash || (!page.url.hash && section.hash === '#overview')}
				<li>
					<a href={resolve(`/docs${section.hash}`)} aria-current={active ? 'location' : undefined}
						>{section.label}</a
					>
				</li>
			{/each}
		</ul>
	</nav>
{/snippet}

{#snippet projectNav()}
	<nav class="sidebar-section-nav" aria-label="Project sections">
		<p>On this page</p>
		<ul>
			{#each projectSections as section (section.hash)}
				{@const active =
					page.url.hash === section.hash ||
					(!page.url.hash && section.hash === '#project-overview')}
				<li>
					<!-- activePath is a resolved local route; retain its query while changing section. -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={`${activePath}${page.url.search}${section.hash}`}
						aria-current={active ? 'location' : undefined}>{section.label}</a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
	</nav>
{/snippet}

<aside class="app-sidebar" inert={filtersOpen}>
	<div class="sidebar-brand">
		{@render brand()}
		{@render navMenu()}
	</div>
	{#if onProjects && workspace}
		<WorkspaceSidebarFilters {workspace} />
		<footer class="sidebar-footer">
			<span>Snapshot {new Date(workspace.generatedAt).toLocaleString()}</span>
			{#if githubDataAsOf}
				<span>Oldest GitHub data {new Date(githubDataAsOf).toLocaleString()}</span>
			{/if}
			<span>{workspace.root}</span>
		</footer>
	{:else if onProject}
		{@render projectNav()}
	{:else if onDocs}
		{@render docsNav()}
	{/if}
</aside>

<header class="app-topbar" inert={filtersOpen}>
	<div class="topbar-brand">
		{@render brand()}
		<nav aria-label="Primary navigation">
			{@render navMenu()}
		</nav>
	</div>
	{#if onProjects}
		<Button
			variant="outline"
			size="sm"
			aria-haspopup="dialog"
			aria-expanded={filtersOpen}
			onclick={() => (filtersOpen = true)}>Filters</Button
		>
	{/if}
</header>

{#if onProjects && workspace}
	<Sheet
		open={filtersOpen}
		onclose={() => (filtersOpen = false)}
		side="left"
		align="stretch"
		width="min(24rem, 100vw)"
		backdrop
		title="Filters"
	>
		<WorkspaceSidebarFilters {workspace} announceResults />
	</Sheet>
{/if}
