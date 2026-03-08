# System Architecture

## Architectural Thesis

Klava should be built as a desktop product around a `headless OpenClaw-derived runtime`, not as a direct skin on top of the existing OpenClaw control UI.

This keeps:
- the desktop app replaceable and product-specific;
- the runtime portable and updateable;
- the OpenClaw fork narrow and easier to sync;
- privileged system actions isolated from the chat shell.

## High-Level Topology

```text
+---------------------+       +-----------------------+
| Klava Desktop Shell | <---> | Local Control API/WS  |
| Electron + Web UI   |       | typed contracts       |
+---------------------+       +-----------------------+
             |                              |
             |                              v
             |                   +-----------------------+
             |                   | Klava Runtime         |
             |                   | forked OpenClaw core  |
             |                   +-----------------------+
             |                              |
             |                  +-----------+-----------+
             |                  |                       |
             v                  v                       v
+---------------------+  +----------------+   +----------------------+
| Secret Vault        |  | Action Engine  |   | Providers/Channels   |
| encrypted local     |  | typed workflows|   | OpenAI, Anthropic... |
+---------------------+  +----------------+   +----------------------+
             |
             v
+---------------------+
| Privileged Helper   |
| allowlisted admin   |
+---------------------+
             |
             v
+---------------------+
| Windows/macOS OS    |
| services and tools  |
+---------------------+
```

## Core Modules

### 1. Desktop Shell

Current implementation:
- `Electron`
- `TypeScript + React 19 + Vite`
- local runtime bootstrap from the desktop main process
- local state boundaries around tasks, session list, onboarding, and diagnostics

Strategic note:
- the repo now ships a real Windows desktop executable through Electron because it is the shortest path to a usable local product;
- a future native-shell transition remains possible because the shell is already separated from the runtime behind typed contracts.

Responsibilities:
- app window and navigation;
- onboarding;
- conversation UI;
- task rail and workspace switching;
- secure sheets for secrets and approvals;
- settings, health, logs, and update UX;
- rendering live events from the local control API.

### 2. Local Control API

This is the internal product contract between shell and runtime.

Rules:
- stable and versioned;
- typed request and event schema;
- transport over localhost HTTP/WebSocket or IPC bridge;
- no direct UI import from the OpenClaw fork.

Responsibilities:
- normalize runtime capabilities;
- provide a safe, product-specific API surface;
- support backward-compatible evolution between shell and runtime versions.

### 3. Klava Runtime

This is the controlled OpenClaw-based backend.

Responsibilities:
- sessions and task orchestration;
- model provider access;
- tool execution routing;
- integration/channel adapters;
- queueing, streaming, and state persistence;
- workspace and profile context;
- policy enforcement hooks;
- event publishing to the shell.

Fork strategy:
- keep product-specific code outside the fork when possible;
- add only the minimal patches needed for runtime embedding, hooks, and API normalization;
- treat the fork as vendor core, not as the place for every new feature.

### 4. Action Engine

The action engine is the main safety and capability layer.

Responsibilities:
- map user intent to typed actions;
- determine capability class;
- invoke secure setup flows;
- request approvals when required;
- call normal or privileged executors;
- return structured status, artifacts, and audit records.

Important rule:
- the language model never gets unrestricted admin execution by default.

Current implementation note:
- the runtime already includes an agent orchestration layer that can call typed terminal tools from ordinary chat;
- this keeps terminal execution inside the same policy and approval framework instead of turning free-form shell access into a hidden side channel.

### 5. Secret Vault

Responsibilities:
- store API keys, tokens, passwords, cookies, and integration secrets;
- keep plaintext out of transcript, logs, and crash dumps where feasible;
- provide secret references to workflows without exposing values to the shell.

Storage strategy:
- encrypted local vault with OS-protected key material;
- explicit secret metadata such as provider, scope, created date, last validation date, and rotation state.

### 6. Privileged Helper

Responsibilities:
- run a minimal signed helper with elevated rights;
- expose allowlisted operations through typed commands;
- execute guarded and restricted workflows under policy;
- log every privileged action;
- support rollback and diagnostics.

Important rule:
- free-form admin shell access is not a product primitive.

### 7. Runtime Manager

Responsibilities:
- bootstrap local runtime;
- install dependencies or hidden substrate;
- monitor health;
- manage runtime updates;
- restart and recover services;
- collect diagnostics.

### 8. Voice Stack

Responsibilities:
- capture microphone input;
- perform VAD, buffering, and streaming transcription;
- synthesize speech with local or cloud-backed voices;
- manage voice packs, playback queues, and interruption;
- expose typed audio events to the shell and runtime.

