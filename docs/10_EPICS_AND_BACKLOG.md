# Epics and Backlog

## Epic 1. Repo and Platform Foundation

Priority:
- P0

Initial backlog:
- create monorepo scaffold;
- define shared package standards;
- import and pin the OpenClaw fork;
- set up versioning and branch policy;
- create initial ADR templates;
- create baseline CI workflow.

## Epic 2. Local Control API

Priority:
- P0

Initial backlog:
- define typed request schemas;
- define event stream schemas;
- define compatibility negotiation;
- implement runtime health endpoints;
- implement shell handshake flow.

## Epic 3. Desktop Shell

Priority:
- P0

Initial backlog:
- create Tauri app shell;
- implement first-launch frame;
- build task rail;
- build conversation surface;
- build work pane;
- build command composer;
- build update and diagnostics views.

## Epic 4. Onboarding and Provider Auth

Priority:
- P0

Initial backlog:
- provider picker;
- secure key entry flow;
- provider validation flow;
- browser-based auth path;
- first successful prompt guide;
- onboarding recovery states.

## Epic 5. Task Model and Parallelism

Priority:
- P0

Initial backlog:
- session creation;
- session persistence;
- pause and resume;
- archive and restore;
- task duplication;
- status indicators;
- unread and attention model.

## Epic 6. Vault and Secret Hygiene

Priority:
- P0

Initial backlog:
- vault abstraction;
- secret metadata store;
- redaction layer;
- secret interception UX;
- rotation and revoke actions;
- secret health checks.

## Epic 7. Action Engine

Priority:
- P0

Initial backlog:
- intent registry;
- action schema;
- approval schema;
- action result envelopes;
- capability classification;
- workflow registry;
- audit integration.

## Epic 8. Windows Runtime Manager

Priority:
- P0

Initial backlog:
- runtime bootstrap;
- substrate detection;
- hidden runtime packaging;
- health monitor;
- restart and repair flow;
- installer integration.

## Epic 9. Integrations and Channels

Priority:
- P1

Initial backlog:
- OpenAI provider;
- Anthropic provider;
- Telegram connector;
- Discord connector;
- WhatsApp connector feasibility review;
- integration status UI.

## Epic 10. Privileged Helper

Priority:
- P1

Initial backlog:
- helper process skeleton;
- typed command dispatcher;
- policy enforcement;
- admin elevation path;
- audit sink;
- helper-shell contract tests.

## Epic 11. Guarded and Restricted Workflows

Priority:
- P1

Initial backlog:
- package install;
- service restart;
- diagnostics collection;
- network reset;
- driver inspect;
- guided driver reinstall;
- restore point workflow.

## Epic 12. Updates and Rollback

Priority:
- P1

Initial backlog:
- shell updater;
- runtime updater;
- channel selection;
- release manifest verification;
- rollback logic;
- update diagnostics UI.

## Epic 13. QA and Observability

Priority:
- P1

Initial backlog:
- sanitized logs;
- crash reporting;
- install success metrics;
- onboarding success metrics;
- support bundle export;
- upstream sync regression suite.

## Epic 14. Design System

Priority:
- P1

Initial backlog:
- visual tokens;
- typography scale;
- task card patterns;
- secure sheet patterns;
- approval card patterns;
- motion guidelines;
- accessibility review.

## Epic 15. macOS Platform Layer

Priority:
- P2

Initial backlog:
- background service model;
- app packaging;
- secure storage integration;
- shell parity;
- platform policy review.

## Epic 16. Future Growth

Priority:
- P2

Initial backlog:
- voice UX;
- plugin marketplace;
- team workspaces;
- enterprise policies;
- mobile approval companion;
- domain packs for support, ops, and creators.

## Epic 17. Voice Input and Output

Priority:
- P0

Initial backlog:
- microphone pipeline;
- Silero VAD integration;
- whisper.cpp integration;
- faster-whisper fallback path;
- Kokoro TTS integration;
- playback interruption;
- voice settings and error UX.

## Epic 18. Voice Pack Registry and Policy

Priority:
- P1

Initial backlog:
- voice pack manifest schema;
- signed pack distribution;
- local cache and versioning;
- curated voice catalog;
- safe fallback when requested voice is unavailable;
- license and provenance enforcement.

## Epic 19. Klava Cloud Gateway

Priority:
- P1

Initial backlog:
- Klava key auth;
- tenant and device model;
- provider proxy;
- rate limiting and quotas;
- usage metering;
- update manifest service;
- pack registry service.

## Backlog Discipline

Rules:
- P0 work defines the foundation and MVP path;
- P1 work expands power and reliability;
- P2 work is strategic expansion after the core product proves stable;
- anything that increases fork divergence must be justified against the upstream strategy.
