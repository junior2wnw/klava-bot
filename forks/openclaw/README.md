# OpenClaw Fork Boundary

This directory marks the explicit upstream boundary for `OpenClaw`.

Upstream project:

- Repository: [`openclaw/openclaw`](https://github.com/openclaw/openclaw)
- License: `MIT`

Klava relationship:

- Klava is an OpenClaw-derived product line with a much heavier desktop, safety, and packaging layer.
- This repository is intentionally product-shaped, so GitHub may not present it as a native fork even though the upstream relationship remains important.
- The upstream lineage is therefore documented in-tree rather than left implicit.

What belongs here:

- upstream snapshots, submodule hooks, or documented patch overlays when needed;
- notes about upstream sync strategy;
- fork-specific rationale for any deviation that must live below the upstream boundary.

What does not belong here:

- desktop UX;
- product-specific onboarding;
- release shell logic;
- modules that can cleanly live in `apps/desktop`, `packages/runtime`, `packages/ui`, or `packages/contracts`.

Fork rules:
1. Keep the patch surface near zero whenever possible.
2. Document every fork patch with a reason and blast radius.
3. Never move product-shell UX into the upstream boundary.
4. Prefer wrappers, adapters, and typed extension seams before deep fork edits.
