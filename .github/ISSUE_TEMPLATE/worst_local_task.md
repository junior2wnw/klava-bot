---
name: Task intake
about: Outline a difficult local-machine workflow, its approval boundaries, and desired end state.
title: "[Intake] "
---

Use this template for machine work that still requires too much memory, too many windows, or too much operator caution.

This issue is public. Do not post secrets, customer data, credentials, or private infrastructure details.

## The task

What is the actual local task?

- what starts broken, slow, risky, or unfinished;
- what the operator has to inspect or change;
- what tools or machine surfaces are involved.

## Why this is difficult

What makes this workflow non-trivial enough to deserve a stronger operator surface?

- too many repeated steps;
- risky shell commands;
- fragile local state;
- approvals or rollback anxiety;
- too much context switching.

## Machine and stack

Examples:

- Windows or macOS
- developer laptop, support workstation, internal IT, consultant machine
- languages, frameworks, CLIs, drivers, or services involved

## Approvals and danger points

Where should Klava clearly stop and ask before moving forward?

## What a win looks like

Describe the end state that would make this workflow feel solved.

## Why Klava should own this

Why does this belong in a local-first task log with approvals and transcript history instead of a plain script, chat reply, or remote admin tool?
