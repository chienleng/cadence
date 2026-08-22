# Data contract

Cadence expects a private data repository selected by `CADENCE_DATA_ROOT`. It defaults to a
`cadence-workspace` directory beside the public application checkout.

```text
cadence-workspace/
├── cadence.config.json
├── projects/
│   └── project-path/
│       ├── project.json
│       ├── STATUS.md
│       ├── plans/
│       ├── decisions/
│       ├── meetings/
│       ├── notes/
│       └── inbox/
└── workspace/
    ├── AGENTS.md
    └── skills/
```

The visible `projects/` tree is durable data, not generated cache. Commit it to the private data
repository so people and their chosen tools can inspect its history. The `workspace/` directory
versions workspace-level guides and reusable skills; expose them at the real workspace root using a
deliberate symlink or copy so compatible agents can discover them.

`cadence.config.json` contains schema version `1`, a display `name`, and `workspaceRoot`. Relative
workspace roots resolve from the data repository.

Every recursively discovered `projects/**/project.json` registers one project. Its required fields
are `path`, `name`, `group`, `summary`, and `lifecycle`. Lifecycle is one of `active`, `maintained`,
`paused`, `dormant`, `archived`, or `unknown`. Optional fields are `priority`, `owners`, and `tags`.

The declared path must exactly match the containing path below `projects/` and must resolve inside
the configured workspace. This deliberate redundancy catches accidental moves and unsafe paths.

`STATUS.md` is optional. To participate in freshness auditing, it should contain an exact
`Updated: YYYY-MM-DD` line; statuses older than 30 days are reported as stale. Other Markdown files
may be organized beneath `plans/`, `decisions/`, `meetings/`, `notes/`, and `inbox/`. Cadence treats
these as durable context and does not convert them into tasks.

See [`../examples/cadence-workspace/`](../examples/cadence-workspace/) for a complete fictional
example. Adapt its paths and workspace instruction before use. Run `pnpm validate` and
`pnpm context --audit` after editing data.
