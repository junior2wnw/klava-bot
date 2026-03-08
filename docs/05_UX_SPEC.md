# UX Specification

## UX Goal

Klava should feel like a premium desktop instrument, not a generic chatbot panel.

The target aesthetic is:
- futuristic;
- minimal;
- calm;
- precise;
- premium;
- readable at a glance.

## Experience Principles

- `Conversation-first`: the main interaction starts with natural language.
- `One-click parallelism`: creating a new task should feel immediate.
- `Clarity over clutter`: the interface should stay calm even while many actions stream live.
- `Visible confidence`: the app should communicate what it is doing and why.
- `Secure by design`: sensitive steps look distinct and trustworthy.

## Main Information Architecture

The core shell should use three coordinated surfaces:

### Task Rail

Purpose:
- list active, paused, and recent tasks;
- create a new task in one click;
- show concise status and urgency;
- let the user switch contexts quickly.

Expected elements:
- `+ New Task`
- task cards with title, status, unread, provider badge, and running indicator;
- workspace switcher;
- global search or command entry.

### Conversation Surface

Purpose:
- hold the main dialogue;
- stream model output, tool progress, approvals, and results;
- show artifacts in context without forcing navigation away from the task.

Expected elements:
- large message surface;
- compact system status chips;
- tool cards;
- action cards;
- inline approvals;
- artifact previews;
- sticky composer.

### Work Pane

Purpose:
- show contextual detail without polluting the main dialogue;
- expose files, logs, settings, integration state, and task metadata.

Expected elements:
- current task info;
- recent artifacts;
- integration health;
- action history;
- diagnostic detail when expanded.

## Surface Mode System

The shell should be composed from switchable `surface modes`.

Initial surface set:
- `Chat`
- `Terminal`
- `Pro`

Why this matters:
- the product stays compact without collapsing functionality into one giant window;
- future editions can reuse the same shell and task model;
- the UI becomes a mode-driven constructor rather than a one-off screen.

## Visual Direction

Recommended style:
- light-first, with optional dark mode later;
- restrained palette with a strong neutral base and one precise accent color;
- elegant depth through translucency, blur, and subtle layered surfaces;
- compact window proportions with generous but disciplined whitespace;
- large typography and generous whitespace where it matters, not everywhere;
- motion focused on continuity, not decoration.

Avoid:
- generic sidebar SaaS look;
- default purple gradients;
- cluttered developer-dashboard aesthetics;
- excessive chrome and dense settings forms.

## Key User Flows

### First Launch

1. App opens into a clean welcome surface.
2. User chooses or is guided to a model provider.
3. User enters an API key or launches browser auth.
4. Klava validates the connection.
5. The first dialogue opens with a suggested command.

### New Task

1. User clicks `New Task` or writes a new intent.
2. A blank task session appears immediately in the rail.
3. The user starts typing or picks a suggested quick action.
4. The task begins streaming state and outputs.

### Connect Integration Through Chat

1. User writes `connect Telegram`.
2. The system recognizes an integration intent.
3. A secure setup card or sheet appears.
4. The secret is stored safely.
5. The conversation shows a clean success state.

### Perform a Dangerous Action

1. User asks Klava to perform a guarded or restricted operation.
2. The system resolves the typed workflow.
3. If the action is terminal-backed and guardable, a compact approval card appears inside the task surface.
4. The approval card explains impact, command, working directory, and side effects.
5. Native elevation appears only when needed.
6. Progress is streamed with visible checkpoints and final outcome.

## Chat Composer Behavior

The composer should support:
- natural language commands;
- drag-and-drop files;
- quick suggestions;
- slash-style command shortcuts for power users if useful;
- task context hints;
- send, stop, and retry controls.

The composer should not:
- ask the user to remember hidden syntax;
- expose raw config details by default;
- turn secret entry into normal text persistence.

## Secure Sheets

Secure sheets are mandatory for:
- API keys;
- passwords;
- tokens;
- cookies;
- confirmation of restricted operations.

Design rules:
- clearly distinct styling from ordinary messages;
- explicit label of what will be stored and where it will be used;
- one-click paste and validation;
- redacted preview after success.

## Parallel Task UX

Parallelism should be obvious and simple.

Rules:
- one click creates a new task;
- tasks show live status without stealing focus;
- users can pin important tasks;
- tasks can be paused and resumed;
- each task keeps isolated context;
- cross-task references should be explicit, not accidental.

## Error UX

The product should never fail silently.

Error messages should state:
- what failed;
- what the user can do next;
- whether data is safe;
- whether retry is useful;
- where to see more detail.

The shell should also distinguish:
- blocked by policy;
- waiting for approval;
- approved but execution failed;
- unsupported on this device;
- voice pack not available.

## Accessibility

The product should support:
- keyboard-first navigation;
- clear focus states;
- readable contrast;
- screen-reader friendly semantics;
- reduced-motion mode.

## Localization Readiness

The UI should be designed for:
- internationalized copy keys;
- variable string length;
- mixed-language conversation content;
- region-aware date, number, and time formatting.

## Future UX Extensions

Planned future surfaces:
- voice capture and spoken responses;
- compact floating quick-access mode;
- mobile companion for approvals and task monitoring;
- richer artifact viewers;
- advanced workspace templates.

## Current UX Decisions Landed In Code

- compact three-column shell with `Task Rail`, `Conversation/Terminal Surface`, and `Inspector Pane`;
- light-first translucent desktop visual language;
- surface registry architecture for `Chat`, `Terminal`, and future `Pro`;
- inline approval cards for guarded terminal commands;
- inspector-level summary of pending approvals;
- task status `awaiting_approval` to make command safety visible in the rail.
