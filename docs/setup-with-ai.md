# Set up your workspace

Cadence needs two things: the app checkout and a data folder that registers your projects.
This guide uses `cadence-workspace` beside the app. Your source repositories stay where they are.

## Install Cadence

You need Git, Node.js 22 or newer, and pnpm. From the folder that contains your projects:

```bash
git clone https://github.com/chienleng/cadence.git
cd cadence
pnpm install
```

The repository pins its pnpm version in `package.json`. Keep subsequent commands in this checkout,
or use `pnpm --dir /path/to/cadence` when working elsewhere.

## Create the data folder

You can ask your coding agent to prepare it or edit the files yourself. In either case, start with
the [fictional example](../examples/cadence-workspace/) and the [data reference](data-contract.md).
Replace the example names, paths and status with information you have checked.

### With your coding agent

Give your agent this request from the Cadence checkout:

> Read README.md, AGENTS.md, docs/product.md, docs/data-contract.md, docs/agent-context.md and
> examples/cadence-workspace/. Inspect the parent workspace without changing its repositories.
> Propose a cadence-workspace data folder with a project inventory: paths, names, groups, summaries
> and lifecycle values. Identify anything uncertain; do not invent status or plans.
>
> Show me the proposed files and workspace-level AGENTS.md instruction. Once I approve the inventory,
> create the data folder and approved workspace-level instructions. Keep records under visible
> projects/ directories. Do not change existing project repositories. Run pnpm validate and
> pnpm context --audit, then explain anything that still needs attention.

Review the inventory before it is written, especially client names and private context. Keep the
data folder private and backed up. Optional compatibility files for your chosen agent are covered
in [Agent context](agent-context.md#compatibility-files).

### By editing the files

Create this structure beside the Cadence checkout:

```text
your-projects/
├── cadence/
├── harbour-api/                 # An existing project
└── cadence-workspace/
    ├── cadence.config.json
    └── projects/
        └── harbour-api/
            ├── project.json
            └── STATUS.md
```

Use your own workspace name and project metadata. The [data reference](data-contract.md) has
complete JSON examples and explains how paths resolve. `STATUS.md` is optional, but a dated status
helps you and your agent pick up the work later.

Cadence registers only projects with a `projects/**/project.json` file. It does not automatically
register every Git repository it can find.

## Connect your agent to the records

Add a [Cadence context instruction](agent-context.md#workspace-instruction) to your workspace-level
`AGENTS.md`. Keep its canonical copy under `cadence-workspace/workspace/` and expose it at the real
workspace root with a deliberate copy or symlink. Preserve any existing workspace guidance.

Some tools do not read instructions above a project's Git root. Check discovery from inside a
project as well as from the workspace root. Cadence can print a project-level instruction for review:

```bash
pnpm context --cwd /path/to/project --snippet
```

Adding that snippet to a project's `AGENTS.md` is a separate, intentional change; Cadence never
applies it. The [agent guide](agent-context.md) explains compatibility files and audit limitations.

## Validate and open the dashboard

From the Cadence checkout:

```bash
pnpm validate
pnpm context --audit
pnpm refresh --local-only
pnpm dev
```

Open <http://cadence.localhost:7613/projects>. Validation checks the configuration; the audit
reports missing source folders, status records and discovery instructions. A missing checkout can still have
readable records in `cadence-workspace`.

The first refresh above uses local Git only. To include GitHub counts, authenticate the `gh` CLI,
run `pnpm refresh`, and reload the dashboard. See the [command reference](commands.md) for refresh
behaviour and [custom data locations](commands.md#choose-a-data-folder).

## Keep the workspace current

Update each project's `STATUS.md` when substantive work changes its status or next steps. Keep
plans and decisions with its records, and actionable tasks in GitHub Issues. Your agent can help
maintain these files, but Cadence itself only reads them.

Back up `cadence-workspace`. If the app is lost, reinstall it and reconnect the data folder.
The [privacy and backup guide](privacy.md) covers recovery and the separate public-demo workflow.
