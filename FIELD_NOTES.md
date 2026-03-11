# Field Notes

This file holds short public notes that are easier to reuse than a full README and less noisy than overt launch copy.

## Field note 01

GitHub's contributor 2FA notice was not traction.

It was a useful forcing function.

If the account is active enough to receive the deadline, the repository should be legible enough to evaluate quickly.

That pushed Klava toward a narrower claim:

- local-first desktop agent
- explicit approvals
- guarded shell work
- durable operations
- task-attached history

Useful links:

- [Field note 01 share page](https://junior2wnw.github.io/klava-bot/field-note-01.html)
- [2FA note asset](./docs/assets/2fa-pressure-test.svg)

## Open intake

Difficult local-machine workflows now have a separate intake surface:

- [Machine Work Index](https://github.com/junior2wnw/machine-work-index)
- [Open a case note](https://github.com/junior2wnw/machine-work-index/issues/new?template=case_note.md)

## Short version

Klava is a local-first desktop agent project for machine work that needs approvals, task history, and a runtime that can act on the actual computer.

Current repo:
- https://github.com/junior2wnw/klava-bot

## Claims that survive inspection

- Klava has a real desktop shell, local runtime, guarded terminal flow, and operations layer in the repo.
- The operations model is typed and tested across `draft`, `running`, `awaiting_approval`, `succeeded`, and `failed`.
- Approval rejection can fail an operation step instead of silently bypassing it.
- The current implementation is narrower than the long-term workflow surface described in the docs.

## Claims to avoid

- Do not say Klava can do everything on a computer today.
- Do not say every planned workflow in `README.md` is already implemented.
- Do not imply the Gonka provider-side chat issue is fixed if it is still unresolved.
- Do not erase the approval model or safety boundary just to make the copy louder.
