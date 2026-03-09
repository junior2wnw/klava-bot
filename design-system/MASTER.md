# Klava Design System Master

This is the global UI source of truth for Klava.

Any AI or developer touching the UI should read this file before editing visual code.

## Product UI Principles

- Few elements, excellent behavior
- Calm by default
- Light-first
- Strong hierarchy
- Minimal chrome
- Fast readability

## Layout Rules

- Permanent regions are limited to `Task Rail`, `Main Surface`, and `Context Pane`
- Avoid adding new permanent layout zones
- Use whitespace for clarity, not emptiness

## Typography

- display and body family: `"IBM Plex Sans", "Segoe UI", sans-serif`
- mono family: `"IBM Plex Mono", Consolas, monospace`
- page title: `44/44`, weight `700`, tight line-height
- section title: `16/20`, weight `600`
- body: `14/20`, weight `400`
- eyebrow labels: `12/16`, uppercase, `700`, tracking `0.12em`
- mono is reserved for terminal output, commands, artifact paths, and approval payloads

## Spacing

- base unit: `4px`
- shell padding: `24px desktop`, `16px mobile`
- region gap: `18px`
- card padding: `16px`
- compact card padding: `12px`
- control heights: `34px compact`, `42px default`
- content stacks prefer `10px`, `12px`, `14px`, `16px`; avoid arbitrary values

## Color

- accent: `#0f766e`
- accent strong: `#115e59`
- accent soft: `#ccfbf1`
- page background: `#f4f2eb`
- main surface: `#fbfaf6`
- muted surface: `#f0ede4`
- border: `#d8d1c2`
- text: `#1f1f1a`
- text muted: `#676254`
- success: `#1c7c54`
- warning: `#9a5a00`
- error: `#a43a2a`
- focus ring: `#1d4ed8`
- terminal canvas: `#141412`

## Motion

- hover/focus duration: `140ms`
- default surface transition: `220ms`
- easing: `ease` or `ease-out`; avoid springy motion in the core shell
- no decorative looping animation
- reduced motion must remove background blur movement and non-essential transforms

## Components

- buttons:
  - primary uses accent fill with white text
  - secondary uses muted surface with border
  - ghost is text-first and only for low-emphasis actions
- inputs:
  - off-white fill, rounded `12px`, visible border
  - multiline composer uses the same field styling, never a custom pattern
- chips/status pills:
  - fully rounded
  - bold `12px`
  - use semantic fills, not outlined tags
- cards and panes:
  - radius `18px` or `28px` for main shell regions
  - soft shadow only, no thick borders
- task items:
  - selected task gets accent border and warmer background
  - metadata stays on one quiet row
- approval cards:
  - explicit command in mono
  - impact text in plain language
  - approve and reject actions aligned to the right
- terminal output:
  - dark mono panel inside a light shell
  - output is scrollable and clearly separated from controls

## Anti-Patterns

Do not introduce:
- noisy dashboards
- decorative gradients by default
- excessive borders
- unclear primary actions
- inconsistent spacing
- one-off components that duplicate an existing pattern

## Page Override Rule

Global rules live here.
Only deviations belong in `design-system/pages/*.md`.
