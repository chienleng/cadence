# Cadence agent guide

Cadence is a reusable local-first SvelteKit application. Read `README.md` and `docs/` before making
changes.

## Boundaries

- Keep local repository scanning server-side and restrict it to project paths declared in the data
  repository.
- Never write to, fetch, or otherwise mutate monitored repositories.
- Durable Cadence data lives in the configured external data repository under visible `projects/`.
- Keep `pnpm context` deterministic and read-only; it is the agent-facing bridge to those records.
- Do not add a general in-app AI provider. Users bring their own terminal or editor agent.
  The one exception is TypeSafe (Jev) for typed judgments; see the TypeSafe section below.
- The hosted demo must use fictional fixtures and must not bundle filesystem, Git, or child-process
  code.
- GitHub Issues remain the source of truth for actionable work.

## Stack and verification

- SvelteKit 2, Svelte 5 runes, TypeScript, Stratum UI, pnpm, Node 22+, Vitest.
- Local development: `pnpm dev` at `cadence.localhost:7613`.
- Material changes: `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm build:demo`.
- Worker changes: also run `pnpm preview:demo` or a Wrangler dry run.
- Deploy only when explicitly requested.

Use Stratum UI components and semantic `--su-*` tokens before adding local primitives or visual
variables. Preserve unrelated working-tree changes.

## TypeSafe

- Jev (TypeSafe's System One model) is the first AI model Cadence explicitly supports, chosen for
  its speed and reliable typed judgments (decision 2026-09-22). Support is additive: users may
  still bring other frontier models via their own agents.
- Load the `typesafe-ai` skill (`typesafe-ai/skills`) before designing or writing any TypeSafe
  integration, and treat https://docs.typesafe.ai/ as the source of truth.
- Keep API credentials server-side, degrade cleanly without a key, and never make live TypeSafe
  calls from the hosted demo, which must stay on fictional fixtures.
- Scope concrete integration work as GitHub Issues before implementing.
