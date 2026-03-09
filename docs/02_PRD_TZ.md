# PRD and Technical Spec

## Product Name

Working name:
- `Klava Bot`
- alternate brand expression for UX copy: `Klava`

## Product Summary

Klava is a desktop application that packages `OpenClaw` into a consumer-friendly product with minimal architectural overhead. The user installs one app, authenticates a model provider, and controls tasks, integrations, and local system actions through a conversation-first interface.

## Goals

- Make setup radically simpler than current OpenClaw-style self-hosting.
- Keep `OpenClaw` as the core runtime and default capability engine.
- Deliver a desktop-native product for Windows first and macOS next.
- Provide maximum practical functionality without sacrificing safety.
- Keep architecture small and modular so new capabilities, providers, and system integrations can be added without rewrites.
- Keep the fork easy to update when OpenClaw improves.

## Design Constraints

- If `OpenClaw` already supports the capability, Klava must reuse it rather than rebuild it.
- New product behavior should be added as a shell wrapper, module, or adapter before considering a fork patch.
- Optional features such as voice, cloud, privileged workflows, and future packs must remain removable.
- UI work must fit a small reusable component system rather than page-specific one-off implementations.
- A feature should be understandable by an average programmer without deep knowledge of the full codebase.

## Primary User Stories

- As a new user, I install Klava and start using it without reading technical docs.
- As a user, I paste an API key once and immediately get a usable assistant.
- As a user, I manage all tasks and integrations from one dialogue window.
- As a user, I create multiple tasks in parallel with one click.
- As a user, I ask Klava to connect Telegram, Discord, WhatsApp, files, or a local tool, and Klava walks me through the right flow.
- As a user, I ask Klava to perform system-level actions, and I get clear approvals before anything risky happens.
- As a support engineer, I can inspect logs, health, runtime version, and update state quickly.
- As a product team, we can ship UI changes, runtime changes, and fork sync updates independently.

## Functional Requirements

### FR-01 Installation and Bootstrap

- The product must ship as a signed desktop installer for Windows.
- The installer must place a desktop shortcut and optional startup entry.
- First launch must open directly into onboarding.
- The app must detect missing prerequisites and resolve them automatically whenever possible.
- The user must not need to install Node.js, pnpm, Git, or WSL manually as part of the normal flow.

### FR-02 First-Run Onboarding

- The first-run experience must ask the user to connect a model provider.
- The user must be able to provide an API key through a secure input surface.
- The onboarding flow must validate the provider connection before entering the main workspace.
- The onboarding flow must offer a short example prompt so the user gets a successful first action immediately.

### FR-03 Conversation-First Control

- The main surface must be a dialogue interface.
- The user must be able to issue commands in natural language.
- The system must map natural language requests to typed actions, workflows, or assistant responses.
- The chat must support live streaming of status, tool output, approvals, and final results.
- The system must keep a readable transcript even when the underlying workflow is complex.

### FR-04 Parallel Tasks and Sessions

- The user must be able to create a new task in one click.
- The user must be able to run multiple tasks in parallel.
- Each task must preserve its own context, history, artifacts, and status.
- The user must be able to pause, resume, cancel, duplicate, archive, and rename tasks.
- The UI must make active work lanes obvious without clutter.

### FR-05 Workspaces and Agents

- The product must support multiple workspaces or assistant profiles.
- Each workspace may have different providers, tools, integrations, and policies.
- The user must be able to switch workspaces without losing task state.
- The product must support future persona presets and domain-specific assistants.

### FR-06 Integrations and Channels

- The product must support provider integrations such as OpenAI, Anthropic, Google, and local models.
- The product must support common communication channels such as Telegram, Discord, WhatsApp, Slack, and WebChat where legally and technically feasible.
- The product must support future plugin-style connectors for third-party services.
- Integration setup must be chat-triggerable but executed via structured setup flows.

### FR-07 Secrets and Authentication

- API keys, passwords, tokens, cookies, and OAuth credentials must never be stored as plain chat messages.
- Sensitive inputs must trigger a secure input sheet or browser-based auth flow.
- Secrets must be encrypted at rest in a dedicated local vault.
- The transcript must show redacted success states instead of raw secret values.
- Secret rotation and revocation must be supported.

### FR-08 Local Files and Apps

- The user must be able to ask Klava to inspect, organize, create, move, rename, and summarize files.
- The user must be able to launch installed apps through approved workflows.
- The user must be able to install approved applications through package-manager or vendor-backed workflows where available.
- File and app actions must be scoped by capability policies and approval class.

### FR-09 Local System Operations

- The product must support local system actions such as services, processes, networking checks, package installation, diagnostics, cleanup, and selected settings changes.
- High-risk operations must be routed through typed system workflows rather than unconstrained shell execution.
- Driver reinstall, service repair, network repair, and similar actions must exist as controlled workflows with validation and rollback strategy.
- The system must keep an auditable record of dangerous operations.

### FR-10 Privileged Execution

- The product must separate normal UI permissions from privileged system execution.
- Privileged operations must run through a dedicated helper with explicit allowlisted capabilities.
- Dangerous operations must require clear user approval and native OS elevation where applicable.
- The product must support capability policies that can be disabled per device, workspace, or organization.

### FR-11 Diagnostics and Support

