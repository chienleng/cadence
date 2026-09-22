# Give your agent project context

Cadence stores project records outside the source repositories. An agent needs an instruction to
find those records and read them before starting work.

`pnpm context --cwd /path/to/project` finds the most specific registered project for that path and
prints its status and related record links. Nested projects take precedence over their parents.
For workspace-wide questions, use `pnpm context --overview`. Both commands are read-only and do
not call an AI provider.

## Workspace instruction

Add a section like this to the workspace-level `AGENTS.md`, replacing the Cadence path:

````md
## Cadence context

Before planning or making substantial changes inside a registered project, run:

```bash
pnpm --dir /path/to/cadence context --cwd "$PWD"
```

Read the reported status and relevant plans and decisions. Report missing or uncertain context;
do not invent it. GitHub Issues remain the source of actionable work.

Keep the project's STATUS.md and relevant plans current after substantive work. Distinguish local
changes, commits, releases and verified deployments. Preserve unrelated notes and parked work.

When asked to remember something about a project, use its workspace records: STATUS.md for status
and follow-ups, notes/ for working knowledge, and decisions/ for decisions. Do not put shared
project knowledge in vendor-specific agent memory.
````

Keep the canonical guide in `cadence-workspace/workspace/AGENTS.md` and expose it at the real
workspace root with a copy or symlink. Preserve existing guidance when adopting this convention.

## Discovery inside a project

A tool may read only instructions within the current repository. Do not assume it also loads a
guide in the parent workspace. Test this from the directory where you normally start the agent.

Cadence can print a deterministic project-level section for review:

```bash
pnpm context --cwd /path/to/project --snippet
```

Add it to that project's `AGENTS.md` only as an intentional documentation change. Alternatively,
use a scoped workspace-routing instruction supported by your tool. Cadence does not write either
kind of instruction itself.

## Compatibility files

Some tools use a vendor-specific instruction file. Cadence's example includes a Claude Code
`CLAUDE.md` with an import of the shared guide:

```md
@AGENTS.md
```

Keep the canonical compatibility file beside the guide under `cadence-workspace/workspace/`,
then expose it at the real workspace root. A plain sentence pointing at the guide is not the same
as the load directive Cadence checks for. Tools that read `AGENTS.md` directly do not need this file.

`pnpm context --audit` reports known compatibility files as:

| State          | Meaning                                                            |
| -------------- | ------------------------------------------------------------------ |
| `ok`           | The expected load directive is present.                            |
| `pointer-only` | The file exists but lacks the load directive.                      |
| `absent`       | The file does not exist; this is fine if you do not use that tool. |

## Check the setup

```bash
pnpm context --audit
```

The audit assigns each registered project one state, in this order of precedence:

| State            | Meaning                                                                                |
| ---------------- | -------------------------------------------------------------------------------------- |
| `missing-source` | The registered source directory is unavailable.                                        |
| `undiscoverable` | Neither a recognised workspace instruction nor a generated project pointer is present. |
| `no-status`      | Discovery is configured, but `STATUS.md` is missing.                                   |
| `stale`          | The status is undated, has an invalid date, or is older than 30 days.                  |
| `ready`          | Source, discovery instruction and a current dated status are present.                  |

Each project also reports how discovery was established: a generated project pointer, the
recognised workspace instruction, or, when neither literal marker is present, a judged reading.
With `TYPESAFE_API_KEY` set, `pnpm refresh` asks Jev (TypeSafe) whether each project's `AGENTS.md`,
the workspace guide and the `CLAUDE.md` shim instruct agents to run the context command, using
only the lines that mention Cadence; guides that never mention it are answered without a request.
A judged reading counts for discovery at or above 0.7 and only while the guide text matches what
was judged. The audit prints every judged probability and flags where it disagrees with the
literal check, so a guide that instructs agents in its own words, or a marker inside a "do not"
example, is visible either way. See [TypeSafe judgments](commands.md#typesafe-judgments).

A `ready` result verifies the files and markers Cadence recognises. It does not prove that an agent
loaded the guide or followed it. Check your tool's actual behaviour as part of adoption.
See the [command reference](commands.md#load-project-context) for JSON output and workspace summaries.
