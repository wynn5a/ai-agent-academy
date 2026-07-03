# Animation Controls & Optimization — Design

Date: 2026-07-03
Status: approved (user selected "Hybrid step controller" + all four optimizations)

## Goal

Give the 16 concept animations user controls (replay, next-step where it aids
learning), stop them burning CPU off-screen, respect `prefers-reduced-motion`,
lazy-load their code, and polish pacing — without changing lesson content or
the `ConceptAnimation` public API (`name`, `caption`).

## Classification

**Step-driven (8)** — controls: ⏮ prev · ▶/⏸ play-pause · ⏭ next · ↺ replay · "n/N" indicator

| name | steps |
| --- | --- |
| tool-calling | 4 (one per message) |
| mcp-handshake | 6 (one per message) |
| react-pattern | 5 (one per trace row) |
| context-window | 6 (5 segments fill + compaction) |
| chunking | 3 (one per strategy) |
| workflow-patterns | 5 (one per pattern) |
| capstone-pipeline | 7 (6 stages + retry loop) |
| injection-attack | 3 (injection → defense → outcomes) |

**Continuous loops (8)** — controls: ▶/⏸ · ↺

agent-loop, token-stream, temperature, embedding-space, rag-pipeline,
memory-types, multi-agent, eval-loop.

## Architecture

### `components/animations/controller.tsx` (new)

- `AnimPlaybackContext` — `{ playing: boolean, step: number }`. `playing` is the
  *effective* playing state (user intent AND in-view AND not reduced-motion-idle).
- `useAnimPlayback()` — hook consumed by animation components.
- `ControlBar` — button row rendered in the figure footer next to the caption.
  Step anims get prev/play-pause/next/replay + step indicator; loop anims get
  play-pause/replay. Buttons are accessible (`aria-label`, focus ring).

### `components/animations/ConceptAnimation.tsx` (rewritten shell)

- Registry entries become `{ load, steps?, aspect }`:
  - `load` — `next/dynamic` lazy import per animation (code-splits Framer
    Motion SVG code out of pages that don't render it).
  - `steps` — present ⇒ step-driven; absent ⇒ continuous loop.
  - `aspect` — viewBox ratio for a zero-layout-shift loading placeholder.
- State: `playing` (user intent), `step`, `runId` (remount key — replay
  increments it, resetting step to 0 and restarting all motion).
- Auto-advance: when step-driven and effectively playing, advance `step` every
  ~2s. **Play-once:** on reaching the final step the run ends and stays frozen
  until the user presses play (which restarts from step 0) or replay. Loop
  animations end after one full pass (`cycleMs` per registry entry) the same
  way. The ended state survives scrolling away and back — no auto-restart.
- ⏮/⏭ set `step` directly and pause auto-play (standard media UX).
- IntersectionObserver on the `<figure>`: out of view ⇒ effective playing
  false. Uses same mechanism as pause; no separate code path in animations.
- `prefers-reduced-motion` (framer `useReducedMotion`): initial `playing` is
  false and the static pose / final step renders; manual stepping and explicit
  play still work.

### Animation components

- **Step anims** re-render as a function of `step`: rows/messages reveal
  cumulatively (`i <= step` visible), current step at full opacity, earlier
  steps dimmed (~0.45 opacity). Short finite enter transitions only — no
  self-scheduled infinite keyframe cycles. This replaces today's
  "everything fades out and restarts" loop.
- **Loop anims** read `playing`; when false each renders a designed static
  pose (full diagram, pulses parked at a sensible position). Implemented by
  switching the `animate`/`transition` props — no mid-flight freeze hacks.
- `primitives.tsx`: `FlowEdge` pauses its CSS dash animation via
  `animation-play-state: paused` when not playing; add a small `StepReveal`
  helper (`<g>` that reveals at step *i* and dims when passed) to cut
  duplication across the 8 step anims.

## Pacing polish

- Step reveals ~0.35s ease-out; auto-advance ~2s/step so text is readable
  (today several messages flash by too fast).
- Loop anims keep roughly their current cycle lengths; switch mechanical
  `linear` easings to `easeInOut` where motion represents discrete hops.

## Out of scope

- No changes to animation visual content/layout beyond pacing.
- No content-data or lesson-page changes; `ConceptAnimation` props unchanged.
- No new dependencies.

## Testing

- `pnpm lint` and `pnpm build` pass.
- Manual verification in `pnpm dev`: step controls walk each step anim; replay
  restarts loops; scrolling an animation off-screen stops it (devtools
  performance check); emulated `prefers-reduced-motion` starts paused.