- The app must expose runtime health, versions, connectivity state, update state, and recent logs.
- The user must be able to generate a support bundle that excludes raw secrets.
- The app must explain failures in plain language and offer recovery steps.

### FR-12 Updates

- The desktop shell must support automatic background updates.
- The runtime must support independent updates from the shell.
- OpenClaw-based runtime updates must be versioned separately from the shell.
- Update channels must support stable, beta, and internal/canary.
- Failed updates must support rollback or reinstall guidance.

### FR-13 International Readiness

- The UI architecture must support localization from the start.
- The system must support Unicode content and multilingual prompts safely.
- The product must target keyboard and screen-reader accessibility standards.

### FR-14 Observability and Product Intelligence

- The product must collect privacy-aware diagnostics and product telemetry only with a clear policy.
- Crash, startup, install, auth, task lifecycle, and update metrics must be measurable.
- Telemetry must be designed so that sensitive conversation content is not required for operational insight.

### FR-15 Voice Interaction

- Voice input and voice output must be optional, user-switchable features.
- The product must support push-to-talk and low-friction hands-free voice operation where licensing and platform constraints allow.
- The product must support local speech-to-text and text-to-speech paths, with optional cloud acceleration or fallback.
- The product must support barge-in, interruption, and cancellation while Klava is speaking.
- The product must produce clear voice-related error states such as unavailable microphone, unavailable model, unavailable voice pack, and invalid voice request.

### FR-16 Klava Cloud Access Key

- The product must support a `Klava Cloud` mode where the user starts with one Klava-issued API key.
- In Klava Cloud mode, provider requests must be proxied through a Klava-managed server layer without exposing upstream provider keys to clients.
- The product must still support `bring your own provider key` mode.
- The shell must present both modes clearly without forcing users to understand backend complexity.

### FR-17 Voice Identity and Pack Policy

- The product must support curated voice packs, including local packs and server-distributed signed packs.
- The default product must not automatically fetch or enable unlicensed impersonation packs for real people.
- Requests for unavailable or disallowed voices must produce a clear response and offer safe alternatives.
- If an authorized voice pack system is added later, packs must carry license and provenance metadata.

## Non-Functional Requirements

### NFR-01 Performance

- The shell should feel responsive on mainstream consumer hardware.
- The first interactive desktop frame should appear under 3 seconds in warm starts.
- Task switching should feel instant for active sessions.

### NFR-02 Reliability

- Runtime restarts should not destroy user tasks or workspace configuration.
- The app should recover from shell crashes without losing core state.
- Upgrade migrations must be repeatable and reversible.

### NFR-03 Security

- Secrets must be encrypted at rest and redacted from logs.
- High-risk capabilities must be isolated from the chat transcript and model output.
- Supply-chain integrity must be enforced for builds and updates.

### NFR-04 Modularity

- `OpenClaw`, the desktop shell, contracts, and optional modules must evolve independently.
- Product-specific logic must live outside the OpenClaw fork whenever possible.
- The core product must remain useful even when optional modules are disabled.

### NFR-05 Maintainability

- Public internal interfaces must be typed and versioned.
- Every storage format and local API contract must include migration rules.
- Architectural decisions should be documented through ADRs.
- A normal feature path should touch as few modules as possible.
- New contributors should be able to reason about UI and runtime behavior without reading the entire repository.

### NFR-06 Portability

- Windows must be first-class.
- macOS support must be planned at the interface and service-boundary level from the start.
- The product must avoid unnecessary platform-specific leakage into business logic.

### NFR-07 Audio Latency

- Voice command capture should feel immediate on mainstream consumer hardware.
- The voice stack should support local-first low-latency streaming for transcription and playback.
- Audio models, packs, and caches must be downloadable independently from the main shell bundle.

## Scope by Release

### MVP

- Windows package.
- Desktop shell.
- OpenClaw-based runtime integration.
- Provider onboarding.
- Core conversation UI.
- Parallel tasks.
- Secret vault.
- Health and logs.
- Guarded terminal approvals.
- Compact modular UI foundation.

### V1

- Installer and updater polish.
- Optional local voice module.
- Optional privileged helper workflows.
- Better diagnostics.
- Broader provider and channel support.
- Signed update channels.
- Structured policy controls.
- Optional voice pack registry.
- Optional Klava Cloud key mode.

### V2

- macOS release.
- richer marketplace/plugin SDK;
- organization policy bundles;
- advanced local automation packs;
- collaboration and shared workspace options where strategically useful.

## Acceptance Criteria for MVP

- A user on a clean Windows machine can install Klava and reach the first successful prompt without manual dependency setup.
- API key entry uses a secure input path and does not remain visible in the transcript.
- The user can create at least 3 independent tasks and observe separate progress.
- The shell can restart and reconnect to the runtime without losing task metadata.
- The product can ship an updated shell without forcing a full runtime reinstall.
- The user can enable voice input, speak a short command, and receive a usable response path.

## Acceptance Criteria for V1

- The user can complete at least three guarded local workflows through approvals.
- The privileged helper remains isolated and auditable.
- Driver-related workflows include validation, user confirmation, logging, and rollback strategy.
- Upstream OpenClaw updates can be integrated with a bounded patch surface and automated regression checks.
- Voice packs can be installed or updated independently from the desktop shell.
- Klava Cloud mode can authenticate the user with one Klava-issued key.
