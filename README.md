# Klava Bot

`Klava Bot` is a desktop AI operator built on top of a controlled fork of `OpenClaw`.

Product goal: let a person install one application, enter an API key, and immediately start managing tasks, integrations, and local system actions through one modern dialogue interface.

Core promise:
- one installer;
- one main window;
- one conversation-first interface;
- secure handling of secrets outside the chat transcript;
- modular architecture for fast product growth and low-friction upstream sync with OpenClaw.

Product pillars:
- `Chat-first, not chat-only`: every action can start from the chat, but sensitive and dangerous flows use dedicated secure UI surfaces.
- `Headless runtime`: the AI runtime lives separately from the desktop shell.
- `Safety by construction`: privileged actions go through typed workflows, approvals, logging, and rollback strategy.
- `Upstream-friendly fork`: product-specific code stays outside the OpenClaw fork whenever possible.
- `Global usability`: low-friction onboarding, localization readiness, accessibility, and supportable diagnostics.

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

Current status:
- documentation baseline created;
- architecture direction fixed;
- working monorepo baseline implemented;
- local runtime and modern shell are ready for first hands-on use;
- compact modular UI shell with chat and terminal surfaces is in place;
- guarded terminal approvals are now part of the runtime and UI flow;
- Windows portable `.exe` packaging is working through the current Electron shell.

## Implemented in this iteration

- modular npm workspace monorepo;
- local runtime manager with typed HTTP API;
- secure local secret storage abstraction with Windows DPAPI path;
- persistent task/session store;
- OpenAI direct onboarding with key + model validation;
- compact multi-surface UI shell built from reusable components;
- task-local terminal subsystem with command history and guard modes;
- approval flow for guarded terminal commands;
- surface registry foundation for future modes like `Pro`;
- optional voice input/output controls;
- local voice command resolver for task creation and voice switching;
- `/terminal` and `$ ` chat routing into the terminal surface;
- `guard strict|balanced|off` command routing into terminal settings;
- OpenAI tool-calling layer so Klava can use the terminal from normal chat when it is the right tool;
- independent build pipeline for shell and runtime;
- Electron desktop launcher that boots or discovers the local runtime;
- portable Windows `.exe` artifact generation.

## Current Command UX

Chat and shell shortcuts already supported:
- `new task`
- `/terminal <command>`
- `$ <command>`
- `guard strict`
- `guard balanced`
- `guard off`
- `list voices`
- `enable voice`
- `disable voice`

Natural-language terminal behavior:
- Klava can now inspect terminal state and run task-scoped commands from ordinary chat using model tool-calls.
- Guarded commands still do not bypass safety: they create approvals in `balanced` mode and stay blocked in `strict`.
- Terminal results are written back into the task terminal history and reflected in task status.

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
- runtime API on `http://127.0.0.1:4120`
- desktop-ready shell in the browser on `http://127.0.0.1:5173`

First use:
1. Open the shell.
2. Paste your `OpenAI API key`.
3. Leave `gpt-4.1-mini` or set another model you have access to.
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
- `npm run dist:win --workspace @klava/desktop`
- runtime smoke test for `guarded -> approval -> approve`
- runtime smoke test for `guarded -> approval -> reject`
- mocked agent-service smoke for `chat -> tool-call -> safe terminal run`
- mocked agent-service smoke for `chat -> tool-call -> pending approval`
- packaged desktop shell startup log confirms local runtime bootstrap on `127.0.0.1:4120`
- TCP listener verification confirms the packaged shell owns `127.0.0.1:4120` after launch
