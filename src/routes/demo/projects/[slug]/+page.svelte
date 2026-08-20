<script lang="ts">
	import ProjectDetail from '$lib/components/ProjectDetail.svelte';
	let { data } = $props();
</script>

<ProjectDetail {data} backHref="/demo" />
