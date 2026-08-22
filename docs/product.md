# Product principles

Cadence makes a workspace of independent repositories legible without merging them or copying their
issue state. It answers what exists, what is active, what changed, which documentation is available,
and where durable context lives.

Cadence is built for a person working with their own AI agent: the workspace contract
(`pnpm context`, `AGENTS.md`, the data files) is designed to be read and maintained by the agent
the user already uses. The dashboard remains deliberately AI-provider agnostic — Cadence has no
chat endpoint, model SDK, or prompt service.

Cadence is opinionated about ownership:

- source repositories own code-adjacent orientation and durable documentation;
- the private Cadence data repository owns cross-project records;
- GitHub Issues own actionable work;
- generated cache is disposable and hidden.

Cadence does not run builds across repositories, edit monitored repositories, or upload local
workspace content to the hosted demo.
