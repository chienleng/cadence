<script lang="ts">
	import { Badge } from '@chienleng/stratum-ui/ui';
	import { githubDetail, githubLabel } from '$lib/workspace/data-quality';
	import type { GithubSnapshot } from '$lib/workspace/types';
	let { github }: { github: GithubSnapshot } = $props();
</script>

<span title={githubDetail(github)}>
	<Badge
		variant={github.state === 'ok' || github.state === 'not-applicable' ? 'neutral' : 'warning'}
	>
		{githubLabel(github)}
	</Badge>
</span>
