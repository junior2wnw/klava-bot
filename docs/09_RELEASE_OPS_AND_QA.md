# Release Ops and QA

## Release Philosophy

Klava needs product-grade release discipline from the start because:
- it installs local infrastructure;
- it stores credentials;
- it may perform system actions;
- it will eventually ship privileged components.

## Build and Release Artifacts

Expected artifacts:
- Windows installer for desktop shell;
- shell update package;
- runtime bundle package;
- privileged helper package;
- debug symbols and crash metadata;
- support tools and diagnostics bundle generator.

Later:
- macOS app bundle and DMG;
- notarized helper packages.

## CI/CD Pipeline

The pipeline should include:
- lint and type checks;
- unit tests;
- integration tests for control API contracts;
- end-to-end desktop smoke tests;
- install and update tests;
- privileged helper contract tests;
- packaging and signing steps;
- release manifest generation.

## Test Strategy

### Unit Tests

Focus:
- schema validation;
- action resolution;
- approval policy logic;
- redaction helpers;
- migration logic.

### Integration Tests

Focus:
- shell and runtime handshake;
- provider onboarding;
- vault operations;
- update orchestration;
- fork compatibility layer.

### End-to-End Tests

Focus:
- clean machine install;
- first-run onboarding;
- new task creation;
- parallel task behavior;
- runtime crash and recovery;
- update and rollback path.

### Privileged Workflow Tests

Focus:
- policy rejection;
- approval requirement;
- typed command execution;
- audit logging;
- malformed request resistance.

### Upstream Sync Regression Tests

Focus:
- event stream shape;
- provider connectivity smoke checks;
- task persistence;
- integration connector behavior;
- restricted workflow assumptions.

## Quality Gates Before Release

- install success on clean target OS image;
- onboarding passes with at least one major provider;
- secret redaction verified;
- update flow verified on same-channel and cross-version paths;
- support bundle excludes raw secrets;
- crash reporting and logs are visible in diagnostics UI.

## Release Channels

- `stable`: production users.
- `beta`: early adopters and support-guided users.
- `canary/internal`: engineering and aggressive validation.

Promotion rule:
- no artifact moves to a broader channel without passing the narrower channel health checks.

## Observability

Required signals:
- install outcome;
- first launch outcome;
- onboarding completion;
- provider validation success or failure;
- runtime health;
- update outcome;
- crash signals;
- privileged workflow usage and failure rates;
- support bundle generation.

Operational dashboards should answer:
- are installs failing;
- are updates failing;
- are providers failing;
- are risky actions producing abnormal errors;
- did the latest upstream sync destabilize the runtime.

## Support Operations

The product should provide:
- in-app diagnostics page;
- exportable support bundle;
- version and channel visibility;
- plain-language repair actions;
- recovery path for broken runtime state.

Support bundle should include:
- version manifest;
- environment diagnostics;
- sanitized logs;
- task metadata summary;
- update state;
- policy state.

Support bundle should exclude:
- raw secrets;
- full sensitive transcripts by default;
- arbitrary personal files.

## Release Safety for Privileged Features

Restricted workflows should use:
- feature flags;
- staged rollout;
- opt-in beta exposure first;
- strong telemetry and audit checks before stable release.

## Definition of Release Readiness

Klava is release-ready when:
- a new user can install it easily;
- a normal user can succeed without reading docs;
- a power user can trust logs and approvals;
- an engineer can diagnose failures quickly;
- the team can update shell and runtime independently without chaos.
