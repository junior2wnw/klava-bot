# TASKLIST

This is the hard implementation queue for the project.

Any AI or engineer working on Klava should use this file as the main execution checklist after reading:
- `README.md`
- `docs/03_ARCHITECTURE.md`
- `docs/05_UX_SPEC.md`
- `docs/15_EXECUTION_PLAYBOOK.md`
- `design-system/MASTER.md` if it exists

Only mark a task complete when its definition of done is true.

## Non-Negotiable Developer Experience

- [x] `npm install` is enough to set up the workspace
- [x] `npm run dev` starts the normal development flow
- [x] `npm run check` runs the fast quality gate
- [x] `npm run build` creates the production build
- [x] `npm run dist:win` creates the Windows `.exe`
- [x] No required global tools beyond `Node.js` and `Git`
- [x] Optional tools never block the core local workflow
- [x] Build output paths are stable and documented

Definition of done:
- a new AI can build, check, and package the app without inventing commands.

## Project Rules

- [ ] `OpenClaw` remains the core runtime
- [x] No fork patch is added without a written justification
- [x] The shell stays thin
- [x] Voice, helper, and cloud stay optional modules
- [x] The UI stays within `Task Rail`, `Main Surface`, and `Context Pane`
- [x] New work prefers wrappers over rewrites

Definition of done:
- architecture remains simple while capability grows.

## Phase 0. Workspace Skeleton

### Root

- [x] Create `package.json`
- [x] Create `tsconfig.base.json`
- [x] Create workspace config
- [x] Create root scripts for `dev`, `check`, `build`, `dist:win`
- [x] Create `scripts/dev.ps1`
- [x] Create `scripts/check.ps1`
- [x] Create `scripts/build.ps1`
- [x] Create `scripts/dist-win.ps1`

### Desktop App

- [x] Create `apps/desktop/package.json`
- [x] Create `apps/desktop/src/main.tsx`
- [x] Create `apps/desktop/src/app/App.tsx`
- [x] Create `apps/desktop/src/shell/TaskRail.tsx`
- [x] Create `apps/desktop/src/shell/MainSurface.tsx`
- [x] Create `apps/desktop/src/shell/ContextPane.tsx`

### Shared Packages

- [x] Create `packages/contracts/package.json`
- [x] Create `packages/contracts/src/index.ts`
- [x] Create `packages/ui/package.json`
- [x] Create `packages/ui/src/index.ts`
- [x] Create `packages/ui/src/tokens.ts`

Definition of done:
- `npm install` works
- `npm run dev` renders the three-region shell
- no feature logic is blocked by missing workspace plumbing

## Phase 1. Design System Source Of Truth

- [x] Create `design-system/MASTER.md`
- [x] Create `design-system/pages/README.md`
- [x] Fill `design-system/MASTER.md` with real product tokens and component rules
- [x] Add page overrides only when a page truly needs them
- [x] Keep UI decisions synced with `docs/05_UX_SPEC.md`

Definition of done:
- any AI can read one file and understand the UI rules before coding.

## Phase 2. Thin OpenClaw Bootstrap

- [x] Create `forks/openclaw/`
- [x] Create `apps/desktop/electron/main.ts`
- [ ] Create `apps/desktop/electron/openclaw.ts`
- [x] Create `apps/desktop/electron/ipc.ts`
- [x] Create `packages/contracts/src/health.ts`
- [x] Create `apps/desktop/src/features/diagnostics/`
- [x] Show runtime status in the UI
- [x] Show version and connection state in diagnostics

Definition of done:
- the shell can detect or start `OpenClaw`
- the user can see whether the runtime is healthy

## Phase 3. Onboarding And First Useful Task

- [x] Create `packages/contracts/src/onboarding.ts`
- [x] Create `packages/contracts/src/tasks.ts`
- [x] Create `apps/desktop/src/features/onboarding/`
- [x] Create `apps/desktop/src/features/tasks/`
- [x] Create `apps/desktop/src/features/chat/`
- [x] Add secure provider key entry path
- [x] Open the first task immediately after onboarding
- [x] Send and render one successful prompt

Definition of done:
- a new user can install, connect, and get the first useful result fast

## Phase 4. Real Task Flow

- [x] Add one-click task creation
- [x] Add task switching
- [x] Add separate task state
- [x] Add task status indicators
- [x] Add basic task persistence contract
- [x] Keep task UI calm under multiple active tasks

