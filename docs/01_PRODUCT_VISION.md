# Product Vision

## Product Statement

`Klava Bot` is a personal desktop AI operator that people install like a normal app and use like a natural conversation.

The user journey should be this simple:
1. Install the app.
2. Enter an API key or complete a provider login.
3. Write a task in normal language.
4. Watch Klava execute, ask for approvals when needed, and keep work organized in parallel task lanes.

## Mission

Build the most usable, most capable, and most trustworthy desktop AI operator in the world.

## Positioning

Klava is positioned between:
- generic chat apps that do not really operate the local machine;
- power-user automation tools that are too technical for most people;
- enterprise copilots that hide capability behind heavy setup and admin friction.

Klava should feel:
- as easy to start as a consumer app;
- as powerful as an expert local operator;
- as safe and structured as a serious systems product.

## Product Principles

- `One app, one main window`: the user should never need terminal setup to begin.
- `Conversation-first`: users speak naturally, but the system underneath remains typed, deterministic, and auditable.
- `Secrets are not messages`: credentials and tokens never live as ordinary chat content.
- `Parallel by default`: multiple tasks should be easy to create, inspect, pause, and resume.
- `Capability with guardrails`: maximum power for the product, strict controls for risky operations.
- `Fork discipline`: the product grows without turning the OpenClaw fork into an unmaintainable dead end.
- `Global readiness`: localization, accessibility, performance on modest hardware, and supportable diagnostics matter from day one.

## Target Users

Primary users:
- everyday desktop users who want an AI assistant that can actually do things;
- advanced users who want task parallelism, local system control, and integrations;
- creators, freelancers, developers, and operators who manage many repetitive workflows.

Secondary users:
- IT support and technical consultants;
- small teams who want a local operator for internal workflows;
- enterprise pilots that need controlled privileges, logs, and deployment options.

## Core Value Proposition

Klava gives the user one place to:
- talk to an AI;
- manage multiple work streams;
- connect services and messengers;
- control local files, apps, and system operations;
- approve sensitive actions safely;
- keep all of that manageable without learning infrastructure.

## Strategic Differentiators

- Desktop-native install and onboarding.
- Dialogue-based control plane over a strict action engine.
- Local privileged execution with typed workflows instead of unconstrained admin shell access.
- Best-in-class task parallelism in a consumer-friendly UI.
- Separate runtime and shell updates for long-term maintainability.
- Fast adoption of OpenClaw upstream improvements.

## Success Metrics

Activation:
- time from install to first useful command under 5 minutes;
- completion rate for onboarding above 85 percent;
- connection success for major model providers above 95 percent.

Product quality:
- crash-free desktop sessions above 99.5 percent;
- successful background update rate above 98 percent;
- median cold start under 3 seconds for the shell;
- median task creation under 1 second.

Capability:
- user can create, run, pause, and resume multiple tasks without leaving the main window;
- user can connect common providers and channels without manual config files;
- user can complete high-value local tasks through guided approvals.

Platform strategy:
- Windows first with hidden infrastructure complexity;
- macOS parity planned from the beginning;
- fork sync window from upstream OpenClaw improvements under 2 weeks for non-breaking releases.

## Non-Goals for Initial Releases

- replacing every enterprise IT tool on day one;
- unrestricted root/admin shell autonomy without guardrails;
- exposing raw internal runtime complexity to end users;
- supporting every third-party integration before the core desktop experience is excellent.

## North Star

The product should feel like this:
- ordinary people can use it immediately;
- power users do not hit a wall after five minutes;
- technical reviewers respect the architecture;
- updates make the product stronger without destabilizing the fork.
