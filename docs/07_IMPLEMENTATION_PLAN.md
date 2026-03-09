# Implementation Plan

## Delivery Strategy

The project should move with the smallest possible amount of engineering force.

That means:
- keep `OpenClaw` as the working core;
- avoid rewrites;
- keep the fork patch surface small;
- build only thin product layers;
- make extra capability modular and optional.

## Status Update

Current baseline already exists:
- modular repo;
- local runtime connection;
- desktop shell;
- onboarding;
- task rail and main surfaces;
- guarded terminal approvals;
- portable Windows package.

This means the project does not need a reset.
It needs simplification, polish, and stricter modular boundaries.

## Phase 1. Freeze the OpenClaw-First Core

Goal:
- stop architectural sprawl;
- document `OpenClaw` as the core;
- reduce duplication between shell logic and runtime logic.

Deliverables:
- narrow shell-to-runtime contract;
- explicit fork patch rules;
- simplified module ownership;
- removal of unnecessary architectural layers in docs and planning.

Exit criteria:
- contributors can explain the system in a few sentences;
- `OpenClaw` is clearly the main runtime;
- optional modules are separated from the core plan.

## Phase 2. Polish the Core Product

Goal:
- make the existing product easy to install, easy to use, and easy to maintain.

Deliverables:
- installer and updater path;
- onboarding polish;
- logs and diagnostics polish;
- UI consistency pass;
- compact reusable component set.
- `design-system/MASTER.md` as the UI source of truth, with optional page overrides.

Exit criteria:
- install to first useful task is short and predictable;
- the shell looks and behaves like a premium desktop product;
- the UI remains understandable to a medium-level programmer.
- any AI can continue UI work by reading the design-system files and the execution playbook.

## Phase 3. Add Optional Capability Modules

Goal:
- increase power without increasing core complexity.

Priority optional modules:
- local voice;
- privileged helper workflows;
- richer integration packs;
- advanced artifact handling.

Exit criteria:
- each module can be added or improved independently;
- the core product remains useful when a module is absent;
- optional capability does not force a rewrite of the shell.

## Phase 4. Add Hosted and Platform Expansion Only When Core Is Stable

Goal:
- keep hosted services and second-platform work out of the critical path.

Optional later work:
- `Klava Cloud` key mode;
- update manifest service;
- pack registry;
- macOS support.

Exit criteria:
- Windows product quality is already strong;
- hosted services do not complicate the local-first architecture;
- platform expansion reuses the same core contracts.

## Recommended Team Shape

Lean serious mode:
- 1 product-minded UI engineer;
- 1 runtime/integration engineer;
- 1 part-time QA or release owner.

This project should be possible for a small strong team because the architecture stays small.

## Critical Rules

- Do not rewrite `OpenClaw`.
- Do not add a new layer unless it removes real complexity.
- Do not create optional infrastructure before the core product is already strong.
- Do not let UI polish turn into UI complexity.
- Do not let the fork patch surface grow without a concrete need.

## Delivery Philosophy

The order is:
1. keep the core working;
2. make it feel excellent;
3. add optional power;
4. expand only when the first three stay simple.
