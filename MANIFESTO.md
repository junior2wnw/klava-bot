# Klava Manifesto

Klava is built around a narrow idea: a desktop agent is useful only if it can help with local work without turning the machine into opaque automation.

That leads to five rules.

## 1. The first run must be simple

People should be able to download one executable, launch it, connect what is needed, and see the product working before they study the architecture.

Source code still matters. A working product entry point matters too.

## 2. Power needs boundaries

Klava should not become "an LLM with admin rights".

The safer shape is:

- typed workflows
- explicit approvals
- isolated secrets
- bounded privileged execution
- structured records

If the system will eventually reinstall drivers, reconfigure networks, replace backend providers, or repair a broken workstation, those actions need clear contracts and review points.

## 3. The desktop UI is part of the system

If the product lives next to the machine, the interface cannot be an afterthought.

Task history should be readable.
Approvals should be unambiguous.
Diagnostics should be easy to export.
Recovery context should be available when something goes wrong.

Good UI is not decoration here. It is part of safe operation.

## 4. Fork lineage should stay visible

Klava grows from OpenClaw.

That relationship should stay documented and technically understandable.
Contributors should be able to see what remained close to upstream, what changed, and why.

## 5. The roadmap should stay honest

It is reasonable to build toward a system that can:

- bootstrap a machine
- repair a driver stack
- migrate a backend
- rotate secrets
- produce an audit trail
- help another person recover the machine later

What matters is clear labeling:

- say what is shipped now
- say what is planned
- say what is still experimental

## The standard

Klava should be:

- easy to install
- easy to inspect
- hard to misuse by accident
- practical in the places that matter
- simple enough that strong engineers still want to extend it

That is the bar.
