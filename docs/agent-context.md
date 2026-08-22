# Agent context discovery

Cadence keeps project records outside project repositories, so their existence alone cannot make
an agent read them. Discovery is an explicit, testable convention:

1. The workspace-level `AGENTS.md` tells agents to run Cadence before planning or substantial work.
2. `pnpm context --cwd <path>` maps the working directory to the most specific registered project
   and prints its status and related plans, decisions, meetings, notes, and inbox records.
3. `pnpm context --overview` answers workspace-wide status questions ("what's my latest status?")
   from any directory: statuses ordered by recency, recent records, and repository activity joined
   from the refresh snapshot when present.
4. `pnpm context --audit` reports whether each project is discoverable and whether its source and
   status are present and current.

The command is read-only. It never edits a project, creates records, or asks an AI provider for
information. Nested repositories are resolved by the longest registered path match.

## Workspace instruction

The setup agent should add a section like this to the workspace guide, adapting the Cadence path to
the local checkout:

````md
## Cadence context

Before planning or making substantial changes inside a registered project, run:

```bash
pnpm --dir /path/to/cadence context --cwd "$PWD"
```

Read the reported status and relevant plans and decisions. Report missing or uncertain context;
do not invent it. GitHub Issues remain the source of actionable work.

When asked to remember something about a project, record it in that project's workspace records —
status and follow-ups in `STATUS.md`, working knowledge in `notes/`, decisions in `decisions/` —
never in vendor-specific agent memory. The workspace records are the single source of truth.
````

Some agents only inspect repository-local instructions. For those tools, this prints a deterministic
section for review:

```bash
pnpm context --cwd /path/to/project --snippet
```

Cadence deliberately does not insert or maintain that section. Editing independent repositories is
an explicit adoption decision.

## Vendor compatibility shims

Some tools load a vendor-specific file at the workspace root instead of `AGENTS.md` — Claude Code
loads `CLAUDE.md`. A shim that merely says "read AGENTS.md first" depends on the model choosing to
open the guide before acting, and quick tasks routinely skip that read. A shim must load the guide,
not point at it. For Claude Code, the shim's content should be an import:

```md
@AGENTS.md

The import above inlines AGENTS.md — the canonical, vendor-neutral guide for this workspace — so
its rules load automatically every session. Follow them before acting on anything.
```

Version the canonical shim in the data repository's `workspace/` directory beside `AGENTS.md` and
copy it to the real workspace root. `pnpm context --audit` reports each known shim file as `ok`
(load directive present), `pointer-only` (present but only references the guide), or `absent`
(fine when that vendor's tool is not used).

Tools that read `AGENTS.md` natively need no shim at the workspace root — OpenAI Codex, which
originated the convention, loads the guide directly when launched at the workspace root. Native
readers can still miss the guide from inside a sub-repository: Codex's project scope starts at the
Git root and walks down, never up into a containing workspace. Close that gap with the per-project
pointer (`pnpm context --cwd <project> --snippet`), or with a scoped routing rule in the tool's
global instructions (for Codex, `~/.codex/AGENTS.md`, which loads every session).

## Audit states

- `ready`: source, discovery instruction, and a current dated status are present.
- `no-status`: discovery works, but the project has no `STATUS.md`.
- `stale`: its status is undated, invalid, or older than 30 days.
- `undiscoverable`: neither the workspace guide nor a generated project pointer is present.
- `missing-source`: the registered project directory cannot be found.

The audit also reports workspace vendor shims. A `pointer-only` shim references the guide without
loading it and should have its content replaced with the vendor's load directive.

This cannot force an AI system to obey repository instructions. It closes the silent-discovery gap
by making the expected behavior deterministic and independently auditable.
