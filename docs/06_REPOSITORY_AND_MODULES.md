# Repository and Modules

## Repository Strategy

The repository should stay conceptually small even if it contains multiple packages.

Only a few boundaries are mandatory:
- `OpenClaw` core;
- desktop shell;
- shared contracts;
- reusable UI kit;
- optional modules.

Everything else is implementation detail.

## Minimal Conceptual Structure

```text
klava-bot/
  README.md
  docs/
  apps/
    desktop/
  packages/
    contracts/
    ui/
    modules/
      voice/
      helper/
      cloud/
  forks/
    openclaw/
  tooling/
```

Note:
- the physical repository may contain more folders;
- contributors should still think in terms of these few core boundaries.

## Required Ownership

### `forks/openclaw`

Owns:
- core runtime behavior;
- provider and tool capabilities;
- upstream sync boundary.

Rule:
- minimal patches only.

### `apps/desktop`

Owns:
- shell frame;
- onboarding;
- task rail;
- main surfaces;
- diagnostics;
- packaging entry points.

Rule:
- product shell only, not duplicated runtime logic.

### `packages/contracts`

Owns:
- shell-to-runtime types;
- event shapes;
- health and version contracts.

Rule:
- keep contracts small and stable.

### `packages/ui`

Owns:
- tokens;
- layout primitives;
- reusable UI components;
- shell composition helpers.

Rule:
- few components, strong reuse.

### `packages/modules/*`

Owns optional capability packs such as:
- voice;
- privileged helper adapters;
- cloud access;
- future integrations.

Rule:
- optional modules must not complicate the core shell.

## Engineering Rules

- If `OpenClaw` already solves the problem, reuse it.
- If Klava needs product polish, build a wrapper in `apps/desktop`, `packages/contracts`, or `packages/ui`.
- If a feature is optional, put it in `packages/modules/*`.
- UI code must not import internal fork code directly.
- Fork edits require a clear reason and a small patch.
- A normal feature should not require understanding the whole repository.

## Definition of Good Modularity

Modularity means:
- contributors can locate ownership quickly;
- optional modules can be disabled cleanly;
- the shell can evolve without rewriting the core runtime;
- `OpenClaw` can be updated with bounded effort;
- a medium-level programmer can add a feature by changing a small number of files.
