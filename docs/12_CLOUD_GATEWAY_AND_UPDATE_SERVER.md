# Cloud Gateway and Update Server

## Goal

Hosted services should expand the product, not complicate the local-first core.

Default rule:
- local-first remains the primary product shape;
- `BYOK` remains the default mode;
- `Klava Cloud` is an optional hosted layer added after the core product is strong.

## Core Decision

When `Klava Cloud` exists:
- the desktop app should use one Klava-issued key;
- upstream provider keys must stay on the backend;
- the client should receive only scoped tokens, results, and safe metadata.

## Simplest Viable Hosted Architecture

Start with one backend service plus artifact storage.

Early hosted stack:
- one API service for auth, provider proxy, and manifests;
- one database;
- object storage for artifacts and packs;
- optional CDN later.

Rule:
- start simple;
- split services only when scale or reliability requires it.

## Hosted Responsibilities

The hosted layer may own:
- Klava key auth;
- provider proxying;
- usage limits;
- signed update manifests;
- optional voice pack delivery.

The hosted layer should not own:
- the local product core;
- features that are already solved well in local mode;
- unnecessary complexity before real usage exists.

## Update Server Model

The update system should stay simple at first:
- signed manifest;
- artifact URLs;
- version and checksum;
- channel;
- rollback target.

This is enough for:
- shell updates;
- runtime updates;
- optional module asset updates.

## Offline and Hybrid Modes

The product should support:
- fully local mode;
- hybrid mode with local runtime and cloud providers;
- optional `Klava Cloud` mode.

Rule:
- hosted mode must not break the local-first product.

## Abuse and Cost Controls

If hosted mode is enabled, the minimum controls are:
- rate limiting;
- per-user quotas;
- per-device quotas;
- token revocation;
- basic anomaly detection.

## Delivery Order

1. finish the local-first product;
2. add signed update manifests;
3. add a small hosted gateway prototype;
4. add one-key onboarding if the hosted path proves useful;
5. expand only after real usage justifies it.

## Practical Rule

The cloud plan is correct when:
- the local product is still complete without it;
- the backend starts small;
- provider secrets never reach clients;
- hosted services remain easier to operate than the value they add.
