<script lang="ts">
	import WorkspaceDashboard from '$lib/components/WorkspaceDashboard.svelte';
	let { data } = $props();
</script>

<svelte:head><title>Fictional workspace demo | Cadence</title></svelte:head>

<WorkspaceDashboard workspace={data.workspace} projectBase="/demo/projects" />
