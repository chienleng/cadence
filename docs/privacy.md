# Privacy and safety

The local application reads only configured paths. It renders bounded Markdown with raw HTML
disabled and runs Git commands with argument arrays rather than shell interpolation.

Cadence does not send workspace content to an AI provider. A user may independently authorize their
own local or hosted coding agent to inspect files; that agent's privacy terms and permissions remain
the user's responsibility.

`pnpm context`, `pnpm validate`, and local-only refresh do not contact an AI provider. Normal refresh
may query GitHub through the user's authenticated `gh` session; `--local-only` disables those network
queries while retaining read-only local Git inspection.

The public site is a separate demo build backed only by fictional committed data. It has no storage
bindings, account system, repository credentials, or access to the local provider.

Before making a previously private Cadence repository public, create a clean Git history. Deleting
private files in a later commit does not remove them from earlier commits.
