# Execution Playbook

## Purpose

This document turns the strategy into an implementation sequence that another AI or engineer can execute without extra interpretation.

## Current Repository Reality

This repository now contains a working desktop foundation:
- npm workspace monorepo;
- Electron + React desktop shell;
- local runtime package with tasks, persistence, approvals, secrets, and diagnostics;
- desktop packaging for Windows and macOS;
- bundled OpenClaw runtime vendored into desktop builds;
- dialog-level `/openclaw ...` pass-through for forward compatibility;
- desktop bridge diagnostics and Control UI handoff.

The next work should extend and harden this baseline rather than reset it.

## Default Assumptions

Unless the user says otherwise, every AI should assume:
- `OpenClaw` is the core runtime;
- `Klava` is a thin desktop shell around it, but the desktop bundle already carries a pinned OpenClaw runtime;
- Windows is the first target;
- `Electron + React + TypeScript + Vite` is the shell stack;
- npm workspaces are preferred over adding extra tooling;
- optional modules stay disabled until the core product is stable;
- light-first UI is the default.

## Hard Rules

- Do not rewrite `OpenClaw`.
- Do not patch the fork unless a wrapper is clearly insufficient.
- Do not implement voice, cloud, or privileged workflows before the core shell is solid.
- Do not create large generic abstractions early.
- Do not add more permanent UI regions than `Task Rail`, `Main Surface`, and `Context Pane`.

## Real Build Order

Build in this order:
1. preserve the existing workspace and shell frame;
2. harden the runtime boundary, bundled OpenClaw lifecycle, and chat integration seam;
3. polish onboarding and diagnostics;
4. improve supportability and packaging;
5. add optional modules one by one.

## Canonical Command Contract

The project must converge on one command per core workflow:
- `npm install` for setup;
- `npm run dev` for normal development;
- `npm run check` for fast validation;
- `npm run build` for production build;
- `npm run dist:win` for Windows `.exe` output;
- `npm run dist:mac` for macOS app bundles and `.dmg` output.

Rule:
- do not introduce alternative primary commands unless one of these is clearly insufficient.

## Target File Structure

The repository now approximates this structure:

```text
klava-bot/
  package.json
  tsconfig.base.json
  design-system/
    MASTER.md
    pages/
  apps/
    desktop/
      package.json
      electron/
        main.ts
        openclaw.ts
        ipc.ts
      src/
        main.tsx
        app/
          App.tsx
        shell/
          TaskRail.tsx
          MainSurface.tsx
          ContextPane.tsx
        features/
          onboarding/
          tasks/
          chat/
          diagnostics/
          security/
  packages/
    contracts/
      package.json
      src/
        index.ts
        health.ts
        onboarding.ts
        tasks.ts
        approvals.ts
        secrets.ts
    ui/
      package.json
      src/
        index.ts
        tokens.ts
        layout/
        components/
    modules/
      voice/
      helper/
      cloud/
  forks/
    openclaw/
  scripts/
    dev.mjs
    release.mjs
    run-workspaces.mjs
```

Rule:
- this is the default implementation target unless the codebase later proves a simpler path.

## Phase-by-Phase Backlog

### Phase 0. Preserve The Working Skeleton

Current baseline already exists:
- root workspace scripts;
- `apps/desktop`;
- `packages/contracts`;
- `packages/runtime`;
- `packages/ui`;
- `forks/openclaw/` reserved boundary.

Definition of done:
- do not break the canonical commands or shell frame while extending the product.

### Phase 1. Harden The Thin OpenClaw Bootstrap

Create:
- `forks/openclaw/`
- `apps/desktop/electron/main.ts`
- `apps/desktop/electron/openclaw.ts`
- `apps/desktop/electron/ipc.ts`
- `packages/contracts/src/health.ts`
- `apps/desktop/src/features/diagnostics/`

Definition of done:
- the shell can detect, start, stop, and recover the bundled OpenClaw runtime reliably;
- the `OpenClaw` seam remains explicit;
- the UI shows runtime health, version, connection state, and gateway ownership.

### Phase 2. Polish Onboarding And First Useful Task

Create:
- `packages/contracts/src/onboarding.ts`
- `packages/contracts/src/tasks.ts`
- `apps/desktop/src/features/onboarding/`
- `apps/desktop/src/features/tasks/`
- `apps/desktop/src/features/chat/`

