# Klava

`Klava` is an OpenClaw-derived desktop agent shipped as a single Windows executable.

It combines a local-first runtime, secure secret handling, typed approvals, and a modern desktop shell so one person can move from "help me with this task" to "inspect, change, repair, or reconfigure this machine" in one place.

The ambition is simple:

> one executable, one task log, one approval model, one agent that can operate the computer in front of you end to end.

This repository is published as a standalone product repo, but its upstream lineage is explicit:

- Upstream project: [`OpenClaw`](https://github.com/openclaw/openclaw)
- Upstream boundary in-tree: [forks/openclaw/README.md](./forks/openclaw/README.md)
- Fork and publication notes: [UPSTREAM.md](./UPSTREAM.md)
- Open-source launch and lineage doc: [docs/16_OPEN_SOURCE_AND_FORK_LINEAGE.md](./docs/16_OPEN_SOURCE_AND_FORK_LINEAGE.md)

## Why Klava exists

Most agents stop at suggestions, shell snippets, or browser automation.

Klava is designed for the full desktop loop:

- understand the task;
- inspect the local machine and project state;
- request approval before risky changes;
- execute typed workflows instead of free-form privileged text;
- preserve an audit trail;
- leave behind recovery hints and support bundles.

The result should feel less like "an LLM attached to a terminal" and more like "a coherent desktop operator you can actually trust with serious work".

## What ships today

Current implemented state:

- Electron + React desktop shell;
- local runtime manager with typed HTTP API;
- secure local secret storage with Windows DPAPI-backed wrapping;
- GONKA mainnet onboarding, validation, balance checks, and strongest-model selection;
- task system with transcript history and support bundle export;
- guarded task-local terminal with approval modes;
- portable Windows `.exe` packaging through Electron Builder.

Current command UX:

- `new task`
- `/terminal <command>`
- `$ <command>`
- `guard strict`
- `guard balanced`
- `guard off`

Current natural-language behavior:

- normal chat uses GONKA mainnet completion after onboarding;
- guarded commands still respect the approval model;
- terminal results are written back into the same task transcript and terminal history.

## What the architecture is meant to support

Not every workflow below is fully shipped yet. Some are already implemented, some are the intended extension surface for the privileged helper, cloud modules, and typed workflow packs described in the docs.

The point of Klava is that all of these belong in the same product shape:

- inspect a broken workstation, prepare a restore point, reinstall a GPU, audio, or network driver, validate the device state, and explain what changed;
- replace a BaaS dependency in a local project, rewrite env/config files, update adapters, run smoke checks, and leave a diff summary;
- switch a project from one inference provider to another, update local runtime settings, test the new path, and roll back if health checks fail;
- bootstrap a new developer machine from a single executable: install toolchains, clone repos, set environment, verify services, and leave the machine ready to work;
- repair a damaged local development environment by checking `PATH`, shell profiles, startup tasks, Docker/WSL state, and service health;
- rotate local secrets out of `.env` files into a vault-backed setup without leaking values into transcripts or logs;
- reset network adapters, reconfigure firewall rules through approved typed flows, and validate the resulting connectivity;
- collect logs, crash state, config snapshots, and system metadata into a support bundle that another engineer can actually use;
- audit what changed on the machine, who approved it, which helper or runtime version executed it, and what rollback path exists;
- give a non-expert user one executable that can move from "my machine is broken" to "the machine is repaired and documented" without making them stitch together five separate tools.

That is the design target: not a chat toy, not a prompt wrapper, but a serious local operator.

## Safety model

Klava is intentionally opinionated about how a powerful agent should behave:

- `Local-first`: the core desktop loop should work without requiring a remote SaaS control plane.
- `Secrets outside transcript`: keys belong in the vault, not in chat history.
- `Typed approvals`: dangerous actions require explicit review with impact and rollback context.
- `Typed privileged helper`: the model should not get a general "run anything as admin" channel.
- `Auditability`: important actions should leave structured records.

If Klava eventually handles driver repair, service surgery, backend replacement, or system recovery, it should do so through typed workflows, not prompt improvisation.

## OpenClaw lineage

Klava is a heavily modified OpenClaw-derived project.

What stays close to upstream:

- runtime-first architecture;
- preference for composition over rewrites;
- minimal fork surface where possible;
- modular capability seams instead of giant monolith features.

What is explicitly Klava-specific:

- desktop shell and UX;
- onboarding, approvals, and diagnostics;
- packaging and release ergonomics;
- local vault integration;
- product-facing modules and surface registry;
- opinionated security and privileged execution model.

If GitHub does not show a native fork badge for this repository, the lineage is still explicit in-tree through [`UPSTREAM.md`](./UPSTREAM.md) and [`forks/openclaw/README.md`](./forks/openclaw/README.md).

## Repository map

- [`apps/desktop`](./apps/desktop) - Electron shell and UI composition
- [`packages/runtime`](./packages/runtime) - local runtime API and provider integrations
- [`packages/ui`](./packages/ui) - reusable UI building blocks
- [`packages/contracts`](./packages/contracts) - shared types and contracts
- [`docs`](./docs) - product, architecture, security, and execution docs
- [`forks/openclaw`](./forks/openclaw) - explicit upstream boundary

## Documentation

Recommended reading order:

1. [Documentation Index](./docs/00_INDEX.md)
2. [Security and Privileged Execution](./docs/04_SECURITY_AND_PRIVILEGED_EXECUTION.md)
3. [Upstream Sync and Update Strategy](./docs/08_UPSTREAM_SYNC_AND_UPDATE_STRATEGY.md)
4. [Implementation Audit](./docs/14_IMPLEMENTATION_AUDIT.md)
5. [Execution Playbook](./docs/15_EXECUTION_PLAYBOOK.md)
6. [Open Source and Fork Lineage](./docs/16_OPEN_SOURCE_AND_FORK_LINEAGE.md)

## Quick start

### For developers

Requirements:

- `Node.js 24+`

Run:

```bash
npm install
npm run dev
```

What this starts:

- Vite renderer on `http://127.0.0.1:5173`
- Electron desktop shell
- local runtime API on `http://127.0.0.1:4120` started by the desktop process

Build:

```bash
npm run build
```

Portable Windows executable:

```bash
npm run dist:win
```

### For users

Most people should never need the dev stack.

Klava is designed to be consumed as one portable executable:

- `apps/desktop/release/Klava 0.1.0.exe`

First use:

1. Launch `Klava`.
2. Connect your provider secret through the secure onboarding flow.
3. Let the app validate and cache provider state.
4. Start operating through tasks, chat, and approvals.

## Verification already completed in this repo state

- `npm run check`
- `npm run build`
- `npm run dist:win`
- runtime smoke test for `guarded -> approval -> reject`
- runtime smoke test for task creation and guarded terminal approval generation
- runtime smoke test for support bundle export without secret leakage
- runtime smoke test for GONKA onboarding rejection on an account-not-found phrase with provider state staying disconnected
- packaged `Klava 0.1.0.exe` startup smoke test without main-process crash

## Open source

Klava is intended to be a serious public project, not just a code dump.

- License: [MIT](./LICENSE)
- Contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](./SECURITY.md)

If you want to help, the highest-value contributions are the ones that make the system more legible, safer, and more composable.
