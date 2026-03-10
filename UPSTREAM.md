# Upstream Lineage

`Klava` is published as a standalone product repository, but it is intentionally OpenClaw-derived.

Upstream:

- Project: [`OpenClaw`](https://github.com/openclaw/openclaw)
- License: `MIT`

Why this file exists:

- GitHub's native fork badge only exists for repositories that remain in GitHub's fork graph.
- Product repositories often outgrow that UI relationship even when their upstream lineage is still important.
- Klava keeps that lineage explicit in-tree so contributors can see it immediately from the repository root.

What Klava inherits in spirit:

- runtime-first architecture;
- preference for small, explainable modules over a giant monolith;
- composition before rewrite;
- explicit seams for capabilities and integrations.

What Klava adds on top:

- desktop shell and packaging;
- local onboarding and diagnostics;
- approval UX;
- vault-backed secret handling;
- typed local execution surfaces;
- stronger product-level security boundaries for privileged workflows.

Upstream policy:

1. Keep the fork surface as small as possible.
2. Put product-specific UX and product-only logic in Klava-owned packages first.
3. Document every intentional divergence from OpenClaw.
4. Prefer wrappers, adapters, and optional modules before deep fork edits.

Visible upstream boundary in this repo:

- [`forks/openclaw/README.md`](./forks/openclaw/README.md)
- [`docs/08_UPSTREAM_SYNC_AND_UPDATE_STRATEGY.md`](./docs/08_UPSTREAM_SYNC_AND_UPDATE_STRATEGY.md)
- [`docs/16_OPEN_SOURCE_AND_FORK_LINEAGE.md`](./docs/16_OPEN_SOURCE_AND_FORK_LINEAGE.md)
