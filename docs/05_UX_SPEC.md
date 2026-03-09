# UX Specification

## UX Goal

Klava should feel as carefully designed as a premium desktop product while using very few interface elements.

The quality target is:
- Apple-grade attention to detail;
- minimal element count;
- high clarity;
- high comfort;
- no wasted chrome.

## Core UX Principles

- `Few elements, excellent behavior`: reduce the element set, not the quality bar.
- `Conversation-first`: the main control plane is natural language.
- `Parallel work without clutter`: multiple tasks must stay obvious and calm.
- `Visible trust`: approvals, secrets, and risky actions must be clear.
- `Modular UI`: every surface is composed from small reusable pieces.
- `Average-developer friendly`: UI structure must be easy to follow and extend.

## Main Shell Structure

The shell should keep only three permanent regions:

### Task Rail

Purpose:
- create and switch tasks fast;
- show concise state;
- stay visually quiet.

### Main Surface

Purpose:
- render chat, tool output, approvals, and results;
- switch between `Chat`, `Terminal`, and optional `Pro`.

### Context Pane

Purpose:
- show task detail, artifacts, logs, and settings without disturbing the main flow.

Rule:
- do not add more permanent structural regions unless absolutely necessary.

## Minimal Element Set

The product should rely on a small stable set of components:
- buttons;
- icon buttons;
- chips;
- cards;
- sheets;
- input fields;
- lists;
- panes;
- tabs only where they remove navigation complexity.

Rule:
- prefer reusing a known component with different states over inventing new visual patterns.

## Visual Direction

Required qualities:
- strong typography;
- disciplined spacing;
- restrained color usage;
- gentle depth;
- subtle motion;
- obvious focus and hover states;
- clean alignment.

Avoid:
- dashboard noise;
- decorative gradients by default;
- dense settings screens;
- too many badges, dividers, and borders.

## Interaction Rules

### First Launch

1. Open directly into onboarding.
2. Ask for provider connection.
3. Validate it.
4. Land the user in one ready task.

### New Task

1. One click or one sentence creates a task.
2. The task appears immediately.
3. The composer is ready.

### Sensitive Action

1. User asks for the action.
2. Klava shows a compact approval surface.
3. The user sees impact, command or workflow, and consequences.
4. Execution progress stays in the same task.

## UI Modularity Rules

- Every surface should be split into small reusable sections.
- No single screen file should become the only place that understands the feature.
- Layout primitives and stateful widgets must be shared.
- New surfaces must reuse the same shell frame and task model.
- A medium-level programmer should be able to add a state, card, or pane without redesigning the application.

## Composer Rules

The composer should support:
- natural language;
- drag-and-drop files;
- explicit send, stop, and retry;
- optional shortcuts for power users.

The composer should not:
- require hidden syntax;
- store secrets as plain messages;
- expose internal runtime complexity.

## Accessibility and Localization

The UI must support:
- keyboard-first navigation;
- readable contrast;
- screen-reader semantics;
- reduced-motion mode;
- flexible copy length and multilingual content.

## Design Source Of Truth

UI work should read from one source of truth:
- `design-system/MASTER.md` for global tokens, spacing, typography, and component rules;
- optional `design-system/pages/*.md` for page-specific overrides.

Rule:
- any AI or developer touching the UI should read these files first if they exist.

Optional aid:
- `ui-ux-pro-max-skill` may be used to generate or review the design system;
- it is useful for UI direction, but it must remain optional and must not become a required dependency for implementation.

## Quality Bar

The UI is correct when:
- the user sees very few controls;
- every control feels intentional;
- complex capability still feels simple;
- the shell remains pleasant under heavy use;
- contributors can work on the UI without fear of large regressions.
