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

Ship separate artifacts when useful:
- `Desktop Shell`
- `Runtime Bundle`
- optional `Privileged Helper`
- optional module assets such as voice packs

This keeps user-facing work modular without disturbing the core runtime.

## Update UX

The update experience should stay simple:
- background download;
- short summary;
- restart only when needed;
- no exposure to fork complexity.

## Practical Rule

If a desired feature can be built in:
- `apps/desktop`
- `packages/contracts`
- `packages/ui`
- `packages/modules/*`

then the fork is off limits.
