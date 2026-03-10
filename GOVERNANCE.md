# Governance

Klava is currently maintained under a maintainer-led model.

That means:

- broad technical discussion is welcome;
- maintainers make merge and release decisions;
- architecture changes should optimize for coherence, not committee consensus.

## Project priorities

Maintainers should protect these priorities:

1. keep the codebase legible
2. keep the security model explicit
3. keep the OpenClaw-derived boundary understandable
4. keep the product useful as a real desktop executable

## How decisions should be made

For normal changes:

- open an issue or PR
- explain the user problem
- explain the chosen tradeoff
- keep the blast radius small

For large changes:

- write a short design note first
- describe affected boundaries
- explain what gets simpler and what gets riskier
- define rollback or rejection criteria

## Maintainer bar

Maintainers should prefer:

- narrow diffs
- clear reasoning
- explicit safety notes
- honest communication about shipped vs planned behavior

Maintainers should reject:

- vague product claims with no technical basis
- giant rewrites without a strong boundary argument
- features that weaken approvals, secret handling, or auditability

## Contribution path

The most valuable contributions are usually:

- bug fixes with exact reproduction
- safety hardening
- typed workflow design
- runtime reliability work
- UX improvements that reduce ambiguity in approvals or diagnostics

## Future direction

If the contributor base grows, Klava can adopt:

- more formal maintainership roles
- working groups for runtime / desktop / security
- release shepherd rotation

For now, the right model is simple:

- keep quality high
- keep boundaries clear
- move fast only where the reasoning is sound
