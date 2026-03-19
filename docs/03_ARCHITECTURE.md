# System Architecture

## Architectural Thesis

`OpenClaw` is the product core.

Klava should not rebuild what `OpenClaw` already does well.
Klava should add only the minimum layers required to turn that core into a polished desktop product:
- desktop shell;
- onboarding and packaging;
- security and approval wrappers;
- modular optional capabilities.

Default decision order:
1. reuse `OpenClaw`;
2. wrap it in Klava;
3. patch the fork only if blocked;
4. never start with a rewrite.

## Simplified Topology

```text
+---------------------------+
| Klava Desktop Shell       |
| Electron + React UI       |
+-------------+-------------+
              |
              v
+---------------------------+
| Thin Klava Adapter        |
| typed contracts           |
| approvals + health sync   |
| dialog -> /openclaw path  |
+-------------+-------------+
              |
              v
+---------------------------+
| Bundled OpenClaw Runtime  |
| vendored upstream package |
| bundled node launcher     |
| managed gateway lifecycle |
+-----+--------------+------+
      |              |
      v              v
+-----------+   +-------------------+
| Vault/UI  |   | Optional Modules  |
| wrappers  |   | voice, helper,    |
| approvals |   | cloud, packs      |
+-----------+   +-------------------+
```

## Mandatory Building Blocks

### 1. OpenClaw Core

This is the default engine for:
- tasks and sessions;
- agent orchestration;
- provider access;
- tool execution;
- streaming state.

Rule:
- if the feature already fits here, keep it here.

### 2. Klava Desktop Shell

This is a thin product shell responsible for:
- windowing;
- onboarding;
- task navigation;
- conversation rendering;
- approvals and secure sheets;
- settings, logs, and diagnostics.

Rule:
- the shell must not become a second runtime.

### 2a. Managed Bundled OpenClaw Runtime

Current product reality on Windows:
- the desktop build vendors a pinned upstream `openclaw` package into the app bundle;
- the desktop also carries a bundled `node.exe` launcher for that runtime;
- startup configures process env so both shell-side probes and chat-side `openclaw ...` commands resolve to the bundled runtime first.

Lifecycle rules:
- opening `Klava.exe` should automatically start the bundled OpenClaw gateway in the background;
- if Klava crashes and the managed gateway is still alive, the next launch should adopt that process instead of spawning a duplicate;
- closing the desktop should stop the desktop-owned gateway before the app exits;
- the shell must distinguish "desktop manages the bridge" from "this exact gateway process is owned by this desktop instance".

This preserves the one-`exe` product promise without rewriting upstream OpenClaw into a separate local clone.

### 3. Thin Klava Adapter

This is the only required bridge between the shell and `OpenClaw`.

Responsibilities:
- typed contracts;
- runtime bootstrap;
- health and version reporting;
- minimal state normalization for the UI.
- dialog mapping for `/openclaw ...` pass-through and guarded OpenClaw mutations.

Rule:
- keep the adapter narrow enough that upstream sync stays cheap.

### 4. UI Kit

The UI kit owns:
- tokens;
- layout primitives;
- core controls;
- cards, sheets, panes, and surface containers.

Rule:
- few components, many reusable states.

### 5. Optional Modules

Everything beyond the core should be optional:
- voice;
- privileged workflows;
- cloud gateway;
- pack registries;
- advanced integrations.

Rule:
- if a module is disabled, chat, tasks, and normal local work must still function.

## Integration Rules

- `OpenClaw` is the source of truth for runtime capability.
- Klava-specific logic should live outside the fork whenever possible.
- Fork patches must stay near zero and be easy to explain.
- New capability should land as a wrapper or module before any fork edit is considered.
- A feature path should be understandable by an average programmer without reading the full repo.
- When a future upstream capability already exists in CLI or gateway form, Klava should expose it through pass-through, bridge state, or Control UI embedding before considering any local reimplementation.

## UI Architecture

The shell should keep only three permanent structural regions:
- `Task Rail`
- `Main Surface`
- `Context Pane`

Surface modes:
- `Chat`
- `Terminal`
- optional `Pro`

Rules:
- no additional permanent regions without a strong reason;
- no giant all-in-one screen component;
- each surface should be composed from small reusable pieces;
- the UI must remain calm even when capability is high.

## Apple-Grade Quality Bar

The target is not "many interface elements".
The target is high quality in a very small element set.

Required qualities:
- precise spacing;
- strong visual hierarchy;
- clear states;
- smooth but restrained motion;
- excellent typography;
- obvious primary actions;
- minimal chrome.

## Platform Strategy

### Windows First

Use the simplest path that works:
- `Electron` shell;
- bundled `OpenClaw` runtime inside the desktop package;
- installer and updater as thin product layers;
- no hidden platform complexity until it is required.

Default Windows artifact:
- one desktop package that already contains the pinned OpenClaw runtime;
- no separate global `openclaw` installation required for normal use;
- all lifecycle control should happen from the desktop shell.

### macOS Later

macOS should reuse the same shell concepts and contracts after the Windows flow is stable.

## Success Conditions

The architecture is correct when:
- `OpenClaw` remains clearly visible as the core;
- the product is useful without optional modules;
- upstream sync remains cheap;
- UI work stays modular;
- an average programmer can safely add or improve a module.
