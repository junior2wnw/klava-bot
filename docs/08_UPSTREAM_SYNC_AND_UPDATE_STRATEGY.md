# Upstream Sync and Update Strategy

## Goal

Keep `OpenClaw` updates cheap.

That means:
- keep the fork small;
- keep product logic outside the fork;
- ship user-facing improvements mostly through the shell and optional modules.

## Fork Policy

Allowed fork changes:
- embedding hooks;
- thin adapter hooks;
- bug fixes that are upstreamable or clearly isolated.

Disallowed default behavior:
- building product UX inside the fork;
- moving secrets, installers, or cloud logic into the fork;
- using the fork as the main place for new feature development.

## Patch Budget

The target patch budget is near zero.

Rules:
- every fork patch needs a reason;
- every patch should be easy to describe in one sentence;
- if a feature can live outside the fork, it must live outside the fork.

## Product Update Model

Default shipping model now:
- one desktop artifact that already bundles a pinned upstream `OpenClaw` runtime;
- optional `Privileged Helper` only when privileged workflows require it;
- optional module assets such as voice packs.

The default Windows user should not need to install `openclaw` globally.

The embedded runtime version is pinned in:
- `apps/desktop/package.json` -> `klava.bundledOpenClawVersion`

The vendored runtime is prepared by:
- `apps/desktop/scripts/prepare-openclaw-runtime.mjs`

This keeps user-facing work modular without turning Klava into a fork-heavy custom runtime.

## Upstream Compatibility Strategy

When upstream adds a new capability, prefer this order:
1. expose it through `/openclaw ...` chat pass-through;
2. expose the same capability through Control UI launch or bridge diagnostics;
3. add thin typed shell affordances only if the workflow is common enough to deserve local product UX.

Why this matters:
- future upstream capabilities become usable immediately through pass-through;
- parity stays high even before local UI polish lands;
- Klava does not fall behind by waiting for a local reimplementation.

## Bundled Runtime Update Procedure

For a normal upstream refresh:
1. bump `apps/desktop/package.json` -> `klava.bundledOpenClawVersion`;
2. run `npm run build --workspace @klava/desktop` so the vendored runtime is rebuilt;
3. run `npm run test --workspace @klava/desktop`;
4. run `npm run test --workspace @klava/runtime`;
5. run `npm run dist:win --workspace @klava/desktop`;
6. smoke the packaged runtime and Control UI lifecycle.

Required invariants after an update:
- `OPENCLAW_CLI_PATH` resolves to the bundled runtime, not to a global install;
- chat-side `openclaw ...` commands still route through the bundled runtime;
- desktop start/stop ownership still works;
- Klava can still adopt a previously managed gateway after crash recovery.

## Update UX

The update experience should stay simple:
- background download;
- short summary;
- restart only when needed;
- no exposure to fork complexity.

User-facing rule:
- an OpenClaw update inside Klava should look like a normal Klava update, not like a second product the user has to manage manually.

## Practical Rule

If a desired feature can be built in:
- `apps/desktop`
- `packages/contracts`
- `packages/ui`
- `packages/modules/*`

then the fork is off limits.
