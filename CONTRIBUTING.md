# Contributing to Klava

Thanks for contributing.

Klava is trying to be two things at once:

- a strong public desktop product;
- a codebase that remains small enough to reason about.

Please optimize for clarity, not cleverness.

## Before you start

Read these first:

1. [`README.md`](./README.md)
2. [`UPSTREAM.md`](./UPSTREAM.md)
3. [`docs/04_SECURITY_AND_PRIVILEGED_EXECUTION.md`](./docs/04_SECURITY_AND_PRIVILEGED_EXECUTION.md)
4. [`docs/08_UPSTREAM_SYNC_AND_UPDATE_STRATEGY.md`](./docs/08_UPSTREAM_SYNC_AND_UPDATE_STRATEGY.md)

## Ground rules

- Keep the OpenClaw fork surface small.
- Put product UX and product-only logic in Klava-owned packages first.
- Prefer typed workflows and explicit schemas over raw prompt magic.
- Do not introduce features that silently weaken approvals, secret handling, or auditability.
- Keep code changes easy to read and easy to review.

## Development setup

Requirements:

- `Node.js 24+`

Install and run:

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run check
npm run test
npm run build
npm run dist:win
```

## Where code should go

- `apps/desktop` - Electron shell and UI composition
- `packages/runtime` - local runtime, provider integrations, task execution
- `packages/ui` - reusable UI building blocks
- `packages/contracts` - shared types and contracts
- `forks/openclaw` - upstream boundary only, not a dumping ground for product code

## Good pull requests

A good PR here usually has:

- one clear problem statement;
- a small blast radius;
- a short explanation of why the chosen approach is the simplest one that works;
- tests or manual validation notes when behavior changes;
- docs updates if the change affects safety, architecture, or operator workflow.

## Safety-sensitive changes

If your PR touches any of the following, explain the safety model in the PR description:

- secret handling;
- approvals;
- terminal guard behavior;
- provider auth/signing;
- update flow;
- privileged execution;
- driver, service, network, or system-repair workflows.

## Architecture changes

For cross-cutting changes, open with a small design note first.

The best proposals are concrete:

- what user workflow gets better;
- what boundary changes;
- what stays out of scope;
- how rollback works if the change is wrong.

## Public communication rule

Do not blur the line between:

- implemented behavior;
- intended architecture;
- future roadmap.

Klava should be ambitious and honest at the same time.
