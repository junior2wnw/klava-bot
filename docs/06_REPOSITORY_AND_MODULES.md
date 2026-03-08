# Repository and Modules

## Repository Strategy

Klava should start as a monorepo with explicit module boundaries.

Goals:
- keep shared contracts typed and versioned;
- allow separate build and test pipelines;
- keep OpenClaw vendor code isolated;
- make Windows and macOS platform layers independent.

## Proposed Structure

```text
klava-bot/
  README.md
  docs/
  apps/
    desktop/
    runtime-manager/
    windows-helper/
    macos-helper/
    support-tools/
  packages/
    control-api/
    action-engine/
    design-system/
    secret-service/
    workspace-model/
    telemetry/
    update-orchestrator/
    integration-sdk/
    plugin-sdk/
    shared-types/
    test-harness/
  forks/
    openclaw/
  tooling/
    scripts/
    build/
    signing/
  infra/
    release/
    ci/
    packaging/
```

## Module Responsibilities

### `apps/desktop`

Contains:
- Tauri app shell;
- UI routes and state boundaries;
- onboarding;
- task rail;
- conversation surface;
- diagnostics UI;
- settings and update UX.

### `apps/runtime-manager`

Contains:
- local bootstrap logic;
- runtime install and recovery;
- start-stop-restart flows;
- health checks;
- bridge to updater and diagnostics;
- Windows WSL lifecycle logic where required.

### `apps/windows-helper`

Contains:
- privileged helper;
- typed command executors;
- OS integration boundaries;
- admin workflow validators;
- audit sink.

### `apps/macos-helper`

Contains:
- macOS-specific privileged and service integration layer;
- launchd integration;
- platform-native workflow execution.

### `packages/control-api`

Contains:
- typed local API schemas;
- event contracts;
- version negotiation;
- compatibility helpers between shell and runtime.

### `packages/action-engine`

Contains:
- intent-to-action mapping;
- workflow registry;
- approval policy logic;
- capability class evaluation;
- audit and result envelope helpers.

### `packages/design-system`

Contains:
- visual tokens;
- reusable shell components;
- secure sheet components;
- task cards;
- status and motion patterns.

### `packages/secret-service`

Contains:
- vault abstraction;
- secret metadata schema;
- rotation hooks;
- secure redaction helpers.

### `packages/workspace-model`

Contains:
- workspace, task, run, artifact, and policy schemas;
- migrations;
- repository or data-access boundaries.

### `packages/telemetry`

Contains:
- metrics envelopes;
- crash and health reporting hooks;
- privacy-aware event filters.

### `packages/update-orchestrator`

Contains:
- shell update logic;
- runtime update logic;
- channel selection;
- rollback helpers.

### `packages/integration-sdk`

Contains:
- provider and channel connector contracts;
- onboarding handshake helpers;
- connector lifecycle model.

### `packages/plugin-sdk`

Contains:
- extension boundaries for future providers, tools, and action packs.

### `packages/test-harness`

Contains:
- end-to-end test fixtures;
- install and update test flows;
- privileged workflow mocks;
- regression suites for upstream sync.

### `forks/openclaw`

Contains:
- the controlled vendor fork only;
- minimal patches;
- compatibility hooks;
- upstream tracking metadata.

## Engineering Rules

- UI cannot import internal fork code directly.
- Privileged helper cannot execute untyped requests.
- All storage schemas must be versioned.
- All local APIs must include backward-compatibility rules.
- New invasive fork patches require an ADR.
- Product logic should prefer wrapper packages over deep fork edits.

## Branching Model

Suggested branches:
- `main`: current development line;
- `release/*`: stabilized release branches;
- `vendor/openclaw-main`: mirror of upstream OpenClaw;
- `integration/openclaw`: Klava-compatible integration branch for fork testing.

## Documentation Rules

- Every major subsystem gets a short design note or ADR before invasive implementation.
- Every local API change must update schemas and migration notes.
- Every risky capability must document approval rules and rollback strategy.

## Definition of Good Modularity

Modularity means:
- the shell can change without rewriting the runtime;
- the runtime can update without rewriting the shell;
- Windows substrate changes do not rewrite product logic;
- upstream OpenClaw improvements can be merged with bounded effort;
- new capabilities can be added as new actions or connectors instead of special-casing everything.
