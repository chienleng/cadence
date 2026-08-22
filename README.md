# Cadence

Cadence is a private dashboard for all your Git projects. It brings project status, plans, notes,
and local Git activity into one visual view, so you can quickly see what changed and what needs
your attention — and it is designed for working alongside your own AI agent.

You run Cadence on your own computer. Each project stays in its existing folder and Git repository,
and Cadence reads them without making changes. The [public site](https://cadence.chienleng.com) uses
fictional demo data and never has access to your real workspace.

> **Keep one folder safe:** `cadence-workspace` contains your Cadence setup and project records.
> Keep it private and back it up with a private Git remote or a reliable backup of your computer.
> The Cadence app can always be downloaded again from GitHub, but your workspace data cannot be
> recreated if every copy is lost.

## What Cadence gives you

- One updated, visual view across separate projects and Git repositories.
- Visible status, plans, decisions, meetings, notes, and workspace guidance.
- Read-only local Git inspection, with optional GitHub information when you request a refresh.
- A documented structure built for the coding agent you already trust — your own agent reads it,
  keeps it current, and answers questions about your workspace.
- A local dashboard by default, with a separate fictional demo for public hosting.

## How your workspace stays organised

- Every project remains an independent repository.
- Project repositories keep their code, `README.md`, `AGENTS.md`, and technical documentation.
- The separate `cadence-workspace` repository keeps portfolio information such as status, plans,
  decisions, meetings, and notes under a visible `projects/` folder.
- GitHub Issues remain the place for actionable work. Cadence does not replace your issue tracker.
- Cadence never writes to monitored repositories.
- You bring your own AI. Cadence does not require an in-app model or AI account.

## Set up your local dashboard

You will need Git, Node.js 22 or newer, and pnpm enabled through Corepack.

```bash
git clone https://github.com/chienleng/cadence.git
cd cadence
pnpm install
pnpm dev
```

Cadence looks for a `cadence-workspace` folder beside the app by default. If it cannot find one, the
dashboard shows setup guidance. To keep the folder somewhere else, set `CADENCE_DATA_ROOT` in
`.env`.

Ask your coding agent to read [`docs/setup-with-ai.md`](docs/setup-with-ai.md) and adapt the example
data repository to your workspace. Then run:

```bash
pnpm validate
pnpm refresh --local-only
pnpm dev
```

Open the local dashboard at <http://cadence.localhost:7613>.

## Back up and restore

Treat the Cadence app as replaceable and `cadence-workspace` as your durable data:

1. Keep `cadence-workspace` private unless you deliberately want its contents to be public.
2. Back it up with a private Git remote or a reliable computer backup.
3. If the Cadence app folder is lost, clone this repository again and run `pnpm install`.
4. Put the restored `cadence-workspace` beside Cadence, or point `CADENCE_DATA_ROOT` to it.
5. Run `pnpm validate`, then start the dashboard with `pnpm dev`.

See [Privacy and safety](docs/privacy.md) before publishing any repository or demo.

## Commands

| Command                                  | Purpose                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                               | Start the local dashboard.                                              |
| `pnpm validate`                          | Check the workspace data without changing it.                           |
| `pnpm context --cwd <path>`              | Show the saved status and records for one project.                      |
| `pnpm context --audit`                   | Check project coverage and whether coding agents can find the guidance. |
| `pnpm refresh`                           | Update cached Git and GitHub information without changing projects.     |
| `pnpm dev:demo`                          | Run the fictional public demo locally.                                  |
| `pnpm build`                             | Build the local Node.js application.                                    |
| `pnpm build:demo`                        | Build the public Cloudflare demo without local workspace access.        |
| `pnpm check` / `pnpm lint` / `pnpm test` | Check the codebase for problems.                                        |

For command details, architecture, privacy, and the data format, read the
[full documentation](docs/README.md). Cadence is available under the [MIT licence](LICENSE).
