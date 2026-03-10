# Open Source and Fork Lineage

## Why this document exists

Klava is no longer just an internal build artifact. It is being shaped as a public project that other developers should be able to understand, trust, extend, and ship from.

That means two things have to be explicit:

1. what the project is trying to become;
2. where it comes from.

## Project statement

Klava is an OpenClaw-derived desktop agent project.

Its product thesis is straightforward:

- a serious computer agent should feel like a real desktop product, not just a prompt wrapper;
- one executable should be enough to start using it;
- powerful local actions should go through typed workflows, approvals, and logs;
- the codebase should stay simple enough that one strong engineer can still reason about the whole system.

## OpenClaw lineage

Upstream:

- [`OpenClaw`](https://github.com/openclaw/openclaw)

Klava keeps that lineage explicit through:

- [`UPSTREAM.md`](../UPSTREAM.md)
- [`forks/openclaw/README.md`](../forks/openclaw/README.md)
- [`08_UPSTREAM_SYNC_AND_UPDATE_STRATEGY.md`](./08_UPSTREAM_SYNC_AND_UPDATE_STRATEGY.md)

The rule is simple:

- inherit architecture where it helps;
- avoid unnecessary deep fork edits;
- make every intentional divergence legible.

## What is already real

Current implemented state includes:

- a working Electron desktop shell;
- a local runtime with typed HTTP surfaces;
- secure local secret storage;
- guarded terminal execution with approvals;
- provider onboarding and model selection;
- portable Windows packaging.

This is not just a design document repo. There is a real executable path here.

## What is vision, not fake marketing

Klava should read as ambitious without lying.

That means the repository should clearly distinguish:

- what is implemented now;
- what is already architecturally prepared;
- what is still roadmap.

Examples of workflows this architecture is designed to support over time:

- driver inspection, repair, and reinstallation with rollback preparation;
- workstation bootstrap from a clean machine;
- backend swaps inside a real codebase, including env/config updates and smoke tests;
- provider migration for local inference and cloud dependencies;
- support-bundle generation from one user-visible task flow;
- system recovery and service repair through typed guarded flows.

Those examples are important because they explain the direction of the project. They should not be presented as already shipped if they are not.

## Open-source bar

A good public repo here should feel:

- readable in one pass;
- honest about current state;
- strong on architecture and boundaries;
- safe enough that maintainers can merge quickly without fear;
- simple enough that contributors know where new code should land.

Public-project requirements:

- explicit license;
- contribution guide;
- code of conduct;
- security policy;
- visible upstream lineage;
- visible repo metadata;
- release path for people who just want the executable.

## Why the single executable matters

The strongest version of Klava is not "another repo developers can build if they feel like it."

The strongest version is:

- developers can read the code and modify it;
- non-developers can still download one executable and use it;
- both groups meet the same product, not two separate worlds.

That is why packaging and open-source quality are both first-class concerns.

## Style rule for future public writing

When describing Klava publicly:

- be ambitious;
- be precise;
- do not pretend roadmap equals implementation;
- do not use fake certainty where the system is still evolving;
- do make the design bar obvious.

The project should feel formidable because it is coherent, not because it shouts.
