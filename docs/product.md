# Use the dashboard

Cadence helps you find the next useful piece of project context: what is active, what changed,
what needs attention and where the relevant records live. It reads independent repositories
without merging them or changing their files.

Your source repositories own code and technical documentation. `cadence-workspace` holds current
status and workspace records. GitHub Issues hold actionable work. The generated refresh cache is
disposable. Your own coding agent can work with the same files through `pnpm context`; Cadence has
no built-in chat service or AI provider.

## Find a project

Search and filters narrow the project list. Active filters appear beside the results and can be
removed individually. Reset clears the search and filters while keeping your grouped/table choice.

When filters are active, the full-workspace overview is collapsed below the results. Its attention
list and metrics still describe the whole workspace. Stars are a personal browser preference and
do not change project records.

Active projects without `STATUS.md` are marked **Missing status** in cards, the table and Needs
attention. Use the Missing status focus filter to find them. That signal applies only to active
projects; stale dated records are a separate state.

## Read status and records

A project opens at **Status and work**, with `STATUS.md` selected when available. Choose another
record from the desktop list or mobile picker. Project state and recent commits follow, with
repository conventions and source documentation farther down the page.

The **Record link** action opens an address for the selected record. Reload and browser
Back/Forward preserve the selection. Source document selections also have URLs and retain the
selected record. If a selection is no longer available, Cadence explains the fallback.

Opening a project from the dashboard keeps your search, filters and view in the URL. The
**Projects** return link restores them. A direct project link without that context returns to the
full dashboard. Record links work with the configured local workspace; they do not publish files.

If a registered source folder is missing, saved records still load from `cadence-workspace`.
Cadence identifies the source information it cannot inspect. Restore the folder at its registered
path and reload to read its Git state and documentation again. Unregistered projects return not found.

## Compare projects

Table view places status and cached issue/PR counts beside the project name. The local Git column
combines branch, working-tree changes and upstream comparison. Expand a commit message to read it
in full. Coverage describes the repository conventions Cadence can find.

Known GitHub counts, including zero, link to the corresponding GitHub list when a repository URL
is available. Stale counts keep their warning; missing counts remain unknown. Without a repository
URL, counts are shown as text.

## Understand freshness and unknown data

Local Git state is inspected when the page loads. Ahead/behind compares locally known upstream
refs: Cadence never fetches them or checks whether they match the live remote. An unavailable
comparison is not evidence that the repository is in sync.

GitHub counts come from `pnpm refresh`. Data older than 24 hours, or with an unusable timestamp,
is marked stale. A failed or missing response stays unknown rather than becoming zero. Summary
counts include coverage so you can see when a total is partial.

When `pnpm refresh` runs with `TYPESAFE_API_KEY`, each STATUS.md also gets a judged reading from
Jev (TypeSafe): which headings play the Current, Next and Risks roles whatever they are called,
each item's actionability, the last-updated date when the `Updated:` line cannot be parsed by
convention, and whether the Current section reads as parked. The project page shows the judged
reading above the unchanged Markdown, the status date says "judged" when the judgment supplied
it, and "Looks parked" appears as a badge and a Needs-attention reason for projects that are not
dormant or archived. A judgment counts only while the file text matches what was judged; after
an edit it reads as outdated until the next refresh. See
[TypeSafe judgments](commands.md#typesafe-judgments).

Run `pnpm refresh` and reload to update GitHub counts. `pnpm refresh --local-only` replaces the
cache without GitHub data, so it removes previously cached GitHub counts from the dashboard.
See [refresh commands](commands.md#refresh-repository-state) and the
[data reference](data-contract.md#cached-github-data) for details.
