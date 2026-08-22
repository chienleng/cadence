# Northstar Studio workspace guide

This is fictional example content. Describe the workspace boundaries, shared operating rules, and
how agents should choose project-specific instructions here.

## Cadence context

Before planning or making substantial changes inside a registered project, run:

```bash
pnpm --dir /path/to/cadence context --cwd "$PWD"
```

Adapt `/path/to/cadence` during setup. Read the reported status and relevant plans and decisions;
report missing or uncertain context rather than inventing it.

## Remembering things

When asked to remember something about a project, record it in that project's workspace records —
status and follow-ups in `STATUS.md`, working knowledge in `notes/`, decisions in `decisions/` —
never in vendor-specific agent memory. The workspace records are the single source of truth.