Definition of done:
- the user can enter a provider key through a secure path;
- the first task opens immediately after onboarding;
- one prompt can be sent and rendered successfully;
- errors are plain-language and recoverable.

### Phase 3. Add Real Task Flow

Extend:
- `TaskRail.tsx`
- `MainSurface.tsx`
- `ContextPane.tsx`
- `apps/desktop/src/features/tasks/`
- `packages/contracts/src/tasks.ts`

Definition of done:
- new task creation is one click;
- at least three tasks can exist independently;
- task switching feels immediate.

### Phase 4. Add Secrets And Approvals

Create:
- `packages/contracts/src/secrets.ts`
- `packages/contracts/src/approvals.ts`
- `apps/desktop/src/features/security/`

Definition of done:
- secrets do not stay in the transcript;
- guarded actions show compact approval UI;
- approval state is visible in the task flow.

### Phase 5. Add Supportability And Packaging Polish

Create or extend:
- `apps/desktop/electron/main.ts`
- `apps/desktop/src/features/diagnostics/`
- `scripts/release.mjs`

Definition of done:
- packaged app launches reliably;
- diagnostics are readable;
- release checks verify the basic product path and bundled OpenClaw lifecycle;
- branded assets and startup smoke checks are in place.

### Phase 6. Add Optional Modules Only After Core Is Stable

Optional module order:
1. `packages/modules/voice`
2. `packages/modules/helper`
3. `packages/modules/cloud`

Rule:
- each module must compile, test, and ship independently from the core path.

## First PR Sequence

Another AI should implement in this PR order:

1. workspace skeleton only;
2. shell frame only;
3. `OpenClaw` bootstrap plus health;
4. onboarding plus first prompt;
5. task rail plus task state;
6. secrets plus approvals;
7. packaging plus diagnostics;
8. one optional module at a time.

Rule:
- one PR should solve one clear product step.

## Required Design Files

Before serious UI work, create:
- `design-system/MASTER.md`

Optional later:
- `design-system/pages/task.md`
- `design-system/pages/onboarding.md`
- `design-system/pages/settings.md`

`MASTER.md` should define:
- colors;
- typography;
- spacing;
- radii;
- shadows;
- motion;
- button rules;
- input rules;
- card and pane rules.

## Optional Use Of `ui-ux-pro-max-skill`

Decision:
- yes, it is worth using as an optional design aid;
- no, it should not become a required build dependency.

Repository:
- `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`

Why it is useful:
- it supports Codex CLI installation via `uipro init --ai codex`;
- it includes design-system generation;
- it supports a `MASTER.md` plus page-overrides workflow;
- it is MIT-licensed.

Why it must stay optional:
- it adds external CLI setup;
- its search script requires `Python 3.x`;
- it gives generic design guidance, not project architecture.

Approved use:
- generate `design-system/MASTER.md`;
- review visual consistency;
- review UI anti-patterns before delivery.

Disallowed use:
- defining product architecture;
- replacing direct engineering judgment;
- becoming required for local development.

If the team chooses to use it, keep the output committed in:
- `design-system/MASTER.md`
- `design-system/pages/*.md`

## AI Execution Rules

Any AI continuing this project should do the following in order:

1. Read `README.md`.
2. Read `docs/03_ARCHITECTURE.md`.
3. Read `docs/05_UX_SPEC.md`.
4. Read this file.
5. Read `design-system/MASTER.md` if it exists.
6. Work only on the next incomplete phase.

When touching OpenClaw integration, the AI must verify these specific contracts:
- one packaged desktop app should work without a separate global `openclaw` install;
- chat-side `openclaw ...` commands should route into the bundled runtime first;
- the desktop should auto-start the bundled gateway when needed;
- the desktop should stop the desktop-owned gateway on shutdown;
- recovery after crash should adopt an already running managed gateway instead of spawning duplicates.

Before editing the fork, the AI must answer:
- why can this not be done in the shell;
- why can this not be done in `packages/contracts`;
- why can this not be done in `packages/ui`;
- why can this not be done in `packages/modules/*`.

If those answers are weak, do not patch the fork.

## Success Condition

This playbook is working if:
- a new AI can pick the next phase and start coding immediately;
- the project grows without architectural drift;
- the UI stays consistent;
- `OpenClaw` remains clearly visible as the core.
