# Commands

Run these commands from the Cadence checkout. `CADENCE_DATA_ROOT` selects the private data
repository and defaults to `../cadence-workspace`.

## Validate

```bash
pnpm validate
```

Validates configuration, project metadata, lifecycle values, path containment, and duplicate URL
identifiers. It is read-only.

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

The resolver selects the longest registered project path containing `--cwd`, so a nested repository
wins over its registered parent. Normal output includes the complete `STATUS.md` and links to related
plans, decisions, meetings, notes, and inbox records.

`--snippet` prints a deterministic project-level `AGENTS.md` section for review but never applies it.
`--audit` classifies every registered project using the states documented in
[Agent context discovery](agent-context.md). All context operations are read-only.

`--overview` answers workspace-wide status questions from any directory. It aggregates every
project's `STATUS.md` highlights ordered by recency, lists projects without status, collects records
dated within the window (`--days`, default 14), and joins repository activity — dirty working trees,
upstream divergence, recent commits, open issues and pull requests — from the refresh snapshot when
one is present. A missing or old snapshot is reported with a `pnpm refresh` hint rather than failing.

## Refresh repository state

```bash
pnpm refresh
pnpm refresh --local-only
```

Refresh inspects registered project paths only. For local Git repositories it reads the current
branch, dirty-file count, latest commit, origin URL, and existing upstream divergence. It does not
run `git fetch`, so ahead/behind values reflect the refs already available on the machine.

By default, repositories with a GitHub origin are also queried through the authenticated GitHub CLI
for issue, pull-request, privacy, and latest-release summaries. `--local-only` skips those GitHub
queries but still reads local Git.

The only output written is an atomic, disposable `.workspace-cache/projects.json` snapshot inside
Cadence. The snapshot is also read by `pnpm context --overview` to report repository activity.
Tests and integrations may redirect it with `CADENCE_CACHE_ROOT`. Refresh never edits,
checks out, pulls, merges, resets, stashes, or fetches a monitored repository.

## Run and build

```bash
pnpm dev
pnpm build
pnpm dev:demo
pnpm build:demo
```

The normal commands use the local Node provider. Demo commands use fictional committed data and the
Cloudflare adapter; they cannot access the filesystem-backed provider.
