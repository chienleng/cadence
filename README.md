# Cadence

Cadence brings status, plans, notes and Git activity from your projects into one local dashboard.
See what needs attention, open the relevant records, and pick up where you left off.

Your repositories stay in their existing folders. Cadence reads them without making changes and
keeps workspace records in a separate `cadence-workspace` folder. Your own coding agent can read and
maintain those same records; no AI account or provider is built into Cadence.

[Explore the fictional demo](https://cadence.chienleng.com/demo) or
[read the documentation](docs/README.md).

## Get started

You need Git, Node.js 22 or newer, and the pnpm version pinned in `package.json`.
Run the following from the folder that contains your projects:

```bash
git clone https://github.com/chienleng/cadence.git
cd cadence
pnpm install
```

Next, [set up your workspace](docs/setup-with-ai.md). You can ask your coding agent to help or
adapt the [example files](examples/cadence-workspace/) yourself. By default, Cadence looks for
`cadence-workspace` beside the app checkout.

Once your projects are registered, run these commands from the Cadence checkout:

```bash
pnpm validate
pnpm context --audit
pnpm refresh --local-only
pnpm dev
```

Open <http://cadence.localhost:7613> for the homepage or go straight to the dashboard at
<http://cadence.localhost:7613/projects>. If no workspace is configured, the dashboard shows setup
guidance.
For a different data location, [set `CADENCE_DATA_ROOT`](docs/commands.md#choose-a-data-folder).

## Use the dashboard

- Search and filter projects, then switch between grouped cards and a comparison table.
- Check status, working-tree changes, recent commits and cached GitHub issue/PR counts.
- Open status, plans, decisions and notes alongside source documentation.
- Share a local record link or return to the dashboard with your filters intact.
- Use `pnpm context` to give your coding agent the current status and related records.

Local Git inspection reads the refs already on your machine; Cadence never fetches them.
GitHub counts come from a separate `pnpm refresh` and show when they are stale or unavailable.
[How the dashboard works](docs/product.md) explains these states.

## Keep your records safe

`cadence-workspace` contains your registration, status and project records. Keep it private and
back it up with a private Git remote or a reliable computer backup. The app can be downloaded
again; reinstalling it cannot recover lost records.

Project repositories keep their code and technical documentation. GitHub Issues remain the place
for actionable work. The hosted demo uses fictional data and has no access to your local workspace.
See [privacy, backup and hosting](docs/privacy.md) for recovery steps and the public-demo boundary.

## Common commands

| Command                               | Use it to                                                               |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                            | Open the local dashboard.                                               |
| `pnpm validate`                       | Check workspace configuration and project metadata.                     |
| `pnpm refresh`                        | Update the local Git and GitHub snapshot without changing repositories. |
| `pnpm context --cwd /path/to/project` | Read a project's status and related records.                            |
| `pnpm context --overview`             | Read status across the workspace.                                       |
| `pnpm context --audit`                | Check registration, status freshness and agent discovery.               |

For development, builds and browser tests, see the [command reference](docs/commands.md).
Cadence is available under the [MIT licence](LICENSE).