Definition of done:
- at least three tasks can exist independently without UI confusion

## Phase 5. Secrets And Approvals

- [x] Create `packages/contracts/src/secrets.ts`
- [x] Create `packages/contracts/src/approvals.ts`
- [x] Create `apps/desktop/src/features/security/`
- [x] Prevent secrets from remaining in normal transcript flow
- [x] Add compact guarded-approval UI
- [x] Show approval state in task status and context pane

Definition of done:
- secrets stay out of plain transcript
- guarded actions remain obvious and safe

## Phase 6. Packaging, Build, And `.exe`

- [x] Make `npm run build` produce the production desktop build
- [x] Make `npm run dist:win` produce the Windows `.exe`
- [x] Keep the `.exe` output path stable
- [x] Create `scripts/check-release.ps1`
- [x] Add packaging diagnostics
- [ ] Add release smoke check for packaged startup

Definition of done:
- another AI can create a Windows `.exe` with one command
- packaged startup problems are diagnosable quickly

## Phase 7. Diagnostics And Support

- [x] Add diagnostics page
- [x] Add version visibility
- [ ] Add log visibility
- [x] Add support bundle export
- [x] Keep support bundle sanitized

Definition of done:
- users and engineers can understand failure states without reading code

## Phase 8. Optional Voice Module

- [ ] Create `packages/modules/voice`
- [ ] Replace browser voice with local voice path
- [ ] Start with push-to-talk only
- [ ] Add interruption support
- [ ] Add optional voice packs later

Definition of done:
- voice is useful and isolated
- disabling voice does not affect the core product

## Phase 9. Optional Privileged Helper Module

- [ ] Create `packages/modules/helper`
- [ ] Add isolated helper contract
- [ ] Add typed guarded workflows
- [ ] Add audit support
- [ ] Add rollback-aware workflow design

Definition of done:
- privileged flows remain optional and do not distort the core shell

## Phase 10. Optional Cloud Module

- [ ] Create `packages/modules/cloud`
- [ ] Add signed manifest support
- [ ] Add small hosted gateway only after local-first is strong
- [ ] Keep `BYOK` as the default mode

Definition of done:
- cloud mode adds convenience without becoming a hard dependency

## UI Quality Checklist

- [x] Spacing is consistent
- [x] Typography hierarchy is obvious
- [x] Primary actions are visually clear
- [x] Focus states are visible
- [x] Motion is restrained
- [x] There are no unnecessary UI elements
- [x] The shell still feels calm during heavy use

Definition of done:
- the UI feels premium because each element is good, not because there are many of them.

## Per-Task AI Execution Standard

Before coding:
- [x] Read the minimum required docs
- [x] Identify the smallest affected modules
- [x] Confirm the task does not require a fork patch

While coding:
- [x] Keep the diff minimal
- [x] Avoid unrelated refactors
- [x] Preserve the canonical commands
- [x] Preserve the three-region shell structure

Before finishing:
- [x] Run the narrowest useful validation first
- [x] Run broader validation only when appropriate
- [x] Update docs if a public contract changed
- [x] State exact file paths changed

Definition of done:
- tasks are implemented precisely, predictably, and with low review cost.

## Optional Use Of `ui-ux-pro-max-skill`

- [ ] Use only if UI design-system help is needed
- [ ] Never make it a required project dependency
- [ ] If used, install it separately with `uipro init --ai codex`
- [ ] If used, keep its output committed into `design-system/MASTER.md` and `design-system/pages/*.md`

Known facts from the upstream repo:
- it supports Codex CLI
- the CLI installation path is documented
- the search script requires `Python 3.x`
- it is MIT-licensed

Definition of done:
- the skill helps UI quality without complicating normal development.

## First PR Order

- [x] PR 1: workspace skeleton only
- [x] PR 2: shell frame only
- [x] PR 3: `OpenClaw` bootstrap plus health
- [x] PR 4: onboarding plus first prompt
- [x] PR 5: task rail plus task state
- [x] PR 6: secrets plus approvals
- [x] PR 7: build plus `.exe` packaging
- [ ] PR 8: diagnostics plus support bundle
- [ ] PR 9+: optional modules one by one

Definition of done:
- each PR solves one clear product step and stays easy to review.
