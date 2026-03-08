# Cloud Gateway and Update Server

## Goal

Klava should support two clean access modes:
- `BYOK`: the user brings a provider key;
- `Klava Cloud`: the user enters one Klava-issued key and everything else is brokered by the Klava backend.

This is the right long-term commercial model because it makes onboarding simpler and gives the product team control over routing, billing, quotas, safety, and updates.

## Core Decision

The desktop app should never need direct access to your upstream provider secrets in Klava Cloud mode.

Instead:
- the desktop app authenticates with a Klava key;
- the Klava backend issues short-lived device/session tokens;
- the backend calls OpenAI and other providers on the user's behalf;
- the desktop app receives only results, quotas, and policy-safe metadata.

## Core Services

### 1. Identity and Access Service

Responsibilities:
- validate Klava keys;
- bind device sessions;
- issue short-lived tokens;
- revoke compromised devices;
- support free, paid, internal, and enterprise plans later.

### 2. Model Gateway

Responsibilities:
- receive normalized requests from Klava clients;
- route to upstream providers;
- apply policy, cost, and latency rules;
- support provider fallback and A/B rollout;
- record metering and failures.

### 3. Voice Pack Registry

Responsibilities:
- serve signed pack manifests;
- host downloadable voice assets;
- expose catalog metadata to clients;
- enforce license and policy flags.

### 4. Update Manifest Service

Responsibilities:
- publish signed manifests for shell, runtime, helper, and voice assets;
- provide channel-specific release feeds;
- support staged rollout percentages;
- support revocation and kill-switch behavior.

### 5. Usage and Billing Service

Responsibilities:
- meter requests, audio usage, and storage usage;
- enforce quotas;
- support future billing and subscription logic;
- expose user-facing usage summaries to the app.

## Request Flow

Typical Klava Cloud request flow:
1. User installs Klava and enters one Klava key.
2. Desktop app authenticates to Klava Cloud.
3. Klava Cloud issues a scoped device token.
4. User sends a text or voice request.
5. Desktop app calls Klava Model Gateway.
6. Gateway routes to the chosen upstream provider.
7. Gateway returns normalized output to the desktop app.
8. Usage is metered server-side.

## Why One Klava Key Matters

Benefits:
- simpler onboarding;
- simpler support;
- easier pricing later;
- provider abstraction;
- safer secret management;
- easier feature gating by plan.

Tradeoff:
- the backend becomes a real production service and must be treated like one.

## Backend Requirements

Security:
- upstream provider keys never reach clients;
- client tokens are short-lived and revocable;
- rate limiting and anomaly detection are mandatory;
- audit trails exist for sensitive flows.

Reliability:
- requests should degrade gracefully when a provider is degraded;
- the gateway should support retries and circuit breakers;
- update infrastructure needs rollback and manifest revocation.

Scalability:
- design the gateway stateless where possible;
- put large assets behind object storage and CDN;
- keep model routing, auth, and manifests independently deployable.

## Update Server Strategy

You said the update server will be purchased later. That is fine.

The documentation should still assume this final shape:
- object storage for artifacts;
- CDN for downloads;
- signed manifest service;
- release channel policy;
- telemetry to detect bad rollouts;
- emergency blocklist or rollback.

Artifacts to distribute:
- desktop shell bundles;
- runtime bundles;
- privileged helper packages;
- STT model packs;
- TTS model packs;
- voice packs;
- optional plugin packs.

## Pack and Artifact Signing

Every downloadable asset should include:
- version;
- checksum;
- size;
- compatible runtime range;
- release channel;
- signature;
- rollback info;
- policy flags.

This applies to voice packs as much as to application binaries.

## Offline and Hybrid Modes

The product should support:
- fully local mode where possible;
- hybrid mode with local runtime and cloud providers;
- Klava Cloud mode with one key;
- future enterprise private gateway mode.

This is strategically important because:
- some users will prioritize privacy;
- some will prioritize simplicity;
- enterprise customers will ask for deployment flexibility.

## Abuse and Cost Controls

Mandatory controls for Klava Cloud:
- per-user quotas;
- per-device quotas;
- rate limiting;
- request size limits;
- audio duration limits;
- pack download throttling;
- anomaly detection for automation abuse.

## Data Model

Suggested server-side entities:
- `account`
- `plan`
- `device`
- `session_token`
- `provider_route`
- `usage_meter`
- `voice_pack_manifest`
- `release_manifest`
- `artifact`
- `policy_profile`

## Delivery Order

1. local-first product;
2. internal Klava gateway prototype;
3. one-key onboarding;
4. signed update manifests;
5. voice pack registry;
6. usage metering and quotas;
7. public hosted rollout.

## Reference Inputs

Primary sources used for the cloud and update direction:
- OpenAI audio quickstart: https://developers.openai.com/api/docs/guides/audio/quickstart
- OpenAI realtime capabilities: https://platform.openai.com/docs/guides/realtime-model-capabilities
- OpenAI text-to-speech guide: https://developers.openai.com/api/docs/guides/text-to-speech
- OpenAI model list and changelog: https://developers.openai.com/api/docs/models and https://platform.openai.com/docs/changelog
