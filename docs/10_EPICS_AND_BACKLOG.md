# Epics and Backlog

## Epic 1. OpenClaw-First Core

Priority:
- P0

Backlog:
- keep `OpenClaw` as the main runtime;
- reduce unnecessary adapter complexity;
- document fork patch rules;
- keep shell-to-runtime contracts small.

## Epic 2. Desktop Shell Quality

Priority:
- P0

Backlog:
- polish onboarding;
- keep the three-region shell clear;
- refine task rail, main surface, and context pane;
- keep the reusable component set small and strong;
- improve diagnostics and settings UX.

## Epic 3. Safety and Secrets

Priority:
- P0

Backlog:
- secure key entry;
- vault and redaction hygiene;
- clear approval cards;
- predictable guarded terminal behavior;
- plain-language failure states.

## Epic 4. Windows Productization

Priority:
- P0

Backlog:
- installer path;
- updater path;
- runtime recovery;
- support bundle and logs;
- release packaging polish.

## Epic 5. Optional Voice Module

Priority:
- P1

Backlog:
- local STT and TTS module;
- voice settings;
- interruption behavior;
- pack-based delivery.

## Epic 6. Optional Privileged Workflows

Priority:
- P1

Backlog:
- isolated helper;
- typed guarded workflows;
- audit and rollback support;
- policy enforcement.

## Epic 7. Optional Hosted Services

Priority:
- P2

Backlog:
- `Klava Cloud` key mode;
- hosted update manifests;
- pack registry;
- quotas and usage metering.

## Backlog Discipline

Rules:
- P0 is the smallest strong product;
- P1 adds power without complicating the core;
- P2 is optional expansion after the local-first product is excellent;
- any work that increases fork divergence must clear a very high bar.
