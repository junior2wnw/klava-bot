# Voice and Multimodal Stack

## Goal

Voice should add power without becoming part of the core product complexity.

Default rule:
- `OpenClaw` remains the core runtime;
- voice is an optional module;
- the product must stay strong even when voice is disabled.

## Product Decision

Voice is not a launch dependency.
Voice is a modular capability pack.

That means:
- installable separately;
- removable separately;
- testable separately;
- updateable separately.

## Simple Recommended Stack

### Input

- `Silero VAD`
- `whisper.cpp`
- optional `faster-whisper` fallback for stronger hardware

### Output

- `Kokoro-82M`
- local playback controller
- optional cloud fallback later

Rule:
- start with the smallest stack that gives good local quality.

## Supported Modes

Ship in this order:
1. `push-to-talk`
2. optional `hold-to-talk`
3. optional continuous mode

Rule:
- do not make wake phrase a launch goal.

## Voice Pack Model

Voice packs should remain optional downloadable assets.

Each pack should define:
- id;
- version;
- checksum;
- supported languages;
- style tags;
- license and provenance.

Rule:
- if a requested pack is unavailable, Klava should fail clearly and offer a safe fallback.

## Real-Person Voice Policy

Default policy:
- no unlicensed real-person imitation;
- no auto-download from the open internet;
- no unclear provenance.

If a requested voice is not allowed, Klava should:
- refuse clearly;
- offer installed alternatives.

## Error UX

Voice errors must stay simple:
- microphone unavailable;
- permission denied;
- no speech detected;
- local model missing;
- requested voice unavailable;
- playback failed.

User-facing rule:
- short explanation;
- one recovery action;
- one safe fallback when possible.

## Packaging and Updates

Voice assets should update independently from:
- the shell;
- the `OpenClaw` runtime;
- the optional helper.

Reason:
- smaller installer;
- cheaper updates;
- easier rollback;
- easier premium or optional distribution later.

## Implementation Order

1. keep current voice abstraction;
2. replace browser voice with local STT/TTS module;
3. add push-to-talk polish;
4. add interruption;
5. add optional voice packs;
6. add optional cloud fallback only if needed.

## Practical Rule

The voice plan is correct when:
- voice is high quality;
- voice is optional;
- voice does not complicate the core architecture;
- a medium-level programmer can work on it in isolation.
