# OpenClaw Fork Boundary

This directory is reserved for the upstream `OpenClaw` fork or integration hooks.

Current repository status:
- the desktop shell and local runtime are implemented around a typed adapter seam;
- no product logic is stored here yet;
- new features should land in `apps/desktop`, `packages/contracts`, `packages/runtime`, or `packages/ui` unless an upstream integration hook is truly required.

Fork rules:
- keep the patch surface near zero;
- document every fork patch with a reason;
- never move product-shell UX into the fork.
