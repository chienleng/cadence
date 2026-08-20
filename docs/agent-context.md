# Agent context discovery

Cadence keeps portfolio records outside project repositories, so their existence alone cannot make
an agent read them. Discovery is an explicit, testable convention:

1. The workspace-level `AGENTS.md` tells agents to run Cadence before planning or substantial work.
2. `pnpm context --cwd <path>` maps the working directory to the most specific registered project
   and prints its status and related plans, decisions, meetings, notes, and inbox records.
3. `pnpm context --audit` reports whether each project is discoverable and whether its source and
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
````

Some agents only inspect repository-local instructions. For those tools, this prints a deterministic
section for review:

```bash
pnpm context --cwd /path/to/project --snippet
```

Cadence deliberately does not insert or maintain that section. Editing independent repositories is
an explicit adoption decision.

## Audit states

- `ready`: source, discovery instruction, and a current dated status are present.
- `no-status`: discovery works, but the project has no `STATUS.md`.
- `stale`: its status is undated, invalid, or older than 30 days.
- `undiscoverable`: neither the workspace guide nor a generated project pointer is present.
- `missing-source`: the registered project directory cannot be found.

This cannot force an AI system to obey repository instructions. It closes the silent-discovery gap
by making the expected behavior deterministic and independently auditable.
