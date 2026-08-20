# Cadence

Cadence is a local-first control room for a workspace of independent repositories. It combines
visible, versioned project records with read-only filesystem and Git inspection so people and their
chosen coding agents can understand what exists, what changed, and what needs attention.

Cadence is a repository, not an npm package or hosted account. Real workspace data never powers the
public demo.

## Principles

- Every project remains an independent repository.
- Project repositories own their `README.md`, `AGENTS.md`, and durable `docs/`.
- A separate private data repository owns portfolio metadata, status, plans, decisions, meetings,
  notes, and inboxes under a visible `projects/` directory.
- GitHub Issues hold actionable work; Cadence does not duplicate an issue tracker.
- Cadence never writes to monitored repositories.
- Users bring their own AI. Cadence provides an inspectable contract, not an in-app model.

## Start

Requirements: Node 22+ and Corepack-enabled pnpm.

```bash
git clone https://github.com/chienleng/cadence.git
cd cadence
pnpm install
pnpm dev
```

Cadence looks for `../cadence-workspace` by default. A missing repository opens a guided setup state.
To use another location, set `CADENCE_DATA_ROOT` in `.env`.

Ask your coding agent to read [`docs/setup-with-ai.md`](docs/setup-with-ai.md) and adapt the example
data repository to your workspace. Then run:

```bash
pnpm validate
pnpm refresh --local-only
pnpm dev
```

The local app is served at <http://cadence.localhost:7613>.

## Commands

| Command                                  | Purpose                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                               | Run the local filesystem-backed app.                                    |
| `pnpm validate`                          | Validate the configured data repository without writing.                |
| `pnpm context --cwd <path>`              | Resolve a project and print its status and related records.             |
| `pnpm context --audit`                   | Audit agent discovery and status coverage across the workspace.         |
| `pnpm refresh`                           | Refresh ignored cache data; never fetch or change project repositories. |
| `pnpm dev:demo`                          | Run the fictional hosted experience locally.                            |
| `pnpm build`                             | Build the local Node application.                                       |
| `pnpm build:demo`                        | Build the data-less Cloudflare Worker demo.                             |
| `pnpm check` / `pnpm lint` / `pnpm test` | Verify the repository.                                                  |

Command details, architecture, privacy, and the data contract are documented in
[`docs/`](docs/README.md). Cadence is available under the [MIT licence](LICENSE).
