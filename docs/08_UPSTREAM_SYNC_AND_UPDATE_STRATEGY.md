# Upstream Sync and Update Strategy

## Goal

Klava must stay easy to improve when OpenClaw improves.

This requires discipline:
- keep the fork narrow;
- isolate product code outside the fork;
- automate sync validation;
- separate user updates into shell and runtime tracks.

## Fork Policy

OpenClaw fork changes should be limited to:
- embedding hooks;
- API normalization hooks;
- capability and policy extension points;
- bug fixes that are either upstreamable or clearly documented.

OpenClaw fork changes should not become the home for:
- most desktop UX features;
- secret vault logic;
- privileged helper logic;
- platform installers;
- product analytics and release management.

## Branch Strategy

Recommended branches:
- `vendor/openclaw-main`: direct mirror of upstream;
- `integration/openclaw`: Klava-tested integration branch;
- `main`: product branch using the integration branch output.

Sync rhythm:
- weekly fetch and compatibility check;
- immediate review for security-critical upstream changes;
- planned merge windows for major upstream releases.

## Patch Budget

Use a visible patch budget:
- track the number of files changed in the fork;
- track patch categories;
- track what is upstreamable;
- treat growing patch surface as a product risk.

Rule of thumb:
- product velocity should come mainly from wrappers, packages, and shell work, not from deep vendor modifications.

## Compatibility Contract

Klava should define its own internal compatibility contract around:
- task/session model;
- event stream schema;
- approval schema;
- capability schema;
- integration setup hooks;
- health and version endpoints.

This contract acts as the buffer between:
- the shell and updater;
- the runtime and fork;
- current and future platform adapters.

## Upstream Sync Process

Suggested workflow:
1. mirror the latest upstream into `vendor/openclaw-main`;
2. rebase or merge the Klava integration branch;
3. run fork regression tests;
4. run shell/runtime compatibility tests;
5. inspect changed upstream areas affecting providers, channels, queueing, or security;
6. update compatibility notes and release decision.

## Upstream Contribution Strategy

When a Klava fork patch is generic and useful:
- prefer upstream contribution;
- keep a short list of candidate patches;
- remove local divergence when upstream accepts the change.

This reduces long-term maintenance cost.

## Product Update Model

Klava should ship at least two independently versioned artifacts:
- `Desktop Shell`
- `Runtime Bundle`

Optional third artifact:
- `Privileged Helper`

Why:
- UI fixes should not always require runtime replacement;
- runtime and provider fixes should ship without forcing a full shell reinstall;
- privileged component changes may need separate signing and rollout caution.

## Update Channels

Recommended channels:
- `stable`
- `beta`
- `canary/internal`

Each artifact should record:
- installed version;
- available version;
- channel;
- migration state;
- last update result;
- rollback eligibility.

## Update UX

The user experience should feel simple:
- background download;
- clear summary of what changed;
- safe restart prompt only when needed;
- no exposure to fork complexity.

Advanced users may see:
- shell version;
- runtime version;
- OpenClaw base version;
- helper version;
- update channel.

## Rollback Strategy

Shell rollback:
- preserve prior bundle for one-step restore when feasible.

Runtime rollback:
- preserve prior runtime package and data migration compatibility rules.

Privileged helper rollback:
- require strict signing and staged rollout;
- keep prior compatible helper where possible.

## Release Cadence

Suggested cadence:
- shell UX releases: frequent;
- runtime and provider releases: regular and tested;
- upstream sync releases: batched unless urgent;
- privileged helper releases: slower and more conservative.

## Quality Gates for Upstream Adoption

- no breaking mismatch in local control API;
- task/session persistence remains valid;
- key integrations still pass smoke tests;
- restricted workflow assumptions remain correct;
- security-impacting changes reviewed before user rollout.

## Practical Rule

If a desired feature can be built in:
- `shell`
- `action-engine`
- `control-api`
- `integration wrapper`

then do not patch the fork unless there is a strong technical reason.
