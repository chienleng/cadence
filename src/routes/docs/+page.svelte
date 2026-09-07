<script lang="ts">
	import { resolve } from '$app/paths';
	import { Alert, Badge, Button, Card, CardContent, CardHeader } from '@chienleng/stratum-ui/ui';
</script>

<svelte:head><title>Set up Cadence</title></svelte:head>

<main class="shell docs-shell">
	<section class="hero" aria-labelledby="overview">
		<p class="eyebrow">Setup</p>
		<h1 id="overview">Bring your projects into Cadence.</h1>
		<p class="lede">
			Run Cadence on your computer to read status, plans, notes and Git activity in one place. Your
			repositories stay where they are. A separate <code>cadence-workspace</code> folder holds your project
			records, which your own coding agent can also read and maintain.
		</p>
	</section>
	<Card>
		<CardHeader>
			<h2 id="local-setup">Set up your local dashboard</h2>
			<p>You need Git, Node.js 22 or newer, and pnpm.</p>
		</CardHeader>
		<CardContent class="prose-stack">
			<p>From the folder that contains your projects, install Cadence:</p>
			<pre class="command-block"><code
					>git clone https://github.com/chienleng/cadence.git
cd cadence
pnpm install</code
				></pre>
			<ol>
				<li>
					Follow <a
						href="https://github.com/chienleng/cadence/blob/main/docs/setup-with-ai.md"
						target="_blank"
						rel="external noreferrer">the workspace setup guide</a
					>
					to create
					<code>cadence-workspace</code> beside the app. Ask your coding agent to help or adapt the example
					files yourself.
				</li>
				<li>
					Review your project paths, names and status. Cadence registers projects through
					<code>projects/**/project.json</code>; it does not register every repository
					automatically.
				</li>
				<li>
					Add the workspace context instruction to your shared <code>AGENTS.md</code> and check that your
					agent can find it from inside a project.
				</li>
			</ol>
			<p>Then validate the data and start the dashboard from the Cadence checkout:</p>
			<pre class="command-block"><code
					>pnpm validate
pnpm context --audit
pnpm refresh --local-only
pnpm dev</code
				></pre>
			<p>
				Open <code>http://cadence.localhost:7613/projects</code>. The local-only refresh reads Git
				without querying GitHub. To include GitHub counts, authenticate the <code>gh</code> CLI, run
				<code>pnpm refresh</code>, then reload.
			</p>
			<p>
				Cadence reads your records without changing them. You or your agent maintain the files;
				actionable work stays in GitHub Issues.
			</p>
			<Button
				href="https://github.com/chienleng/cadence/tree/main/docs"
				target="_blank"
				rel="external noreferrer"
			>
				Read the full documentation
			</Button>
		</CardContent>
	</Card>
	<Card class="docs-structure-card">
		<CardHeader>
			<p class="eyebrow">Workspace files</p>
			<h2 id="workspace-shape">Where everything lives</h2>
			<p>
				Source repositories hold code and technical documentation. The private
				<code>cadence-workspace</code> folder holds registration, status, plans and other records. This
				fictional example shows how the paths line up.
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
			<div class="docs-structure-actions">
				<Button href={resolve('/demo')} variant="primary">Explore the fictional demo</Button>
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
				<p class="eyebrow">Privacy and backup</p>
				<h2 id="privacy-and-hosting">Keep your workspace private and backed up</h2>
			</div>
		</div>
		<p class="hosting-lede">
			Your normal dashboard stays on your computer. The hosted demo is a separate build with only
			fictional data and no access to your workspace.
		</p>
		<div class="hosting-options">
			<Card class="hosting-option recommended-option">
				<CardHeader>
					<div class="hosting-option-title">
						<h3>Your workspace records</h3>
						<Badge variant="success">Private</Badge>
					</div>
					<p>Back up <code>cadence-workspace</code>, including its configuration and records.</p>
				</CardHeader>
				<CardContent class="prose-stack">
					<p>
						Use a private Git remote or a reliable computer backup. If you use Git, commit and push
						the records you want to keep. Cadence does not perform backups for you.
					</p>
					<p>
						If the app is lost, reinstall it and reconnect your data folder. Reinstalling Cadence
						cannot recover records if every copy of <code>cadence-workspace</code> is lost.
					</p>
				</CardContent>
			</Card>
			<Card class="hosting-option">
				<CardHeader>
					<div class="hosting-option-title">
						<h3>A public demo</h3>
						<Badge variant="info">Optional</Badge>
					</div>
					<p>Share a separate example containing only information suitable for public use.</p>
				</CardHeader>
				<CardContent class="prose-stack">
					<p>
						Review the demo fixture and examples, configure your Cloudflare account, and inspect the
						demo build before deploying. Keep private workspace files outside the app.
					</p>
					<Button
						href="https://github.com/chienleng/cadence/blob/main/docs/privacy.md#publish-a-fictional-demo"
						variant="outline"
						target="_blank"
						rel="external noreferrer">Read the hosting guide</Button
					>
				</CardContent>
			</Card>
		</div>
		<Alert variant="warning" title="Review Git history before publishing.">
			Review earlier commits before making a repository public. Deleting private files in a later
			commit does not remove them from its history.
		</Alert>
	</section>
</main>
