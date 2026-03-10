# Klava Manifesto

Most AI agents still behave like advisors standing next to the machine.

They suggest.
They narrate.
They propose shell commands.
They maybe click a browser.

That is not enough.

Klava is built around a stricter idea:

> a real computer agent should be able to participate in the full operating loop of a machine, while still remaining inspectable, typed, and governable by the user.

That means five things.

## 1. One executable matters

A serious local agent should not require a maze of setup steps before a normal person can even evaluate it.

The right shape is:

- download one executable
- launch it
- connect what is necessary
- start operating

Source code still matters. But a public repo without a usable product entrypoint is incomplete.

## 2. Local power without local chaos

The future is not "LLM with unlimited admin shell".

The future is:

- typed workflows
- explicit approvals
- secret isolation
- audit trails
- bounded privileged execution

If an agent will eventually reinstall drivers, reconfigure networks, replace backend providers, or repair a broken workstation, it must do so through structures humans can understand.

## 3. Desktop software deserves first-class design

If the agent is meant to live next to the machine, the UI cannot be an afterthought.

The shell should feel intentional.
The task log should be legible.
Approvals should be unambiguous.
Support bundles and diagnostics should exist from day one.

Good product design is not decoration. It is operational clarity.

## 4. Forks should be honest

Klava is OpenClaw-derived.

That relationship should be visible, documented, and technically understandable.

Good open-source projects do not hide their lineage.
They explain what stayed close to upstream, what changed, and why.

## 5. Ambition should be precise

There is nothing wrong with building toward a system that can:

- bootstrap a machine
- repair a driver stack
- migrate a backend
- rotate secrets
- produce an audit trail
- help another human recover the machine later

What matters is honesty:

- say what is shipped
- say what is architecture
- say what is roadmap

The project should feel formidable because it is coherent, not because it makes cheap claims.

## The standard

Klava should be judged by a high bar:

- easy to install
- easy to audit
- hard to misuse accidentally
- powerful in the places that matter
- simple enough that strong engineers still want to contribute

If it succeeds, it will not be because it was loud.

It will be because it made the shape of a real desktop agent feel inevitable.
