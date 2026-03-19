# Release Ops and QA

## Goal

Release and QA should stay as simple as the product architecture.

The release system exists to protect three things:
- the `OpenClaw` core;
- the desktop shell quality;
- user trust.

## Release Model

The default release should ship one primary desktop artifact:
- `Klava.exe` / packaged desktop app with the bundled OpenClaw runtime already inside;
- optional `Privileged Helper` only if a privileged workflow exists;
- optional module assets such as voice packs.

Rule:
- do not create more release complexity than the product actually needs.

## Minimum CI Pipeline

The default pipeline should include:
- lint and type checks;
- targeted unit tests;
- shell/runtime integration smoke;
- packaging check;
- release metadata generation.

Add heavier checks only when the related module exists.

## Test Strategy

### 1. Core Tests

Always required:
- contracts and schema validation;
- onboarding path;
- task creation and switching;
- secret redaction;
- shell/runtime handshake.

### 2. Product Smoke Tests

Required before release:
- app starts;
- runtime connects;
- bundled OpenClaw gateway auto-starts;
- bundled OpenClaw gateway stops on app exit when desktop-owned;
- first useful task works;
- guarded approval flow works;
- packaged build launches.

### 3. Optional Module Tests

Run only when relevant:
- voice module checks;
- helper workflow checks;
- cloud mode checks;
- updater checks.

Rule:
- optional modules should not slow down the core release loop unless they changed.

## Release Channels

Keep channels simple:
- `stable`
- `beta`
- optional `internal`

Rule:
- do not create more channels unless they solve a real rollout problem.

## Release Readiness

Klava is ready to ship when:
- install or package launch is reliable;
- onboarding works;
- the user can complete a normal task quickly;
- secrets stay out of transcript and logs;
- approvals behave predictably;
- diagnostics are understandable.
- the desktop does not require a separate global `openclaw` install.

## Windows One-Exe Checklist

Before shipping a Windows build:
1. `npm run check`
2. `npm test`
3. `npm run build`
4. `npm run dist:win`

Then verify release contents:
- `apps/desktop/release/win-unpacked/resources/app.asar` exists;
- `apps/desktop/release/win-unpacked/resources/app.asar.unpacked/vendor/openclaw-runtime/` exists;
- bundled `node.exe` and `openclaw` entrypoint are present.

Then verify runtime behavior:
- the packaged desktop can resolve the bundled OpenClaw runtime;
- the packaged runtime answers `openclaw --version`;
- the packaged gateway responds on the configured loopback port;
- closing the desktop stops the desktop-owned gateway.

Manual interactive smoke still matters:
- launch the packaged app normally from the desktop shell;
- confirm the UI window appears;
- confirm diagnostics show bundled runtime and gateway ownership;
- open the Control UI from inside Klava;
- close the app and verify the gateway is no longer reachable.

## Observability

Collect only signals that help operate the product:
- launch success;
- onboarding success;
- runtime health;
- crash signals;
- update result;
- approval flow failures.

Rule:
- never collect raw secrets;
- avoid collecting full conversation content by default.

## Support Operations

The product should expose:
- diagnostics page;
- version information;
- exportable support bundle;
- plain-language repair actions.

Support bundle should include:
- versions;
- sanitized logs;
- environment basics;
- task metadata summary.
- OpenClaw bridge state and bundled runtime metadata.

Support bundle should exclude:
- raw secrets;
- sensitive transcripts by default;
- arbitrary user files.

## Practical Release Rule

The release process is correct when:
- a small team can run it;
- a medium-level engineer can understand it;
- optional modules do not complicate the core path;
- shipping improvements remains easier than maintaining the process.
