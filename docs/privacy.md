# Privacy, backup and hosting

The normal Cadence dashboard runs on your computer. It reads registered project folders and your
workspace records without uploading them to the hosted demo or an AI provider.

## What stays local

Keep `cadence-workspace` private. It may contain client names, paths, plans, decisions and status
notes even when some of your source repositories are public. You can keep it in a private Git
repository or use another reliable backup without adding a remote.

The app reads configured paths, limits Markdown reads, disables raw HTML in previews and runs Git
with argument arrays. These are read boundaries for a trusted local workspace; they are not an OS
sandbox. See the [data reference](data-contract.md#file-read-boundaries) for their scope.

`pnpm context`, `pnpm validate` and `pnpm refresh --local-only` do not query GitHub or an AI provider.
Normal `pnpm refresh` uses your authenticated `gh` session to request GitHub metadata. If
`TYPESAFE_API_KEY` is exported, it also sends each project's `STATUS.md` text to TypeSafe's API so
Jev can classify its sections; nothing else is sent, the key stays in your shell, and the cached
answers live in the same ignored snapshot. Opening a GitHub link in the dashboard also takes you
to GitHub.

Your own coding agent is separate from Cadence. If you allow a local or hosted agent to read files,
its permissions and privacy terms govern that access.

## Back up and restore

Back up `cadence-workspace` with a private Git remote or a reliable computer backup. If you use Git,
remember to commit and push the records you want the remote backup to contain. Cadence does not
perform those steps for you. Back up source repositories separately as usual.

To restore the dashboard after losing the app checkout:

1. Clone Cadence again and run `pnpm install`.
2. Restore `cadence-workspace` beside it, or [set its location](commands.md#choose-a-data-folder).
3. Run `pnpm validate` to check the restored configuration.
4. Run `pnpm refresh --local-only`, then `pnpm dev`.

The app and refresh cache can be recreated. Reinstalling Cadence cannot recover records if every
copy of `cadence-workspace` is lost.

## Publish a fictional demo

The public site uses a separate build with a fictional provider. It has no local filesystem or Git
inspection code, workspace credentials, account system or storage bindings. Deploying that build
does not host your real dashboard.

To publish your own demo:

1. Keep your real workspace data outside the application checkout and private.
2. Review the fictional fixture in `src/lib/server/demo-workspace.ts` and the committed examples.
   Every name, path and record in them must be suitable for public sharing.
3. Update `wrangler.jsonc` for your Cloudflare account, Worker name and domain.
4. Build the demo, inspect it locally, then run a dry run before deploying.

```bash
pnpm build:demo
pnpm preview:demo
```

After inspecting the preview, stop it and deploy only when you intend to publish:

```bash
pnpm exec wrangler deploy --dry-run
pnpm deploy
```

Only the demo provider's fixture is included. Do not copy private workspace files into the app or
its build output. If you make a Git repository public, review its history as well as its current
files: deleting private material in a later commit does not remove it from earlier commits.
