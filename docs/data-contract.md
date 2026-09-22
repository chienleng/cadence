# Workspace data reference

Cadence reads a data folder named `cadence-workspace` beside the app by default. Set
[`CADENCE_DATA_ROOT`](commands.md#choose-a-data-folder) to use another location. Keep this folder
private and backed up: its configuration and records are durable data, not generated cache.

```text
cadence-workspace/
├── cadence.config.json
├── projects/
│   └── harbour-api/
│       ├── project.json
│       ├── STATUS.md
│       ├── plans/
│       ├── decisions/
│       ├── meetings/
│       ├── notes/
│       └── inbox/
└── workspace/
    ├── AGENTS.md
    ├── CLAUDE.md                  # Optional compatibility file
    └── skills/
```

The [fictional example](../examples/cadence-workspace/) shows these files together. Adapt its paths,
metadata and workspace instructions before using it for real projects.

## Workspace configuration

`cadence.config.json` requires `schemaVersion: 1`, a display `name` and `workspaceRoot`:

```json
{
	"schemaVersion": 1,
	"name": "Northstar Studio",
	"workspaceRoot": ".."
}
```

`workspaceRoot` is the directory containing your source projects. A relative value resolves from
the data folder, so `".."` means its parent directory. It can also be an absolute path.

## Register a project

Each `projects/**/project.json` registers one project. For a source checkout at
`<workspaceRoot>/harbour-api`, create `projects/harbour-api/project.json`:

```json
{
	"schemaVersion": 1,
	"path": "harbour-api",
	"name": "Harbour API",
	"group": "Products",
	"summary": "A service for coordinating fictional harbour operations.",
	"lifecycle": "active",
	"owners": [],
	"tags": ["example"]
}
```

| Field            | Meaning                                                                              |
| ---------------- | ------------------------------------------------------------------------------------ |
| `path`           | Source path relative to `workspaceRoot`; must match the directory below `projects/`. |
| `name`           | Project display name.                                                                |
| `group`          | Group used in the dashboard and filters.                                             |
| `summary`        | Short description of the project.                                                    |
| `lifecycle`      | One of `active`, `maintained`, `paused`, `dormant`, `archived` or `unknown`.         |
| `owners`, `tags` | Optional lists of names or labels.                                                   |

The first five fields are required. For a nested project, mirror the full path: a declaration of
`"path": "libraries/tide-ui"` belongs at `projects/libraries/tide-ui/project.json` and refers to
`<workspaceRoot>/libraries/tide-ui`. Paths must stay inside the configured workspace.

The source checkout does not have to exist for its saved records to remain readable. Cadence's
audit reports a missing source folder separately. Run `pnpm validate` after registration changes
to catch mismatched paths, invalid metadata and duplicate URL identifiers.

## Write status and records

`STATUS.md` is optional. Use a line of the form `Updated: YYYY-MM-DD` for freshness checks:

```md
# Harbour API status

Updated: 2026-09-07

## Current

- The fictional service is ready for a documentation review.

## Next

- Review setup instructions; track the work in the project's GitHub issue.

## Risks

- Deployment has not been verified.
```

Use the date you actually reviewed the status. An undated or invalid status, or one older than
30 days, is stale. Record what is known and distinguish local work, commits, releases and verified
deployments.

Organise other Markdown records under `plans/`, `decisions/`, `meetings/`, `notes/` and `inbox/`.
Cadence reads them as context; it does not turn them into tasks. Keep actionable work in GitHub
Issues. Stars are stored in browser local storage and are not part of these records.

`workspace/` stores shared agent guides, compatibility files and reusable skills. Expose the guides
at the real workspace root with an intentional copy or symlink. See [Agent context](agent-context.md).

## Cached GitHub data

GitHub facts come from `pnpm refresh`, separately from local Git inspection. Successful data older
than 24 hours, or with a missing, invalid or future timestamp, is stale. Known stale counts remain
visible; failed, unavailable or missing counts remain unknown. Zero means a successful cached
response explicitly reported zero.

Totals show how many applicable projects supplied each count and are labelled partial when some
are missing. Projects known not to use a GitHub remote are excluded from that count's coverage.

A refresh replaces the cache. `--local-only` skips GitHub and removes previously cached GitHub
counts; a failed lookup does not retain the previous successful count. Reload the dashboard after
refreshing. See [Commands](commands.md#refresh-repository-state).

A failed working-tree inspection is unknown, never clean. Missing checkouts and non-repositories
are distinct states. Ahead/behind compares locally known refs; Cadence never fetches refs or
verifies the live remote.

## Cached judgments

When `pnpm refresh` runs with `TYPESAFE_API_KEY`, each project's cache entry carries a
`judgments` object with a `status` entry for STATUS.md and a `guide` entry for the project's
`AGENTS.md`, and the snapshot carries `workspace.guide` and `workspace.shims` for the workspace
guide and its vendor shim. In a status entry, `state` is `updated`, `failed`, `skipped` or
`not-applicable`; `sourceHash`
is the SHA-256 of the judged `STATUS.md`; `status.sections` holds Current, Next and Risks items
with actionability scores and confidences; `status.headings` records each heading's judged role
and whether it deferred to the exact-name convention; `status.updatedAt` and `status.parked` are
the date choice and the probability that the status declares the project parked or in
maintenance mode. Consumers use an entry only when its hash matches the
current file, so an edited status silently returns to the regex convention until the next
refresh. The dashboard maps entries to `confirmed` (hash matches), `stale` (file changed),
`failed`, `absent` (skipped or no cache), `unavailable` (unreadable) and `not-applicable`, and
takes the judged date only when the `Updated:` convention finds none. A guide entry holds
`instructs`, the probability that the guide tells agents to run the context command (zero
without a request when the guide never mentions Cadence), which `pnpm context --audit` uses at
0.7 or above when the literal markers are absent. Entries whose `sourceHash` still matches are
reused by the next refresh instead of being asked again. See [TypeSafe judgments](commands.md#typesafe-judgments).

## File read boundaries

The app and CLI resolve configured roots and source paths before checking containment. A source
path that resolves outside the workspace is invalid, including a missing path beneath an escaping
symlink. Configured data and workspace roots may themselves be deliberate aliases.

Markdown reads stay inside the resolved source or record directory. Optional paths that escape,
disappear or are not regular files are omitted. Workspace guide reads use the workspace boundary.

| Read or discovery operation                | Limit                                                |
| ------------------------------------------ | ---------------------------------------------------- |
| Markdown body, status or guide             | 512 KiB, plus one byte to detect truncation.         |
| Title prefix for app document/record lists | 4 KiB per file.                                      |
| Configuration or project metadata JSON     | 512 KiB.                                             |
| Refresh cache JSON                         | 8 MiB.                                               |
| Markdown discovery                         | 200 matching files, 12 levels and 2,000 directories. |
| Project-definition discovery               | Same traversal bounds, with a 10,000-definition cap. |

Truncated Markdown previews include a notice and end on a complete UTF-8 character. Oversized JSON
is rejected rather than parsed partially. App lists send metadata; only selected records and
source documents include rendered bodies. CLI record discovery includes Markdown files in the
record directories.

Traversal is sorted and skips symlinks, hidden entries, and `build`, `coverage`, `dist`,
`node_modules`, `target` and `vendor` directories. Counts reflect this bounded discovery.

These checks define normal read boundaries in a trusted local workspace. They do not provide an OS
sandbox against concurrent directory replacement or changes to Git's own worktree metadata.
