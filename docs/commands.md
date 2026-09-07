# Command reference

Run commands from the Cadence checkout. From another directory, use
`pnpm --dir /path/to/cadence <command>`.

## Choose a data folder

By default, Cadence reads `cadence-workspace` beside the app. To use another folder, export an
absolute path in the shell session where you run Cadence:

```bash
export CADENCE_DATA_ROOT="/path/to/cadence-workspace"
pnpm validate
pnpm dev
```

Use the same environment for the app and CLI. The CLI scripts do not load `.env` themselves;
putting a value there alone does not configure `validate`, `context` or `refresh`.
`workspaceRoot` inside `cadence.config.json` is a separate setting: it identifies the directory
containing your source projects, relative to the data folder or as an absolute path.

## Validate workspace data

```bash
pnpm validate
```

Checks configuration, required project metadata, lifecycle values, path containment and duplicate
URL identifiers. It is read-only. A valid registration can refer to a missing source checkout;
use the context audit to see which sources are unavailable.

## Load project context

```bash
pnpm context --cwd /path/to/project
pnpm context --cwd /path/to/project --json
pnpm context --cwd /path/to/project --snippet
pnpm context --audit
pnpm context --audit --json
pnpm context --overview
pnpm context --overview --json --days 30
```

| Option         | Result                                                                          |
| -------------- | ------------------------------------------------------------------------------- |
| `--cwd <path>` | Status and related record links for the most specific registered project.       |
| `--json`       | Structured output for tools and scripts.                                        |
| `--snippet`    | A project-level `AGENTS.md` section to review; never applied automatically.     |
| `--audit`      | Registration, source availability, status freshness and agent-discovery checks. |
| `--overview`   | Workspace status highlights, recent records and cached repository activity.     |
| `--days <n>`   | Recent-record window for the overview; defaults to 14 days.                     |

All context operations are read-only. Status text is subject to the
[Markdown read limit](data-contract.md#file-read-boundaries). See [Agent context](agent-context.md)
for discovery instructions and audit states.

The overview combines saved records with the latest refresh snapshot when one exists. It reports
missing or old cache data rather than failing or refreshing automatically.

## Refresh repository state

```bash
pnpm refresh
pnpm refresh --local-only
```

Refresh reads the registered repositories' branches, working-tree changes, recent commits and
locally known upstream comparisons. It never runs `git fetch` or changes a repository.

Normal refresh also queries GitHub through your authenticated `gh` session for issue/PR counts,
repository visibility and the latest release. `--local-only` skips those network queries. Reload
the dashboard after either command.

Each refresh replaces `.workspace-cache/projects.json` in the Cadence checkout. **A local-only
refresh removes previously cached GitHub counts.** A failed GitHub lookup also replaces that
project's earlier successful result with an unavailable state. See
[data freshness](data-contract.md#cached-github-data) for the labels and coverage rules.

This ignored snapshot is disposable. It supplies GitHub data to the dashboard and repository
activity to `pnpm context --overview`. Tests can redirect it with `CADENCE_CACHE_ROOT`. Refresh
never checks out, pulls, merges, resets, stashes or fetches monitored repositories.

## Development and verification

| Command              | Purpose                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `pnpm dev`           | Run the local dashboard at `http://cadence.localhost:7613/projects`. |
| `pnpm build`         | Build the filesystem-backed Node app.                                |
| `pnpm preview`       | Serve the built Node app.                                            |
| `pnpm dev:demo`      | Run the fictional demo in development.                               |
| `pnpm build:demo`    | Build the fictional Cloudflare Worker demo.                          |
| `pnpm preview:demo`  | Run that built Worker locally.                                       |
| `pnpm check`         | Generate environment types and check Svelte/TypeScript.              |
| `pnpm lint`          | Check formatting and lint rules.                                     |
| `pnpm test`          | Run unit tests once.                                                 |
| `pnpm test:e2e`      | Build the Node app and run its browser suite.                        |
| `pnpm test:e2e:demo` | Build the Worker demo and run its browser suite.                     |

Stop the dev server before building. Local and demo builds share SvelteKit's output directory, so
run them sequentially. Demo commands use only fictional data; they cannot access the local provider.
For public publishing, follow the [demo hosting guide](privacy.md#publish-a-fictional-demo).

## Browser tests

Install Chromium once:

```bash
pnpm exec playwright install chromium
```

Then run the two production suites in order:

```bash
pnpm test:e2e
pnpm test:e2e:demo
```

Both use Chromium at desktop and mobile widths. They cover styling and reflow, search and filters,
record/document selection, reload/history, return context and the table. Local fixtures also cover
missing checkouts, unavailable GitHub data and bounded previews. The demo suite uses the built Worker.

Axe and keyboard checks cover dashboard states, modal filters and project previews, including the
record picker's names, active-option references, Escape and reopening. Automated checks complement
manual assistive-technology testing; they do not establish full accessibility or browser conformance.

The local runner creates fictional records, Git repositories and cache data in a unique temporary
directory and removes that directory on shutdown. It does not scan the real workspace or contact
GitHub. Browsers use fresh contexts. Test ports are 17613 (Node), 17614 (Worker) and 17615 (Worker
inspector); an occupied HTTP port fails the run instead of reusing another server.

Failures retain screenshots and traces under `test-results/`, with reports under
`playwright-report/local/` or `playwright-report/demo/`. These directories are ignored by Git.

```bash
pnpm exec playwright show-report playwright-report/local
```

To rerun a subset after a local build:

```bash
pnpm exec playwright test --grep "record links"
```

The GitHub Actions workflow runs static checks, unit tests and both suites on pushes to main and
pull requests. It installs Chromium with `--with-deps` and retains failure artifacts for seven days.
A local pass does not establish that hosted CI has run.

## Recover styles after a dependency update

Stop the dev server before updating Svelte or Stratum. If a direct load has oversized icons or
unstyled controls, restart with a fresh dependency cache:

```bash
pnpm dev --force
```

Reload the browser. Use `pnpm dev:demo --force` for the development demo. This rebuilds Vite's
cache without changing workspace records or monitored repositories.

A running server can retain compiled components whose CSS scopes differ from newly rendered
markup. Reloading the browser alone may not repair that mismatch. Verify a fresh server before
changing component styles.

Check a direct dashboard load, project navigation and mobile Filters. If styles still differ,
record the dependency versions, affected component and whether the production builds reproduce it.
