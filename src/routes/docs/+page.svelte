<script lang="ts">
	import { resolve } from '$app/paths';
	import { Alert, Badge, Button, Card, CardContent, CardHeader } from '@chienleng/stratum-ui/ui';
</script>

<svelte:head><title>Set up Cadence</title></svelte:head>

<main class="shell docs-shell">
	<section class="hero" aria-labelledby="overview">
		<p class="eyebrow">Setup</p>
		<h1 id="overview">See every project in one place without uploading your workspace.</h1>
		<p class="lede">
			Cadence is a dashboard you run on your own computer. It reads project information from the
			folders you choose and turns it into a visual view of everything you are working on — status,
			activity, plans, and notes at a glance. A separate <code>cadence-workspace</code> folder keeps your
			project notes and setup, and the whole structure is built for working alongside your own AI agent:
			the agent you already use reads the same files and helps you keep them current. Your real dashboard
			stays on your machine by default.
		</p>
	</section>
	<Alert variant="success" title="Keep one folder safe: cadence-workspace.">
		Back it up with a private Git repository or a reliable backup of your computer. Cadence itself
		can always be downloaded again from GitHub.
	</Alert>
	<Card class="docs-structure-card">
		<CardHeader>
			<p class="eyebrow">Workspace shape</p>
			<h2 id="workspace-shape">Keep project code and Cadence notes separate.</h2>
			<p>
				Each project stays in its own Git repository (a folder tracked by Git). Cadence keeps
				status, plans, and other workspace notes in a separate <code>cadence-workspace</code> repository.
				The fictional demo below shows how those folders fit together.
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
└── cadence-workspace/               # Private project data
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
	<section class="hosting-guide" aria-labelledby="privacy-and-hosting">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Privacy and hosting</p>
				<h2 id="privacy-and-hosting">Keep it local, or share a safe demo.</h2>
			</div>
		</div>
		<p class="hosting-lede">
			For most people, the local setup is the right choice. If you want a public website, publish a
			separate demo containing only information you have checked and approved, not your real local
			dashboard.
		</p>
		<div class="hosting-options">
			<Card class="hosting-option recommended-option">
				<CardHeader>
					<div class="hosting-option-title">
						<h3>Local and private</h3>
						<Badge variant="success">Recommended</Badge>
					</div>
					<p>Your projects, Git status, and Cadence records stay on your computer.</p>
				</CardHeader>
				<CardContent class="prose-stack">
					<ol>
						<li>Download or clone Cadence beside the project folders it will read.</li>
						<li>
							Create <code>cadence-workspace</code>. Keep it in a private Git repository, or leave
							it only on your computer.
						</li>
						<li>Keep private names, plans, decisions, and status notes in that folder.</li>
						<li>
							Back it up with a private Git remote or a reliable computer backup. This is the folder
							you need to recover if something goes wrong.
						</li>
						<li>Start Cadence and open the dashboard on your computer.</li>
					</ol>
					<p>
						If your Cadence app folder is lost, download it from GitHub again, install it, and point
						it at your backed-up <code>cadence-workspace</code>. The app is replaceable; your
						workspace data is not.
					</p>
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
						<h3>Share a public demo</h3>
						<Badge variant="info">Optional</Badge>
					</div>
					<p>Publish a separate example with only information you are comfortable sharing.</p>
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
		<Alert variant="warning" title="Check before you publish.">
			A public Git repository exposes its files and its previous versions. Deleting private
			information in a later commit does not remove it from the repository's history.
		</Alert>
	</section>
	<Card>
		<CardHeader>
			<h2 id="local-setup">Set up your local dashboard</h2>
			<p>These steps assume you already have Git, Node.js, and pnpm installed.</p>
		</CardHeader>
		<CardContent class="prose-stack">
			<ol>
				<li>Download or clone Cadence beside the project folders you want it to read.</li>
				<li>Install dependencies with <code>pnpm install</code>.</li>
				<li>
					Ask your coding agent to read <code>docs/setup-with-ai.md</code> and inspect the workspace.
				</li>
				<li>
					Review the proposed files inside <code>cadence-workspace/projects/</code> before allowing your
					agent to create them.
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
				Cadence never edits monitored repositories. Your own agent does the writing — and it should
				request explicit permission before changing their documentation.
			</p>
			<Button href="https://github.com/chienleng/cadence" target="_blank" rel="external noreferrer"
				>Open the repository</Button
			>
		</CardContent>
	</Card>
</main>
