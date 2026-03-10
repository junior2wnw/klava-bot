# Klava Bot

`Klava Bot` is a thin desktop product built around `OpenClaw`, which remains the core runtime and primary capability engine.

Product goal: let a person install one application, enter a GONKA private phrase or private key once, pass a live mainnet check, and immediately start managing tasks, integrations, and local system actions through one modern dialogue interface.

Core promise:
- `OpenClaw` stays the core;
- `Klava` adds desktop polish, onboarding, safety, and a modular UI shell;
- the fork patch surface stays as small as possible;
- extra capabilities are added as optional modules instead of rewrites.

Product pillars:
- `OpenClaw-first`: if `OpenClaw` already does the job, Klava reuses it rather than rebuilding it.
- `Thin shell`: Klava owns install, onboarding, product UX, approvals, and diagnostics, not a second runtime.
- `Modular everything`: voice, cloud, privileged flows, and future packs stay optional and removable.
- `Apple-grade restraint`: very few interface elements, very high quality in spacing, hierarchy, motion, and states.
- `Average-developer friendly`: clear boundaries, small modules, and predictable extension points.

Implementation direction:
- no large rewrite of `OpenClaw`;
- no deep fork edits unless strictly required;
- no giant UI framework beyond a compact reusable component set;
- every major addition should land as a wrapper, module, or surface.

Documentation map:
- [Index](./docs/00_INDEX.md)
- [Product Vision](./docs/01_PRODUCT_VISION.md)
- [PRD and Technical Spec](./docs/02_PRD_TZ.md)
- [System Architecture](./docs/03_ARCHITECTURE.md)
- [Security and Privileged Execution](./docs/04_SECURITY_AND_PRIVILEGED_EXECUTION.md)
- [UX Specification](./docs/05_UX_SPEC.md)
- [Repository and Modules](./docs/06_REPOSITORY_AND_MODULES.md)
- [Implementation Plan](./docs/07_IMPLEMENTATION_PLAN.md)
- [Upstream Sync and Update Strategy](./docs/08_UPSTREAM_SYNC_AND_UPDATE_STRATEGY.md)
- [Release Ops and QA](./docs/09_RELEASE_OPS_AND_QA.md)
- [Epics and Backlog](./docs/10_EPICS_AND_BACKLOG.md)
- [Voice and Multimodal Stack](./docs/11_VOICE_AND_MULTIMODAL_STACK.md)
- [Cloud Gateway and Update Server](./docs/12_CLOUD_GATEWAY_AND_UPDATE_SERVER.md)
- [Top 1 Strategy](./docs/13_TOP1_STRATEGY.md)
- [Implementation Audit](./docs/14_IMPLEMENTATION_AUDIT.md)
- [Execution Playbook](./docs/15_EXECUTION_PLAYBOOK.md)
- [Tasklist](./TASKLIST.md)

Execution control files:
- `TASKLIST.md` is the hard implementation queue and definition-of-done tracker;
- `design-system/MASTER.md` is the global UI source of truth;
- `design-system/pages/*.md` are page-specific UI overrides when needed.

Current status:
- working npm workspace monorepo;
- local runtime API embedded behind a thin desktop adapter;
- Electron + React desktop shell with `Task Rail`, `Main Surface`, and `Context Pane`;
- guarded task-local terminal with approvals and persistent history;
- secure local secret storage with Windows DPAPI-backed key wrapping;
- portable Windows `.exe` packaging through Electron Builder.

## Implemented in this iteration

- modular npm workspace monorepo;
- local runtime manager with typed HTTP API;
- secure local secret storage abstraction with Windows DPAPI path;
- persistent task/session store;
- GONKA mainnet onboarding with secure secret storage and automatic strongest-model selection;
- compact multi-surface UI shell built from reusable components;
- task-local terminal subsystem with command history and guard modes;
- approval flow for guarded terminal commands;
- surface registry foundation for future modes like `Pro`;
- `/terminal` and `$ ` chat routing into the terminal surface;
- `guard strict|balanced|off` command routing into terminal settings;
- GONKA mainnet chat completion path after secure onboarding with automatic model refresh;
- support bundle export with sanitized task metadata;
- desktop startup logging for packaged main-process failures;
- independent build pipeline for shell and runtime;
- Electron desktop launcher that boots or discovers the local runtime;
- portable Windows `.exe` artifact generation.

## Current Command UX

Chat and shell shortcuts supported:
- `new task`
- `/terminal <command>`
- `$ <command>`
- `guard strict`
- `guard balanced`
- `guard off`
- `list voices` returns the current module status
- `enable voice` and `disable voice` are currently explicit placeholders

Current natural-language behavior:
- normal chat uses GONKA mainnet completion after onboarding;
- guarded commands still do not bypass safety: they create approvals in `balanced` mode and stay blocked in `strict`;
- terminal results are written back into the same task transcript and terminal history.

Guard model:
- `strict`: blocks guarded and blocked commands;
- `balanced`: requests approval for guarded commands and blocks high-risk ones;
- `off`: removes the local command guard.

## Quick Start

Requirements:
- `Node.js 24+` recommended in the current repo state

Run:

```bash
npm install
npm run dev
```

What this starts:
- Vite renderer on `http://127.0.0.1:5173`
- Electron desktop shell
- local runtime API on `http://127.0.0.1:4120` started by the desktop process

First use:
1. Open the shell.
2. Paste your `GONKA private phrase` or raw private key.
3. `Klava` performs a tiny live GONKA mainnet validation, only saves the secret on success, then auto-selects the strongest current model and keeps it refreshed.
4. Start chatting with `Klava`.

Build:

```bash
npm run build
```

Portable Windows executable:

```bash
npm run dist:win
```

Artifact:
- `apps/desktop/release/Klava 0.1.0.exe`
- `apps/desktop/release/win-unpacked/Klava.exe`

Verification already completed in this repo state:
- `npm run check`
- `npm run build`
- `npm run dist:win`
- runtime smoke test for `guarded -> approval -> reject`
- runtime smoke test for task creation and guarded terminal approval generation
- runtime smoke test for support bundle export without secret leakage
- runtime smoke test for GONKA onboarding rejection on an account-not-found phrase with provider state staying disconnected
- packaged `Klava 0.1.0.exe` startup smoke test without main-process crash
- portable Windows artifact created at `apps/desktop/release/Klava 0.1.0.exe`

Known current gaps:
- the actual `OpenClaw` upstream fork is still only a reserved boundary in `forks/openclaw/`;
- voice is intentionally not implemented beyond explicit placeholder responses.
