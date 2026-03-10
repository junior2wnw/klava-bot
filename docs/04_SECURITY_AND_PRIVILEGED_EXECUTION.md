# Security and Privileged Execution

## Security Goal

Klava should be powerful enough to operate a local machine while remaining structurally safer than a naive "AI with admin terminal access" design.

Default architectural stance:
- `OpenClaw` remains the core runtime;
- Klava adds thin security wrappers around that core;
- privileged execution is an optional isolated module, not the center of the product;
- safe defaults should work even without privileged features enabled.

## Core Security Principles

- `Least privilege`: every component gets the minimum access it needs.
- `Typed execution`: risky actions are represented as strict commands and workflows, not arbitrary prompts.
- `Secrets outside transcript`: chat history is not a secret store.
- `Human approval`: dangerous actions require clear user consent.
- `Auditability`: important actions leave structured records.
- `Rollback where practical`: the system should prepare for recovery before destructive operations.

## Trust Boundaries

Boundary 1:
- Desktop shell is unprivileged and user-facing.

Boundary 2:
- Runtime executes AI logic, tools, and workflows, but does not get unrestricted OS authority.

Boundary 3:
- Secret vault stores encrypted credentials and returns references rather than raw values when possible.

Boundary 4:
- Privileged helper is isolated and only accepts typed, signed, allowlisted requests.

## Threat Model

Primary threats:
- secret leakage through transcript, logs, crash dumps, or telemetry;
- prompt-induced unsafe system actions;
- privilege escalation via the chat surface;
- supply-chain risk in updates or third-party integrations;
- data corruption during high-risk system operations;
- accidental user approvals due to poor UX wording.

Out of scope for full prevention:
- a machine already fully compromised by malware with full user access;
- hostile kernel-level attacks;
- third-party provider breaches outside Klava control.

## Secret Handling Model

Rules:
- API keys, passwords, tokens, and session cookies must not remain in the chat transcript.
- The UI must intercept likely secret input patterns and redirect them to a secure input sheet.
- OAuth-capable integrations should use system-browser auth with callback return to the app.
- Secret values should be stored only in the encrypted vault layer.
- Runtime and shell logs must redact known secret patterns and vault-backed values.

Secret states:
- `pending`
- `validated`
- `expired`
- `revoked`
- `rotation_required`

User-visible chat behavior:
- the user may write "here is my key";
- the app should open a secure sheet;
- the chat transcript should later show "GONKA connected" rather than the raw secret.

## Hosted Key Brokerage

Klava Cloud mode should use a broker model:
- the desktop app stores only a Klava-issued key or short-lived session material;
- upstream provider keys remain on the Klava backend;
- device sessions should use revocable scoped tokens;
- quotas, abuse controls, and usage accounting must happen server-side.

This is required if the product later offers a single-key onboarding experience backed by Klava-managed providers.

## Capability Classes

### Safe

Examples:
- read local files in allowed locations;
- summarize documents;
- inspect system info;
- create tasks;
- connect non-sensitive UI preferences.

Approval:
- no extra approval beyond normal task initiation.

### Guarded

Examples:
- install an app;
- change selected OS settings;
- restart a service;
- modify firewall or network configuration;
- connect a bot token;
- manipulate important files outside a safe workspace.

Approval:
- explicit confirmation with clear impact statement.

### Restricted

Examples:
- reinstall drivers;
- uninstall or replace critical packages;
- touch registry areas outside allowlisted policies;
- run disk repair or boot-sensitive operations;
- install low-level services;
- change startup-critical behavior.

Approval:
- strong confirmation, native elevation, detailed preview, audit record, rollback plan where practical.

## Approval Model

Each approval should include:
- action name;
- risk class;
- what will change;
- affected apps, files, services, or devices;
- whether admin rights are required;
- whether restart or reboot may occur;
- rollback or recovery note if available.

Approval UX rules:
- no vague confirmation text;
- no hidden consequences;
- default action is not destructive;
- timeout and stale approvals are invalidated.

## Voice Identity Safety

Voice support introduces an additional trust boundary.

Rules:
- the product may support curated synthetic voices and licensed voice packs;
- the default product must not automatically clone or impersonate a real person's voice without authorization;
- requests for celebrity, political, or otherwise real-person imitation should be rejected or redirected to safe alternatives unless a verified licensed pack exists;
- voice pack manifests must include provenance, license, version, and distribution source.

Recommended user-facing behavior:
- "I can't use that real-person voice in this setup."
- "I can switch to a similar neutral style or one of your installed voices."

## Privileged Helper Design

The privileged helper should be:
- minimal;
- signed;
- versioned independently;
- isolated from the language model;
- controlled through typed schemas;
- able to reject any request outside policy or schema.

Allowed command style:
- `service.restart`
- `package.install`
- `driver.inspect`
- `driver.reinstall`
- `network.reset_adapter`
- `system.create_restore_point`

Disallowed command style:
- arbitrary raw shell text from the model;
- general "run anything as admin";
- direct eval or script execution from untrusted prompts.

## Driver Reinstallation Workflow

Driver operations must use a dedicated workflow.

Suggested steps:
1. inspect target device and current driver state;
2. resolve exact hardware identifiers;
3. select compatible driver source;
4. present a preview to the user;
5. create restore point or equivalent recovery checkpoint when available;
6. uninstall or stage the existing driver if needed;
7. install the new driver through an allowlisted method;
8. validate post-install state;
9. request reboot only if required;
10. record the full audit trail and recovery hints.

This workflow must never rely on model guessing alone.

## Logging and Audit

The product should keep:
- structured operational logs;
- shell logs;
- runtime logs;
- privileged helper logs;
- update logs;
- immutable audit records for restricted actions.

Audit records should include:
- timestamp;
- user-visible action label;
- action identifier;
- policy decision;
- approval record;
- executor version;
- outcome;
- rollback metadata if available.

## Privacy and Telemetry

Telemetry must be privacy-aware.

Recommended defaults:
- collect install, startup, crash, update, and coarse feature health metrics;
- do not collect raw prompt content by default;
- do not collect raw secrets ever;
- gate diagnostic uploads behind user consent when detailed content is involved.

## Supply Chain Controls

- Sign installers and privileged components.
- Sign update manifests.
- Pin internal package versions and verify checksums for runtime assets.
- Review third-party plugins and connectors before enabling broad distribution.
- Keep a software bill of materials for release builds.

## Recovery Strategy

For guarded and restricted workflows, the system should prepare recovery where practical:
- restore points;
- pre-change snapshots of relevant config;
- ability to roll back to previous runtime version;
- support bundle export for troubleshooting.

## Security Bar for Launch

MVP security bar:
- secure key entry;
- encrypted local vault;
- redaction in logs and transcript;
- approval infrastructure;
- typed local actions;
- baseline audit records.

V1 security bar:
- privileged helper with allowlisted workflows;
- signed update channels;
- rollback paths for restricted operations;
- stronger policy controls per workspace or deployment type.
