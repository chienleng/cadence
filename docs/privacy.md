# Privacy and safety

## Recommended: local UI and private data

Cadence's normal UI is designed to stay local. `pnpm dev` runs the filesystem-backed application on
your machine, where it can read only the repositories registered beneath the configured workspace
root. It is not a hosted account and does not upload the dashboard or workspace records.

Keep `cadence-workspace` private by default. Either create it as a private Git repository or leave
it without a remote. This repository may contain client names, project paths, status notes, plans,
decisions, meetings, and other portfolio context even when the source repositories themselves are
public.

```bash
pnpm validate
pnpm refresh --local-only
pnpm dev
```

The local application reads only configured paths. It renders bounded Markdown with raw HTML
disabled and runs Git commands with argument arrays rather than shell interpolation.

Cadence does not send workspace content to an AI provider. A user may independently authorize their
own local or hosted coding agent to inspect files; that agent's privacy terms and permissions remain
the user's responsibility.

`pnpm context`, `pnpm validate`, and local-only refresh do not contact an AI provider. Normal refresh
may query GitHub through the user's authenticated `gh` session; `--local-only` disables those network
queries while retaining read-only local Git inspection.

## Optional: public cloud demo

The public site is a separate demo build backed only by deliberately public committed data. It has
no storage bindings, account system, repository credentials, or access to the local provider. The
Cloudflare build excludes local filesystem and Git inspection code; it cannot turn the real local
dashboard into a hosted service.

Before deploying a fork:

1. Keep the real `cadence-workspace` repository private.
2. Replace or review `src/lib/server/demo-workspace.ts` and every committed example so all names,
   paths, summaries, and records are safe to publish.
3. Update `wrangler.jsonc` for your Cloudflare account, Worker name, and domain.
4. Build and inspect the demo target, run a Wrangler dry run, then deploy.

```bash
pnpm build:demo
pnpm exec wrangler deploy --dry-run
pnpm deploy
```

Only the demo fixture is included in that deployment. Never copy a private `cadence-workspace`
repository into the Cadence application or its build output.

If you intentionally make a previously private application or data repository public, create a
clean Git history after removing private material. Deleting private files in a later commit does not
remove them from earlier commits.
