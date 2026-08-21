<script lang="ts">
	import { resolve } from '$app/paths';
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
	<Card class="docs-structure-card">
		<CardHeader>
			<p class="eyebrow">Workspace shape</p>
			<h2>Independent repositories, with context beside them.</h2>
			<p>
				The fictional demo uses this structure. Project source stays in its own repository, while
				Cadence reads portfolio context from a separate, versioned data repository.
			</p>
		</CardHeader>
		<CardContent class="prose-stack">
			<figure class="workspace-tree">
				<pre><code
						>your-git-projects/
├── cadence/                         # This application
├── harbour-api/                     # Independent repository
├── signal-console/                  # Independent repository
├── libraries/
│   └── tide-ui/                     # Nested independent repository
└── cadence-workspace/               # Private portfolio data
    ├── cadence.config.json
    ├── projects/
    │   ├── harbour-api/
    │   │   ├── project.json
    │   │   ├── STATUS.md
    │   │   ├── plans/
    │   │   └── decisions/
    │   │       └── local-first.md
    │   ├── signal-console/
    │   │   ├── project.json
    │   │   └── STATUS.md
    │   └── libraries/
    │       └── tide-ui/
    │           └── project.json
    └── workspace/
        ├── AGENTS.md
        └── skills/</code
					></pre>
				<figcaption>
					Project paths below <code>projects/</code> mirror their paths in the workspace.
				</figcaption>
			</figure>
			<ul class="structure-notes">
				<li>
					<strong>Source repositories</strong> own code, <code>README.md</code>,
					<code>AGENTS.md</code>, and technical documentation.
				</li>
				<li>
					<strong>Cadence workspace data</strong> owns registration, current status, plans, decisions,
					meetings, notes, and inbox records.
				</li>
				<li>
					<strong>GitHub Issues</strong> remain the source of truth for actionable work.
				</li>
			</ul>
			<div class="docs-structure-actions">
				<Button href={resolve('/demo')} variant="primary">Explore this demo workspace</Button>
				<Button
					href="https://github.com/chienleng/cadence/tree/main/examples/cadence-workspace"
					variant="outline"
					target="_blank"
					rel="external noreferrer">View the example files</Button
				>
			</div>
		</CardContent>
	</Card>
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
