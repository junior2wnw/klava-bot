# Implementation Plan

## Delivery Strategy

The right approach is phased delivery with hard architectural gates.

This avoids two common failure modes:
- building a pretty shell without a reliable runtime foundation;
- building raw capability without a product-quality user experience.

## Status Update

Current implemented baseline:
- `Phase 0`: done at monorepo and contract level;
- `Phase 1`: baseline done with a working local runtime API;
- `Phase 2`: baseline done with onboarding, chat shell, task rail, and inspector;
- `Phase 3`: partially done through task sessions, approvals, and typed terminal actions;
- `Phase 4`: partially done through a packaged Windows portable `.exe`, with full installer and repair flows still pending.

## Phase 0. Foundation and Repo Bootstrap

Duration:
- 1 to 2 weeks

Deliverables:
- monorepo scaffold;
- branch model;
- fork import of OpenClaw;
- base package boundaries;
- typed schema strategy;
- initial ADR set;
- CI skeleton;
- release naming and versioning policy.

Exit criteria:
- repo structure exists;
- app packages compile;
- fork is imported and pinned;
- docs align with technical skeleton.

## Phase 1. Runtime Embedding and Local Control API

Duration:
- 2 to 3 weeks

Deliverables:
- controlled OpenClaw runtime wrapper;
- local control API contracts;
- shell-to-runtime connection;
- task/session lifecycle baseline;
- local metadata store and migrations;
- health endpoints and structured logs.

Exit criteria:
- shell can start runtime and list or create tasks;
- runtime can stream events back to the shell;
- shell/runtime version compatibility is enforced.

## Phase 2. Desktop Shell and First-Run Experience

Duration:
- 2 to 3 weeks

Deliverables:
- premium desktop shell baseline;
- onboarding flow;
- provider connection flow;
- secure key entry sheet;
- main conversation surface;
- task rail;
- settings shell.

Exit criteria:
- clean first-launch onboarding works;
- user can connect a provider and run the first task;
- API key never persists in transcript.

## Phase 3. Parallel Tasks, Workspaces, and Action Engine

Duration:
- 2 to 4 weeks

Deliverables:
- one-click new task;
- task pause, resume, clone, archive;
- workspace model;
- intent-to-action layer;
- approval infrastructure;
- artifact model and task metadata.

Exit criteria:
- at least three concurrent tasks behave independently;
- guarded actions generate approvals;
- task data survives shell restart.

## Phase 4. Windows Runtime Packaging and Recovery

Duration:
- 3 to 4 weeks

Deliverables:
- Windows installer;
- runtime manager;
- hidden runtime substrate packaging;
- auto-detection of prerequisites;
- support for bootstrap, restart, and repair;
- desktop shortcut and launch behavior.

Current implementation status:
- portable Windows `.exe` is already shipping from the repo;
- the remaining work is installer UX, shortcut creation, repair, updater, and hidden substrate strategy.

Exit criteria:
- install on a clean Windows machine reaches first useful prompt without manual dependency setup;
- runtime recovery works after forced stop;
- logs and health views explain failures.

## Phase 5. Secret Vault and Integration Flows

Duration:
- 2 to 3 weeks

Deliverables:
- encrypted vault;
- secret metadata model;
- redaction pipeline;
- integration setup flows for initial providers and channels;
- browser-based auth path where applicable.

Exit criteria:
- keys and tokens are encrypted and redacted;
- provider reconnect and rotation flows work;
- transcript remains readable without leaking secrets.

## Phase 5A. Voice Foundation

Duration:
- 2 to 3 weeks

Deliverables:
- microphone capture pipeline;
- VAD integration;
- push-to-talk and hold-to-talk UX;
- first local STT engine integration;
- first local TTS engine integration;
- playback controller with interrupt and stop;
- voice settings and diagnostics.

Exit criteria:
- user can issue a command by voice and receive a spoken response;
- voice features can be enabled or disabled cleanly;
- unavailable voices and audio devices produce understandable errors.

## Phase 6. Privileged Helper and Guarded Workflows

Duration:
- 3 to 5 weeks

Deliverables:
- Windows privileged helper;
- capability policy framework;
- safe, guarded, and restricted action routing;
- first guarded workflows such as package install, service restart, and diagnostics;
- first restricted workflow such as driver inspection or guided reinstall.

Exit criteria:
- restricted actions require explicit approval and elevation;
- audit records are written;
- helper rejects out-of-policy or malformed requests.

## Phase 7. Updates, Release Channels, and Observability

Duration:
- 2 to 3 weeks

Deliverables:
- shell updater;
- runtime updater;
- stable, beta, and canary channels;
- rollback logic;
- telemetry and crash reporting baseline;
- support bundle generation.

Exit criteria:
- shell and runtime can update independently;
- failed update can be detected and rolled back or repaired;
- diagnostics exclude raw secrets.

## Phase 7A. Klava Cloud Gateway

Duration:
- 2 to 4 weeks

Deliverables:
- Klava-issued API key mode;
- backend auth and quota service;
- upstream model routing;
- device bootstrap flow;
- voice pack registry service;
- signed manifest service for runtime and pack updates.

Exit criteria:
- a user can onboard with one Klava key;
- provider keys remain server-side;
- voice packs and app artifacts can be delivered through signed manifests.

## Phase 8. macOS Enablement

Duration:
- 3 to 5 weeks

Deliverables:
- macOS packaging;
- background service model;
- platform secure storage integration;
- parity for onboarding and task flows;
- basic privileged workflow support for macOS-appropriate cases.

Exit criteria:
- same user-level workflow works on macOS;
- platform-specific substrate remains hidden from the user;
- release pipeline supports both platforms.

## Recommended Team Shape

Minimum serious team:
- 1 product/UX lead;
- 1 desktop/frontend engineer;
- 1 platform/runtime engineer;
- 1 systems/security engineer;
- 1 QA and release automation engineer.

Possible lean mode:
- 2 to 3 strong engineers plus AI-assisted execution, with a longer schedule and tighter scope control.

## First 30 Days

Priority outcomes:
- create the monorepo;
- import and freeze the initial OpenClaw fork baseline;
- define control API schemas;
- stand up the desktop shell skeleton;
- connect onboarding to a real provider;
- create the first task/session flow end to end.

## Critical Gates

Gate 1:
- do not build more UX than necessary until shell-to-runtime contracts are stable.

Gate 2:
- do not expose privileged execution until typed workflows and audit infrastructure exist.

Gate 3:
- do not add many integrations until onboarding, vault, and diagnostics are solid.

Gate 4:
- do not let the fork patch surface grow without review.

## Delivery Risks

- too much product logic ending up inside the fork;
- building an overpowered admin shell without enough safety;
- underestimating packaging and update complexity on Windows;
- polishing UI before action semantics are stable;
- trying to support too many integrations before core flows are reliable.

## Delivery Philosophy

The product should scale in layers:
- first make it installable;
- then make it useful;
- then make it powerful;
- then make it dangerous only in a controlled and auditable way;
- then expand breadth.