Recommended composition:
- `Silero VAD` for fast local voice activity detection;
- `whisper.cpp` as the primary native/offline low-latency STT engine;
- `faster-whisper` as a secondary high-accuracy or batch transcription engine;
- `Kokoro-82M` as the primary local high-quality TTS engine;
- cloud fallback or premium mode via `OpenAI Realtime`, `gpt-4o-mini-transcribe`, and `gpt-4o-mini-tts` where appropriate.

### 9. Klava Cloud Gateway

Responsibilities:
- authenticate Klava-issued API keys;
- proxy provider requests;
- route requests across model providers;
- meter usage and enforce quotas;
- distribute voice packs and update manifests;
- provide device-safe bootstrap data to clients.

## Platform Strategy

### Windows First

Recommended deployment model:
- `Desktop Shell` runs as a normal Windows app.
- `Runtime Manager` manages a hidden `private WSL distro` for Linux-dependent runtime components where required.
- `Privileged Helper` runs on the Windows host as a signed native service or helper process.
- The user never needs to open Ubuntu or a terminal.

Why this is the strongest V1 choice:
- OpenClaw already has a Linux-first runtime posture and recommends WSL2 on Windows.
- A private distro gives predictable compatibility.
- The shell and helper can still feel fully native on Windows.

Current repo state:
- the project already ships a `portable Electron .exe` that embeds the shell and starts the local runtime;
- the next packaging layer is a real installer with shortcut creation, repair, and update hooks.

### macOS Planned from Day One

Recommended model:
- same desktop shell concept via Tauri;
- runtime managed through a native background service or launchd-managed process;
- secrets integrated with platform-appropriate secure storage;
- same control API contract as Windows.

## Voice Subsystem Notes

The voice subsystem should be plug-in driven.

Key interfaces:
- `VoiceInputEngine`
- `VADProvider`
- `TranscriptionProvider`
- `VoicePackResolver`
- `SpeechSynthesisProvider`
- `PlaybackController`

Recommended first modes:
- `push-to-talk`;
- `hold-to-talk`;
- `continuous voice with VAD`;
- optional future wake phrase mode once licensing is commercially safe.

Important product decision:
- do not make custom always-listening wake words a launch dependency;
- wake-word licensing in the current ecosystem is often restrictive for commercial products.

## Primary Data Model

- `User Profile`: local app identity and preferences.
- `Workspace`: provider set, policy set, integrations, task pool.
- `Agent Profile`: persona, tool set, model preferences, role constraints.
- `Task Session`: the unit of parallel work visible in the task rail.
- `Run`: one execution instance inside a task session.
- `Action`: typed operation created from user intent or workflow logic.
- `Approval`: required confirmation step with scope, risk level, and expiry.
- `Secret Reference`: metadata pointer to encrypted credentials.
- `Artifact`: files, logs, screenshots, reports, outputs, patches, or summaries.
- `Audit Record`: immutable operational log for risky system work.

## Capability Classes

- `Safe`: read-only or low-risk operations.
- `Guarded`: operations with meaningful impact that need policy and approval.
- `Restricted`: operations with high system risk that require explicit workflow support, stronger confirmation, and logging.

This capability model should be shared by:
- the runtime;
- the shell;
- the privileged helper;
- enterprise policy layers in future releases.

## Recommended Tech Stack

Desktop current:
- `Electron`
- `React 19`
- `TypeScript`
- `Vite`

Desktop target evolution:
- keep the UI/runtime boundary stable enough that a future shell transition remains possible if Electron stops being the best tradeoff.

Runtime:
- `Node.js 22`
- `pnpm`
- controlled fork of `OpenClaw`

Persistence:
- local relational store such as `SQLite` for metadata, tasks, audit logs, and migrations;
- secret vault for credentials;
- structured log files for diagnostics.

Tooling:
- `pnpm` monorepo;
- `turbo` or equivalent task orchestration;
- code signing and release automation;
- end-to-end test harness for install, update, onboarding, and privileged flows.

## Extension Model

Future extensibility should happen via:
- provider adapters;
- integration connectors;
- tool packs;
- action packs;
- policy packs;
- design-system-safe UI extensions where strategically justified.

Rule:
- plugin boundaries should target typed contracts, not direct access to internal runtime objects.

## Why Not Ship the Existing OpenClaw UI as the Product

Because it would create long-term limits:
- the product UX would be constrained by an admin-oriented interface;
- secret handling and sensitive flows would remain too coupled to the transcript;
- desktop-specific onboarding and native integration would remain second-class;
- product differentiation would be weaker;
- macOS and Windows parity would be harder to control cleanly.

Klava should reuse OpenClaw where OpenClaw is strongest:
- runtime orchestration;
- providers and channels;
- session tooling;
- agent infrastructure.

Klava should replace or wrap what needs product-grade control:
- installation;
- onboarding;
- UX;
- secrets;
- updates;
- privileged system operations;
- release management.
