# Roadmap

Klava is being built as a serious local desktop agent, not just a chat wrapper.

This roadmap is intentionally split into:

- what already exists;
- what should happen next;
- what belongs later, after the architecture is hardened.

## Current foundation

Already in the repo:

- Electron desktop shell
- local runtime with typed HTTP API
- secure local secret storage
- GONKA onboarding and provider integration
- task transcripts and support bundle export
- guarded terminal execution with approvals
- portable Windows executable packaging

## Next

These are the highest-leverage near-term steps.

### 1. Typed privileged helper

Goal:

- add a minimal, isolated helper for approved system-level actions

Examples:

- `driver.inspect`
- `driver.reinstall`
- `service.restart`
- `network.reset_adapter`
- `system.create_restore_point`

Why it matters:

- this is the boundary that turns Klava from "smart terminal shell" into a true system operator

### 2. Better local workflows

Goal:

- move from single commands to repeatable, typed workflows

Examples:

- workstation bootstrap
- provider migration
- BaaS replacement in a local project
- environment repair
- support-bundle guided troubleshooting

### 3. Release quality

Goal:

- make the portable executable the primary user path, not an afterthought

Includes:

- installer/release hardening
- release notes discipline
- checksum verification
- startup diagnostics
- update-channel strategy

### 4. Stronger safety and auditability

Goal:

- make high-impact local actions understandable and reversible

Includes:

- richer approval payloads
- better rollback notes
- stronger audit records
- transcript/log redaction hardening

## Later

These belong after the local-first core is stronger.

### Cloud gateway

- one-key onboarding
- hosted provider brokerage
- device-scoped sessions
- update and policy services

### Voice and multimodal

- curated voice packs
- speech input/output
- multimodal task flows

### Workflow packs

- project-type specific packs
- machine-repair packs
- operator and support packs

## Non-goals

Things Klava should avoid:

- pretending roadmap features are already shipped
- becoming a bag of unrelated demo features
- giving the model unrestricted privileged shell access
- turning the OpenClaw-derived boundary into an unmaintainable fork

## Decision rule

When choosing work, prefer the change that most improves:

1. clarity
2. safety
3. local usefulness
4. composability
5. release readiness
