# Architecture

Cadence has two build modes that feed the same Svelte UI. Routes use a shared workspace-provider
interface; the build chooses where that data comes from.

```text
Local Node build                         Hosted demo build
────────────────                         ─────────────────
Workspace configuration and records       Fictional TypeScript fixture
Source README, AGENTS and docs             No filesystem or Git access
Read-only local Git inspection                         │
              │                                        │
              └──────── Shared workspace data ──────────┘
                                      │
                                Svelte routes/UI
```

Vite selects both the provider and SvelteKit adapter at build time. Local mode uses the Node
adapter and server-only filesystem/process modules. Demo mode uses the Cloudflare adapter and an
in-memory provider, excluding local inspection code from the Worker.

The homepage is `/` in both modes. The local dashboard is `/projects`; the hosted fictional
dashboard is `/demo`. Project detail routes sit beneath their respective dashboard paths.

## Data ownership

| Information                                   | Source                                                  |
| --------------------------------------------- | ------------------------------------------------------- |
| Workspace name and root                       | `cadence.config.json` in the data folder.               |
| Project registration and metadata             | `projects/**/project.json`.                             |
| Current status and workspace records          | Markdown beneath each registered data directory.        |
| Project purpose and operation                 | Source repository `README.md`, `AGENTS.md` and `docs/`. |
| Actionable work                               | GitHub Issues.                                          |
| Local working-tree state and activity         | Read-only Git commands.                                 |
| Cached GitHub facts and CLI activity snapshot | `.workspace-cache/projects.json`.                       |

The context resolver reads the same validated registration data and chooses the longest matching
path for nested projects. Refresh is a separate command: it reads local Git and optional GitHub
metadata, then writes only the ignored cache. It never fetches Git refs.

Path containment, bounded reads and traversal exclusions are shared by the app and CLI. Markdown
rendering disables raw HTML. The [data reference](data-contract.md#file-read-boundaries) lists the
limits and their scope.

## Dashboard and detail requests

Dashboard loads inspect registered projects with four project workers. A shared queue limits Git
to four concurrent subprocesses per Node server process, including simultaneous requests. Commands
have a five-second timeout and 1 MiB output limit; optional Git locks are disabled, and failures
release their queue slots.

A detail request reloads the validated registry and inspects only the selected project. Unknown
project IDs return before Git inspection. Other source checkouts, status records and Git histories
are not scanned. Links to central records need only the data repository's branch and origin.
Status freshness is reused by convention checks within that request.

## Preview loading

Record and document lists contain metadata rather than rendered bodies. Discovery reads up to
4 KiB per file for its title, with four workers per list. If that prefix has no heading, the
filename is used.

Only the selected record and source document receive a full, bounded preview read. Status and
README are the preferred defaults. Selections are restricted to discovered files and fall back
visibly when unavailable. List links do not preload bodies on hover.

Both selections live in URL parameters. They preserve each other, dashboard return filters,
reloads and browser history. The demo follows the same response shape with fictional data.

## Freshness

There is no persistent local scan or Markdown preview cache. Reloading a page or changing a preview
reads the current local state, including restored checkouts and edited files. Selection still
reloads the registry and the selected project's metadata lists; it avoids inspecting every project
or rendering unselected bodies.

GitHub facts are different: the UI reads them from the refresh cache and marks stale or incomplete
data explicitly. See [cached GitHub data](data-contract.md#cached-github-data).
