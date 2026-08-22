# Set up Cadence with your own AI

The recommended setup keeps your real dashboard on your computer. Run Cadence with `pnpm dev`, then
keep `cadence-workspace` in a private Git repository or only on your computer with a reliable
backup. Publishing is a separate, optional demo workflow; it never needs access to your real data.
Read [Privacy and safety](privacy.md) before publishing anything.

Clone Cadence beside the repositories you want to inspect, start it once, then give your coding agent
the following request from the Cadence checkout:

> Read this repository's README, AGENTS.md, docs/product.md, docs/data-contract.md,
> docs/agent-context.md, and fictional example. Inspect the parent workspace read-only. Propose a
> `cadence-workspace` data repository that follows Cadence's principles and registers the
> repositories that genuinely represent projects.
> Do not edit any monitored repository. Show me the proposed groups, paths, summaries, lifecycle
> values, and workspace-level `AGENTS.md` context instruction before writing. After I approve them,
> create only the data repository, workspace-level guide, and vendor compatibility shims, preserve
> visible `projects/` records, run `pnpm validate` and `pnpm context --audit`, and report anything
> uncertain instead of inventing it.

Review the proposed inventory carefully, particularly client names and anything that should not be
versioned. The data repository should normally remain private and be backed up with a private Git
remote or a reliable machine backup.

After setup:

```bash
pnpm validate
pnpm context --audit
pnpm refresh --local-only
pnpm dev
```

`cadence-workspace` is the part you must keep safe. The Cadence app itself can be replaced. If the
app folder is lost, download or clone Cadence from GitHub again, install it, and point it at your
backed-up workspace folder. Reinstalling the app cannot recover plans, decisions, notes, or setup if
every copy of `cadence-workspace` has been lost.

The workspace-level `AGENTS.md` should tell every coding agent to run the context resolver before
planning or substantial changes. Tools that load a vendor-specific file instead need a shim that
loads that guide rather than points at it — for Claude Code, a `CLAUDE.md` at the workspace root
whose content is an `@AGENTS.md` import; a bare "read AGENTS.md first" pointer is routinely
skipped. See [Agent context discovery](agent-context.md) for the shim contract;
`pnpm context --audit` reports a shim that only references the guide as `pointer-only`. Tools that
read `AGENTS.md` natively, such as OpenAI Codex, need no root shim but scope discovery to the Git
root, so sessions inside a sub-repository never load the workspace guide on their own — give those
projects the generated section below, or add a scoped routing rule to the tool's global
instructions (for Codex, `~/.codex/AGENTS.md`). If a tool
does not inherit workspace-level instructions at all, run
`pnpm context --cwd /path/to/project --snippet` and review the generated section before adding it to
that project's own `AGENTS.md`. Cadence never applies these snippets itself.

Project registration changes only when a project directory and `project.json` are deliberately
added to the data repository. See [Agent context discovery](agent-context.md) for the full contract.

## If you want a public cloud demo

Do not deploy the local filesystem-backed application or copy `cadence-workspace` into the app.
Instead, review or replace the deliberately public fixture in
`src/lib/server/demo-workspace.ts`, update `wrangler.jsonc` for your Cloudflare account and domain,
then build and deploy only the demo target:

```bash
pnpm build:demo
pnpm exec wrangler deploy --dry-run
pnpm deploy
```

Treat every fixture value and every committed example as public before running the deploy command.
