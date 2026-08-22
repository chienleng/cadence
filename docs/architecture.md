# Architecture

Routes consume one normalized workspace-source interface.

```text
local build                               hosted demo build
cadence-workspace/projects/              fictional TypeScript fixture
workspace README / AGENTS / docs         no filesystem or Git access
read-only local Git inspection                         |
              |                                      |
              +------------ WorkspaceSnapshot -------+
                                      |
                               shared Svelte UI
```

Vite selects the provider and SvelteKit adapter at build time. Local mode uses the Node adapter and
server-only filesystem/process modules. Demo mode uses the Cloudflare adapter and an in-memory
fictional provider, keeping Node inspection code out of the Worker execution path.

## Sources of truth

| Concern                           | Source                                                  |
| --------------------------------- | ------------------------------------------------------- |
| Workspace identity and root       | `cadence.config.json` in the data repository            |
| Project registration and metadata | `projects/**/project.json`                              |
| Current state and durable records | Other Markdown files beneath that project directory     |
| Project purpose and operation     | Source repository `README.md`, `AGENTS.md`, and `docs/` |
| Actionable work                   | GitHub Issues                                           |
| Working-tree and activity state   | Read-only local Git commands                            |
| Disposable refresh snapshot       | `.workspace-cache/projects.json`                        |

Path resolution rejects projects that escape the configured workspace root. Markdown reads are
bounded, generated directories are skipped, and HTML input remains disabled.

The context resolver uses the same validated data root and chooses the longest matching registered
path for nested projects. Refresh operates separately: it reads local Git and optional GitHub state
for registered projects and writes only the ignored Cadence cache. It never fetches Git refs.
