# Voice and Multimodal Stack

## Goal

Klava should support world-class voice interaction without turning the desktop product into a fragile demo.

Voice must be:
- fast;
- accurate;
- optional;
- interruptible;
- modular;
- updateable independently from the shell.

## Product Decision

Voice is an add-on subsystem, not a side effect of the chat box.

That means:
- its engines are swappable;
- models are downloadable separately;
- settings and errors are explicit;
- voice identity is controlled through policy and curated packs.

## Recommended Stack

### Input Pipeline

- `Silero VAD` for very fast local voice activity detection.
- `whisper.cpp` as the primary local/native speech-to-text engine for desktop packaging and low-latency use.
- `faster-whisper` as a secondary local engine for higher-accuracy or batch transcription when the device can support it.
- Optional cloud fallback through `gpt-4o-mini-transcribe` or `Realtime`-class voice endpoints when the user enables cloud voice acceleration.

Why this stack:
- it is commercially workable from a licensing standpoint;
- it supports both Windows and macOS paths;
- it allows low-latency local voice without forcing all audio through the cloud.

### Output Pipeline

- `Kokoro-82M` as the primary local high-quality TTS engine.
- Optional cloud fallback or premium mode via `gpt-4o-mini-tts` or realtime audio output.
- local playback controller with queueing, cancellation, ducking, and interruption.

Why this stack:
- Kokoro is open-weight and Apache-licensed;
- it is lightweight enough to package as a downloadable subsystem;
- it supports a curated multi-voice model strategy.

## Modes

Recommended voice modes:
- `push-to-talk`
- `hold-to-talk`
- `continuous voice with VAD`
- optional future `wake phrase`

Launch recommendation:
- ship `push-to-talk` first;
- add continuous mode second;
- keep wake phrase optional until commercial licensing and false-trigger quality are acceptable.

## Wake Phrase Decision

Do not tie product success to always-on wake word on day one.

Reason:
- the current wake-word ecosystem is fragmented;
- some popular options have commercial restrictions or non-commercial pretrained models;
- wake phrase quality is only worth shipping when false positives and packaging cost are controlled.

## Voice Pack System

Voice must be delivered through a formal `Voice Pack Registry`.

Voice pack contents:
- model or adapter reference;
- metadata;
- supported languages;
- style tags;
- sample rate and latency profile;
- checksum;
- signature;
- license and provenance fields.

Voice pack classes:
- `system default`
- `curated synthetic`
- `licensed branded`
- `user-provided custom`
- `enterprise private`

Resolution flow:
1. Klava interprets the user's request.
2. Voice resolver checks installed packs.
3. If no local match exists, resolver checks the curated registry.
4. If still not found, Klava returns a precise error and suggested alternatives.

Important rule:
- search the registry, not the open internet.

## Real-Person Voice Policy

Direct real-person imitation should not be a default consumer feature.

Operational rule:
- Klava should not auto-download or enable an unlicensed pack for a real person.
- If the user requests a real person's voice and no verified licensed pack exists, Klava should refuse cleanly.

Example response:
- "I can't use that voice here."
- "I can switch to a similar installed style or show available voices."

If the company later signs legal rights for licensed voices, those packs can be distributed through the same registry with explicit provenance.

## Error Handling

Voice errors need first-class UX.

Examples:
- microphone unavailable;
- permission denied;
- no speech detected;
- voice pack download failed;
- requested voice not found;
- requested voice blocked by policy;
- audio engine crashed;
- local model missing;
- cloud voice service unavailable.

User-facing response style:
- short plain-language explanation;
- one recovery action when possible;
- one safe fallback when possible.

Examples:
- "Microphone access is off. Turn it on in Settings to use voice."
- "That voice is not available in your installed pack list."
- "I can't use that real-person voice in this setup."

## Performance Targets

Suggested targets on mainstream hardware:
- voice activity detection under 50 ms reaction;
- first transcription tokens under 500 to 900 ms in local fast path;
- first audible speech chunk under 700 to 1200 ms in local TTS fast path;
- stop-speaking interruption that feels immediate.

These are target ranges, not launch guarantees.

## Packaging Strategy

Audio components should be distributed as separate assets:
- base voice runtime;
- STT models;
- TTS models;
- voice packs;
- optional language packs.

Benefits:
- smaller initial installer;
- faster updates;
- easier premium differentiation;
- simpler platform-specific optimization.

## Update Strategy

Voice assets should update independently from:
- the shell;
- the OpenClaw runtime;
- the privileged helper.

Each voice asset should track:
- semantic version;
- compatible runtime range;
- checksum;
- rollback candidate;
- download source;
- license and policy flags.

## Suggested Implementation Order

1. push-to-talk;
2. local VAD;
3. whisper.cpp path;
4. Kokoro local playback;
5. interruption and barge-in;
6. curated voice registry;
7. cloud voice fallback;
8. advanced pack and premium voice distribution.

## Reference Inputs

Primary sources used for this stack:
- `whisper.cpp` official repo: https://github.com/ggml-org/whisper.cpp
- `faster-whisper` official repo: https://github.com/SYSTRAN/faster-whisper
- `Silero VAD` official repo: https://github.com/snakers4/silero-vad
- `Kokoro-82M` official model card: https://huggingface.co/hexgrad/Kokoro-82M
- OpenAI audio docs: https://developers.openai.com/api/docs/guides/audio/quickstart
- OpenAI text-to-speech docs: https://developers.openai.com/api/docs/guides/text-to-speech
