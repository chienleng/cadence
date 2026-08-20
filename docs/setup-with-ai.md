# Set up Cadence with your own AI

Clone Cadence beside the repositories you want to inspect, start it once, then give your coding agent
the following request from the Cadence checkout:

> Read this repository's README, AGENTS.md, docs/product.md, docs/data-contract.md,
> docs/agent-context.md, and fictional example. Inspect the parent workspace read-only. Propose a
> `cadence-workspace` data repository that follows Cadence's principles and registers the
> repositories that genuinely represent projects.
> Do not edit any monitored repository. Show me the proposed groups, paths, summaries, lifecycle
> values, and workspace-level `AGENTS.md` context instruction before writing. After I approve them,
> create only the data repository and workspace-level guide, preserve visible `projects/` records,
> run `pnpm validate` and `pnpm context --audit`, and report anything uncertain instead of inventing
> it.

Review the proposed inventory carefully, particularly client names and anything that should not be
versioned. The data repository should normally remain private.

After setup:

```bash
pnpm validate
pnpm context --audit
pnpm refresh --local-only
pnpm dev
```

The workspace-level `AGENTS.md` should tell every coding agent to run the context resolver before
planning or substantial changes. If a tool does not inherit workspace-level instructions, run
`pnpm context --cwd /path/to/project --snippet` and review the generated section before adding it to
that project's own `AGENTS.md`. Cadence never applies these snippets itself.

Portfolio membership changes only when a project directory and `project.json` are deliberately
added to the data repository. See [Agent context discovery](agent-context.md) for the full contract.
