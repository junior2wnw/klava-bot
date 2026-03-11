# Gonka Integration Status

This file documents the current public state of Klava's Gonka integration without pretending the provider path is healthier than it is.

## What works today

- secure onboarding and local secret handling;
- live Gonka validation;
- requester address discovery;
- balance lookup;
- model discovery and strongest-model selection.

## What is currently blocked

Klava's signed Gonka-backed `chat/completions` path is currently blocked by a provider-side panic tracked here:

- https://github.com/gonka-ai/gonka/issues/876

The current symptom is that signed `/v1/chat/completions` requests panic on the provider side even after successful onboarding and model selection.

## Why this still matters

Klava is not just a thin chat client. The desktop runtime, guarded terminal flow, approvals, support bundles, and the new multi-step operations layer all remain valuable and testable while the provider-side chat path is blocked.

That means:

- Klava can keep building the local operator surface now;
- Gonka only needs to unblock the provider chat path, not redesign the client architecture;
- once the provider-side panic is fixed, Klava's current integration path can be re-enabled without throwing away the desktop and workflow foundation.
