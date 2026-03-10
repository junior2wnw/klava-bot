# Security Policy

## Supported surface

Security-sensitive areas in Klava include:

- desktop shell / preload boundary;
- local runtime and tool execution;
- secret storage and onboarding;
- provider signing and auth flows;
- terminal approval model;
- update and packaging paths;
- any future privileged helper or system-repair workflows.

## How to report a vulnerability

For security issues, please do **not** open a public GitHub issue first if the report could put users at risk.

Preferred path:

1. Use GitHub's private vulnerability reporting / security advisory flow if available.
2. If that is not available, contact the maintainer through GitHub at `@junior2wnw` and ask for a private reporting channel.

For non-sensitive bugs, normal public issues are fine.

## What makes a good security report

Please include:

- affected component;
- exact steps to reproduce;
- impact;
- whether the issue requires local access, prior compromise, or user interaction;
- minimal proof of concept if possible;
- any suggested fix direction if you have one.

## Response goals

Target response goals:

- initial acknowledgment within `72 hours`;
- triage and severity assessment after reproduction;
- fix, mitigation, or public status update once the issue is understood.

These are goals, not guarantees.

## Disclosure expectations

Please avoid public disclosure of sensitive issues until:

- the issue is reproduced;
- maintainers have had a reasonable chance to patch or mitigate it;
- a coordinated disclosure date is agreed if needed.

## Out of scope

The following are generally not treated as security bugs by themselves:

- provider-side outages in third-party services;
- bugs that require an already fully compromised machine with local admin;
- issues that depend entirely on intentionally disabled local guards;
- purely cosmetic UI bugs without privilege, data, or integrity impact.
