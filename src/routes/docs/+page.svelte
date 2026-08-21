<script lang="ts">
	import { resolve } from '$app/paths';
	import { Alert, Badge, Button, Card, CardContent, CardHeader } from '@chienleng/stratum-ui/ui';
</script>

<svelte:head><title>Set up Cadence</title></svelte:head>

<main class="shell docs-shell">
	<section class="hero">
		<p class="eyebrow">Setup</p>
		<h1>Let your own AI adapt Cadence to your workspace.</h1>
		<p class="lede">
			Cadence is a local-first repository and an opinionated file contract—not an npm package or a
			hosted account. Your real workspace dashboard stays on your machine by default.
		</p>
	</section>
	<Alert variant="success" title="Local and private is the recommended setup.">
		The normal <code>pnpm dev</code> app reads your configured repositories locally. Keep its
		separate <code>cadence-workspace</code> data repository private, or do not give it a remote at all.
	</Alert>
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
	<section class="hosting-guide" aria-labelledby="hosting-title">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Privacy and hosting</p>
				<h2 id="hosting-title">Choose where the view lives.</h2>
			</div>
		</div>
		<p class="hosting-lede">
			Keep the real portfolio local unless you have deliberately decided which information is safe
			to publish. A cloud deployment is a separate demo build, not a hosted copy of the local
			dashboard.
		</p>
		<div class="hosting-options">
			<Card class="hosting-option recommended-option">
				<CardHeader>
					<div class="hosting-option-title">
						<h3>Local and private</h3>
						<Badge variant="success">Recommended</Badge>
					</div>
					<p>Your actual repositories, Git state, and portfolio records stay on your machine.</p>
				</CardHeader>
				<CardContent class="prose-stack">
					<ol>
						<li>Clone Cadence beside the repositories it will inspect.</li>
						<li>
							Create <code>cadence-workspace</code> as a private Git repository, or leave it without a
							remote.
						</li>
						<li>
							Keep client names, plans, decisions, and status records only in that private data
							repository.
						</li>
						<li>Run and open the filesystem-backed UI locally.</li>
					</ol>
					<pre class="command-block"><code
							>pnpm validate
pnpm refresh --local-only
pnpm dev</code
						></pre>
				</CardContent>
			</Card>
			<Card class="hosting-option">
				<CardHeader>
					<div class="hosting-option-title">
						<h3>Public cloud demo</h3>
						<Badge variant="info">Optional</Badge>
					</div>
					<p>Publish only a deliberately public, filesystem-free snapshot through Cloudflare.</p>
				</CardHeader>
				<CardContent class="prose-stack">
					<ol>
						<li>Keep the real <code>cadence-workspace</code> repository private.</li>
						<li>
							Replace or review <code>src/lib/server/demo-workspace.ts</code> so every name and record
							is safe to publish.
						</li>
						<li>
							Update <code>wrangler.jsonc</code> for your own Cloudflare account, Worker name, and domain.
						</li>
						<li>Build, inspect, and deploy only the demo target.</li>
					</ol>
					<pre class="command-block"><code
							>pnpm build:demo
pnpm exec wrangler deploy --dry-run
pnpm deploy</code
						></pre>
				</CardContent>
			</Card>
		</div>
		<Alert variant="warning" title="Publishing is a deliberate disclosure decision.">
			If you make a data repository public, assume every file and every prior Git commit is public.
			Removing private material in a later commit does not remove it from history.
		</Alert>
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
