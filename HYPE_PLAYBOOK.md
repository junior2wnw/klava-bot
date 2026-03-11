# Hype Playbook

This file packages two public angles that create attention without lying about what `Klava` can do today.

## Angle 1: GitHub 2FA turned into a ship deadline

GitHub sent a notice that contributors who push code on GitHub.com now need `2FA`, with access limited after `April 25, 2026` until it is enabled.

That is not traction. It is a forcing function.

The honest punchline is:

> GitHub gave the account a 2FA deadline, so the repo had to start showing receipts instead of aspirations.

Use this asset:

- [2FA pressure-test share card](./docs/assets/2fa-pressure-test.svg)
- [2FA share landing page](https://junior2wnw.github.io/klava-bot/ship-the-receipts.html)

## Angle 2: Bring your worst local task

Instead of asking people to react to vague "AI agent" language, invite them to submit the ugliest local workflow they repeat.

Use this entry point:

- [Worst local task challenge](https://github.com/junior2wnw/klava-bot/issues/new?template=worst_local_task.md)

## GitHub discussion / post copy

Title:

`GitHub gave me a 2FA deadline, so I made this repo show receipts`

Body:

GitHub sent me the new 2FA notice for contributors, which is fair. If the account is active enough to get the deadline, the repo should be active enough to justify it.

So I tightened Klava around one claim I can actually defend:

- local-first desktop agent
- one task log
- one approval model
- guarded shell work
- multi-step operations with explicit status
- task-attached history instead of a disposable chat turn

What is real in the repo right now:

- Electron desktop shell
- local runtime API
- Pro surface for durable operations
- approval-gated terminal flow
- task transcript and support bundle export
- public CI

What I want next is not more generic AI demos. I want the worst real local workflows people keep repeating.

Repo:
- https://github.com/junior2wnw/klava-bot

Challenge:
- https://github.com/junior2wnw/klava-bot/issues/new?template=worst_local_task.md

Share card:
- https://github.com/junior2wnw/klava-bot/blob/main/docs/assets/2fa-pressure-test.svg

Share landing:
- https://junior2wnw.github.io/klava-bot/ship-the-receipts.html

## Short post

GitHub told me to enable 2FA by April 25, 2026 because I contribute code here.

Fair.

So I used that deadline to make this repo show receipts:

- desktop shell
- local runtime
- approval-gated terminal
- multi-step operations
- task history

Klava is a local-first desktop agent for real machine work, not just chat.

If you have a truly ugly local workflow, send it here:
https://github.com/junior2wnw/klava-bot/issues/new?template=worst_local_task.md

Repo:
https://github.com/junior2wnw/klava-bot

## Hacker News style

Title:

`Show HN: A local-first desktop agent built because GitHub's 2FA email forced me to ship receipts`

Post:

GitHub's new 2FA contributor deadline gave me a simple rule: stop talking in future tense and make the repo prove something now.

Klava is a desktop agent project for local work:

- local runtime
- one task log
- approval-gated shell work
- durable multi-step operations
- explicit status and history

I am trying to build toward an operator surface for machine tasks that are too risky and too stateful for a plain chat box.

The repo is here:
https://github.com/junior2wnw/klava-bot

If you have an ugly local workflow that should become a runbook, post it here:
https://github.com/junior2wnw/klava-bot/issues/new?template=worst_local_task.md

## What you can claim safely

- Klava has a real desktop shell, local runtime, guarded terminal flow, and operations layer in the repo.
- The operations model is typed and tested across `draft`, `running`, `awaiting_approval`, `succeeded`, and `failed`.
- Approval rejection can fail an operation step instead of silently bypassing it.
- The product direction is larger than today's shipped surface, but the current implementation already supports structured local work inside one task.

## What not to claim

- Do not say Klava can do everything on a computer today.
- Do not say every planned workflow in `README.md` is already implemented.
- Do not imply the Gonka provider-side chat issue is fixed if it is still unresolved.
- Do not use hype language that erases the approval model or safety boundary.
