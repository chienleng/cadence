# Set up Cadence with your own AI

Clone Cadence beside the repositories you want to inspect, start it once, then give your coding agent
the following request from the Cadence checkout:

> Read this repository's README, AGENTS.md, docs/product.md, docs/data-contract.md, and fictional
> example. Inspect the parent workspace read-only. Propose a `cadence-workspace` data repository that
> follows Cadence's principles and registers the repositories that genuinely represent projects.
> Do not edit any monitored repository. Show me the proposed groups, paths, summaries, and lifecycle
> values before writing. After I approve them, create only the data repository, preserve visible
> `projects/` records, run `pnpm validate`, and report anything uncertain instead of inventing it.

Review the proposed inventory carefully, particularly client names and anything that should not be
versioned. The data repository should normally remain private.

After setup:

```bash
pnpm validate
pnpm refresh --local-only
pnpm dev
```

Cadence will report new repositories during future agent-led reviews, but portfolio membership
changes only when a project directory and `project.json` are deliberately added to the data repo.
