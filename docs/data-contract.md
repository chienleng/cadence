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

`cadence.config.json` contains schema version `1`, a display `name`, and `workspaceRoot`. Relative
workspace roots resolve from the data repository.

Every recursively discovered `projects/**/project.json` registers one project. Its required fields
are `path`, `name`, `group`, `summary`, and `lifecycle`. Lifecycle is one of `active`, `maintained`,
`paused`, `dormant`, or `unknown`. Optional fields are `priority`, `owners`, and `tags`.

The declared path must exactly match the containing path below `projects/` and must resolve inside
the configured workspace. This deliberate redundancy catches accidental moves and unsafe paths.

See [`../examples/cadence-workspace/`](../examples/cadence-workspace/) for a complete fictional
example. Run `pnpm validate` after editing data.
