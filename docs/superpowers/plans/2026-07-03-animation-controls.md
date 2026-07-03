# Animation Controls & Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hybrid playback controller (replay + play/pause everywhere; prev/next stepping on the 8 step-sequenced animations) to all 16 concept animations, pause them off-screen, respect `prefers-reduced-motion`, lazy-load their code, and polish pacing.

**Architecture:** A new `AnimPlaybackContext` carries `{ playing, step }` from a rewritten `ConceptAnimation` shell (which owns state, IntersectionObserver, reduced-motion detection, auto-advance timer, and the control bar) down into each animation. Step animations become pure functions of `step`; loop animations switch between keyframe loops and a designed static pose based on `playing`. The registry lazy-loads each animation with `next/dynamic` and records `steps` + viewBox aspect for zero-layout-shift placeholders.

**Tech Stack:** Next.js 16 (App Router), React 19, framer-motion, Tailwind v4. No new dependencies.

## Global Constraints

- `ConceptAnimation` public API unchanged: `{ name: AnimationName; caption?: string }`.
- No content-data (`content/`) or lesson-page changes.
- `components/animations/ConceptAnimation.tsx` and `controller.tsx` must NOT import `framer-motion` (would defeat lazy loading). Reduced-motion detection uses `matchMedia` via `useSyncExternalStore`.
- No `setState` calls directly in effect bodies (strict `react-hooks` lint config) — use `useSyncExternalStore`, derived values, or async callbacks (timers/observers are fine).
- Verification per task: `pnpm lint` and `pnpm build` pass.
- Step counts (registry literals must match animation row counts): tool-calling 4, mcp-handshake 6, react-pattern 5, context-window 6, chunking 3, workflow-patterns 5, capstone-pipeline 7, injection-attack 3.

---

### Task 1: Playback context + control bar (`controller.tsx`) and primitives update

**Files:**

- Create: `components/animations/controller.tsx`
- Modify: `components/animations/primitives.tsx`

**Interfaces:**

- Produces: `useAnimPlayback(): { playing: boolean; step: number }`, `AnimPlaybackProvider`, `ControlBar` (props below), `StepReveal` (props: `index: number; dim?: number; children`), `FlowEdge` (unchanged props, now pause-aware).

- [ ] **Step 1: Write `components/animations/controller.tsx`**

```tsx
"use client";

import React, { createContext, useContext } from "react";

export type AnimPlayback = {
  /** effective playing state: user intent AND in-view */
  playing: boolean;
  /** current step for step-driven animations; 0 for loop animations */
  step: number;
};

const AnimPlaybackContext = createContext<AnimPlayback>({
  playing: true,
  step: 0,
});

export function AnimPlaybackProvider({
  value,
  children,
}: {
  value: AnimPlayback;
  children: React.ReactNode;
}) {
  return (
    <AnimPlaybackContext.Provider value={value}>
      {children}
    </AnimPlaybackContext.Provider>
  );
}

export function useAnimPlayback(): AnimPlayback {
  return useContext(AnimPlaybackContext);
}

function CtrlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="focus-visible:ring-accent/60 grid h-7 w-7 place-items-center rounded-md text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 focus-visible:ring-2 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

export function ControlBar({
  playing,
  step,
  stepCount,
  onToggle,
  onReplay,
  onStep,
}: {
  playing: boolean;
  step: number;
  stepCount?: number;
  onToggle: () => void;
  onReplay: () => void;
  onStep?: (dir: 1 | -1) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {stepCount && onStep ? (
        <>
          <CtrlButton label="Previous step" onClick={() => onStep(-1)}>
            ⏮
          </CtrlButton>
          <CtrlButton label={playing ? "Pause" : "Play"} onClick={onToggle}>
            {playing ? "⏸" : "▶"}
          </CtrlButton>
          <CtrlButton label="Next step" onClick={() => onStep(1)}>
            ⏭
          </CtrlButton>
          <CtrlButton label="Replay" onClick={onReplay}>
            ↺
          </CtrlButton>
          <span className="ml-1 font-mono text-[10px] text-slate-500 tabular-nums">
            {step + 1}/{stepCount}
          </span>
        </>
      ) : (
        <>
          <CtrlButton label={playing ? "Pause" : "Play"} onClick={onToggle}>
            {playing ? "⏸" : "▶"}
          </CtrlButton>
          <CtrlButton label="Replay" onClick={onReplay}>
            ↺
          </CtrlButton>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `components/animations/primitives.tsx`**

`FlowEdge` pauses its CSS dash animation when not playing; add `StepReveal` (cumulative reveal, current step bright, past steps dimmed). `primitives.tsx` MAY import framer-motion (it is only imported by the lazily loaded animation files).

```tsx
// added imports at top
import { motion } from "framer-motion";
import { useAnimPlayback } from "./controller";

// FlowEdge body becomes:
export function FlowEdge({
  d,
  color = "#38bdf8",
}: {
  d: string;
  color?: string;
}) {
  const { playing } = useAnimPlayback();
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeOpacity={0.5}
      strokeWidth={1.5}
      strokeDasharray="6 10"
      className="animate-flow-dash"
      style={{ animationPlayState: playing ? "running" : "paused" }}
    />
  );
}

// new helper:
export function StepReveal({
  index,
  dim = 0.45,
  children,
}: {
  index: number;
  dim?: number;
  children: React.ReactNode;
}) {
  const { step } = useAnimPlayback();
  const shown = index <= step;
  const current = index === step;
  return (
    <motion.g
      initial={false}
      animate={{ opacity: shown ? (current ? 1 : dim) : 0, x: shown ? 0 : -10 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.g>
  );
}
```

- [ ] **Step 3: Verify** — Run: `pnpm lint` → passes (build deferred until shell exists).

- [ ] **Step 4: Commit** — `git add components/animations && git commit -m "feat: animation playback context, control bar, step-reveal primitive"`

---

### Task 2: Rewrite `ConceptAnimation.tsx` shell

**Files:**

- Modify: `components/animations/ConceptAnimation.tsx` (full rewrite)

**Interfaces:**

- Consumes: `AnimPlaybackProvider`, `ControlBar` from Task 1.
- Produces: same default export `ConceptAnimation({ name, caption })`.

- [ ] **Step 1: Rewrite the shell.** Registry maps each name to `{ Component: dynamic(...), w, h, steps?, stepMs? }`. State: `userIntent` (`"play" | "pause" | null`), `step`, `runId`. Effective `playing = wantsPlay && inView`. Reduced motion via `useSyncExternalStore` on `matchMedia("(prefers-reduced-motion: reduce)")`; before any user interaction, `wantsPlay = !reduced` and step anims _display_ their final step (derived `shownStep`, no state write). Auto-advance via `setTimeout` chain (~2.2s/step, 1.8× hold on the last step, wraps to 0). Prev/next pause auto-play and wrap. Replay bumps `runId` (remount key), resets step to 0, sets intent to play. IntersectionObserver (threshold 0.2) drives `inView`. Figure wraps the animation in an `aspect-ratio` box sized from the viewBox so lazy loading causes no layout shift. Footer row always renders: caption (left, flex-1) + `ControlBar` (right).

```tsx
"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import type { AnimationName } from "@/lib/types";
import { AnimPlaybackProvider, ControlBar } from "./controller";

type Entry = {
  Component: React.ComponentType;
  w: number; // viewBox width
  h: number; // viewBox height
  steps?: number; // present => step-driven
  stepMs?: number; // auto-advance override
};

const REGISTRY: Record<AnimationName, Entry> = {
  "agent-loop": {
    Component: dynamic(() =>
      import("./FoundationAnims").then((m) => m.AgentLoopAnim),
    ),
    w: 640,
    h: 300,
  },
  "token-stream": {
    Component: dynamic(() =>
      import("./FoundationAnims").then((m) => m.TokenStreamAnim),
    ),
    w: 640,
    h: 200,
  },
  temperature: {
    Component: dynamic(() =>
      import("./FoundationAnims").then((m) => m.TemperatureAnim),
    ),
    w: 640,
    h: 260,
  },
  "context-window": {
    Component: dynamic(() =>
      import("./FoundationAnims").then((m) => m.ContextWindowAnim),
    ),
    w: 640,
    h: 220,
    steps: 6,
  },
  "tool-calling": {
    Component: dynamic(() =>
      import("./FoundationAnims").then((m) => m.ToolCallingAnim),
    ),
    w: 640,
    h: 230,
    steps: 4,
  },
  "react-pattern": {
    Component: dynamic(() =>
      import("./FoundationAnims").then((m) => m.ReactPatternAnim),
    ),
    w: 640,
    h: 240,
    steps: 5,
  },
  "rag-pipeline": {
    Component: dynamic(() =>
      import("./KnowledgeAnims").then((m) => m.RagPipelineAnim),
    ),
    w: 660,
    h: 300,
  },
  "embedding-space": {
    Component: dynamic(() =>
      import("./KnowledgeAnims").then((m) => m.EmbeddingSpaceAnim),
    ),
    w: 640,
    h: 240,
  },
  chunking: {
    Component: dynamic(() =>
      import("./KnowledgeAnims").then((m) => m.ChunkingAnim),
    ),
    w: 640,
    h: 230,
    steps: 3,
    stepMs: 2600,
  },
  "memory-types": {
    Component: dynamic(() =>
      import("./KnowledgeAnims").then((m) => m.MemoryTypesAnim),
    ),
    w: 640,
    h: 240,
  },
  "multi-agent": {
    Component: dynamic(() =>
      import("./ScaleAnims").then((m) => m.MultiAgentAnim),
    ),
    w: 640,
    h: 260,
  },
  "workflow-patterns": {
    Component: dynamic(() =>
      import("./ScaleAnims").then((m) => m.WorkflowPatternsAnim),
    ),
    w: 640,
    h: 200,
  },
  "mcp-handshake": {
    Component: dynamic(() =>
      import("./ScaleAnims").then((m) => m.McpHandshakeAnim),
    ),
    w: 640,
    h: 300,
    steps: 6,
  },
  "eval-loop": {
    Component: dynamic(() => import("./ProdAnims").then((m) => m.EvalLoopAnim)),
    w: 640,
    h: 260,
  },
  "injection-attack": {
    Component: dynamic(() =>
      import("./ProdAnims").then((m) => m.InjectionAttackAnim),
    ),
    w: 640,
    h: 270,
    steps: 3,
    stepMs: 2800,
  },
  "capstone-pipeline": {
    Component: dynamic(() =>
      import("./ProdAnims").then((m) => m.CapstonePipelineAnim),
    ),
    w: 660,
    h: 190,
    steps: 7,
    stepMs: 1600,
  },
};

function useReducedMotionPref() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export default function ConceptAnimation({
  name,
  caption,
}: {
  name: AnimationName;
  caption?: string;
}) {
  const entry = REGISTRY[name];
  const reduced = useReducedMotionPref();
  const [userIntent, setUserIntent] = useState<"play" | "pause" | null>(null);
  const [step, setStep] = useState(0);
  const [runId, setRunId] = useState(0);
  const [inView, setInView] = useState(false);
  const figRef = useRef<HTMLElement>(null);

  const steps = entry?.steps;
  const wantsPlay = userIntent ? userIntent === "play" : !reduced;
  const playing = wantsPlay && inView;
  // reduced-motion users see the completed diagram until they interact
  const shownStep = steps && reduced && userIntent === null ? steps - 1 : step;

  useEffect(() => {
    const el = figRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      threshold: 0.2,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!steps || !playing) return;
    const ms = entry.stepMs ?? 2200;
    const hold = step === steps - 1 ? ms * 1.8 : ms;
    const id = setTimeout(() => setStep((s) => (s + 1) % steps), hold);
    return () => clearTimeout(id);
  }, [steps, playing, step, entry.stepMs]);

  if (!entry) return null;
  const { Component } = entry;

  const handleStep = (dir: 1 | -1) => {
    if (!steps) return;
    setUserIntent("pause");
    setStep((shownStep + dir + steps) % steps);
  };
  const handleReplay = () => {
    setStep(0);
    setUserIntent("play");
    setRunId((r) => r + 1);
  };

  return (
    <figure
      ref={figRef}
      className="border-border my-8 overflow-hidden rounded-xl border bg-[#0d1220]"
    >
      <div className="px-4 pt-4">
        <div
          className="mx-auto w-full max-w-2xl"
          style={{ aspectRatio: `${entry.w} / ${entry.h}` }}
        >
          <AnimPlaybackProvider value={{ playing, step: shownStep }}>
            <Component key={runId} />
          </AnimPlaybackProvider>
        </div>
      </div>
      <figcaption className="border-border/60 flex items-center gap-3 border-t px-4 py-1.5">
        <span className="flex-1 text-left text-xs text-slate-500">
          {caption}
        </span>
        <ControlBar
          playing={playing}
          step={shownStep}
          stepCount={steps}
          onToggle={() => setUserIntent(wantsPlay ? "pause" : "play")}
          onReplay={handleReplay}
          onStep={steps ? handleStep : undefined}
        />
      </figcaption>
    </figure>
  );
}
```

Note: the early `if (!entry) return null` must come AFTER all hooks (hooks rules) — guard hook bodies with optional chaining as shown.

- [ ] **Step 2: Verify** — Run: `pnpm lint && pnpm build` → both pass (animations still self-loop; controls affect FlowEdge only so far).

- [ ] **Step 3: Commit** — `git commit -m "feat: ConceptAnimation shell with playback controls, lazy loading, off-screen pause, reduced-motion"`

---

### Task 3: Convert `FoundationAnims.tsx`

**Files:**

- Modify: `components/animations/FoundationAnims.tsx`

**Interfaces:**

- Consumes: `useAnimPlayback` from controller, `StepReveal` from primitives.

Conversions (registry steps: tool-calling 4, react-pattern 5, context-window 6):

- [ ] **Step 1: `ToolCallingAnim` (step, 4)** — delete the per-message infinite opacity keyframes; wrap each message `<g>` (line + text) in `<StepReveal index={i}>`. Pattern (identical for McpHandshakeAnim in Task 5):

```tsx
{
  TC_STEPS.map((s, i) => {
    const ltr = s.from === "app";
    return (
      <StepReveal key={i} index={i}>
        <line
          x1={ltr ? 90 : 550}
          y1={s.y}
          x2={ltr ? 550 : 90}
          y2={s.y}
          stroke={ltr ? "#38bdf8" : "#a78bfa"}
          strokeOpacity={0.55}
          strokeWidth={1.2}
          markerEnd="url(#arr)"
        />
        <text
          x={320}
          y={s.y - 7}
          textAnchor="middle"
          fill={ltr ? "#7dd3fc" : "#c4b5fd"}
          fontSize={10}
          fontFamily="monospace"
        >
          {s.text}
        </text>
      </StepReveal>
    );
  });
}
```

- [ ] **Step 2: `ReactPatternAnim` (step, 5)** — same treatment: each trace row wrapped in `<StepReveal index={i}>`; remove `CYCLE` math and infinite keyframes.

- [ ] **Step 3: `ContextWindowAnim` (step, 6)** — steps 0–4 reveal the five segments (`<StepReveal index={i} dim={1}>` so filled segments stay bright; keep the inner width-grow `motion.rect` but make it fire per reveal: `animate={{ width: i <= step ? s.w - 4 : 0 }}` via `useAnimPlayback()` in the component, `transition={{ duration: 0.45 }}`, drop `initial`/`delay`). Step 5 reveals the compaction group (`<StepReveal index={5} dim={1}>` replacing the infinite opacity cycle).

- [ ] **Step 4: `AgentLoopAnim` (loop)** — pulse circle and "loop until done" text read `playing`:

```tsx
const { playing } = useAnimPlayback();
// pulse:
<motion.circle
  r={6}
  fill="#a78bfa"
  initial={false}
  animate={
    playing
      ? {
          cx: [190, 320, 450, 450, 320, 190],
          cy: [130, 88, 130, 170, 212, 170],
          opacity: 1,
        }
      : { cx: 190, cy: 130, opacity: 0.6 }
  }
  transition={
    playing
      ? { duration: 3.6, repeat: Infinity, ease: "easeInOut" }
      : { duration: 0.3 }
  }
/>;
// text: animate={playing ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.7 }}
//       transition={playing ? { duration: 3.6, repeat: Infinity } : { duration: 0.3 }}
```

- [ ] **Step 5: `TokenStreamAnim` (loop)** — tokens: `animate={playing ? { opacity: [0, 1, 1, 0], x: [0, 290] } : { opacity: 0, x: 0 }}`, transition as today when playing (keep the existing stagger; it is already positive: 9×0.35−2.8+1.2 = 1.55s gap) else `{ duration: 0.2 }`.

- [ ] **Step 6: `TemperatureAnim` (loop)** — bars: `animate={{ width: playing ? [0, 160 * p, 160 * p, 0] : 160 * p }}`, transition when playing unchanged, else `{ duration: 0.3 }`; drop `initial={{ width: 0 }}` in favor of `initial={false}`.

- [ ] **Step 7: Verify** — `pnpm lint && pnpm build` pass.

- [ ] **Step 8: Commit** — `git commit -m "feat: step controls + pauseable loops for foundation animations"`

---

### Task 4: Convert `KnowledgeAnims.tsx`

**Files:**

- Modify: `components/animations/KnowledgeAnims.tsx`

- [ ] **Step 1: `ChunkingAnim` (step, 3)** — component reads `const { step } = useAnimPlayback()`. Each strategy row: wrap in `<StepReveal index={i}>`; inner bars grow when their row is reached: `initial={false} animate={{ width: i <= step ? w : 0 }} transition={{ duration: 0.5, delay: i === step ? j * 0.15 : 0 }}` (remove `repeat`/`repeatDelay`).

- [ ] **Step 2: `RagPipelineAnim` (loop)** — query pulse: `animate={playing ? { cx: [...], cy: [...], opacity: 1 } : { cx: 70, cy: 175, opacity: 0.6 }}`; playing transition unchanged, paused `{ duration: 0.3 }`.

- [ ] **Step 3: `EmbeddingSpaceAnim` (loop)** — dot pulses: `animate={playing ? { r: [5, 6, 5] } : { r: 5 }}`; query group opacity: `animate={playing ? { opacity: [0, 1, 1, 0] } : { opacity: 1 }}`; kNN rays: `animate={playing ? { pathLength: [0, 1, 1, 0] } : { pathLength: 1 }}` with `initial={false}`; paused transitions `{ duration: 0.3 }`.

- [ ] **Step 4: `MemoryTypesAnim` (loop)** — keep one-shot entrances; shuttle pulse: `animate={playing ? { cx: [320, 320], cy: [182, 148] } : { cy: 165, cx: 320 }}` with paused transition `{ duration: 0.3 }` (drop `repeatType` when paused).

- [ ] **Step 5: Verify + commit** — `pnpm lint && pnpm build`; `git commit -m "feat: step controls + pauseable loops for knowledge animations"`

---

### Task 5: Convert `ScaleAnims.tsx`

**Files:**

- Modify: `components/animations/ScaleAnims.tsx`

- [ ] **Step 1: `McpHandshakeAnim` (step, 6)** — identical pattern to `ToolCallingAnim` Step 1 of Task 3: each message wrapped in `<StepReveal index={i}>`, delete `CYCLE` timing.

- [ ] **Step 2: `WorkflowPatternsAnim` (step, 5)** — highlight-walk, not cumulative: component reads `step`; each row `<motion.g initial={false} animate={{ opacity: i === step ? 1 : 0.3 }} transition={{ duration: 0.35 }}>`; delete `CYCLE`.

- [ ] **Step 3: `MultiAgentAnim` (loop)** — worker shuttles: `animate={playing ? { cx: [320, w.x + 70, w.x + 70, 320], cy: [74, 140, 140, 74], opacity: [1, 1, 0.4, 1] } : { cx: w.x + 70, cy: 140, opacity: 0.7 }}`; paused transition `{ duration: 0.3 }`.

- [ ] **Step 4: Verify + commit** — `pnpm lint && pnpm build`; `git commit -m "feat: step controls + pauseable loops for scale animations"`

---

### Task 6: Convert `ProdAnims.tsx`

**Files:**

- Modify: `components/animations/ProdAnims.tsx`

- [ ] **Step 1: `InjectionAttackAnim` (step, 3)** — step 0: top row (user request node, fetched-webpage group, agent-context node, their two FlowEdges) in `<StepReveal index={0} dim={1}>`; the flashing red injected text keeps its pulse only while playing (`animate={playing ? { opacity: [0.3, 1, 0.3] } : { opacity: 1 }}`). Step 1: defense-layer group + its incoming edge in `<StepReveal index={1} dim={1}>` (drop the one-shot delay fade). Step 2: outcomes row (both result boxes + their edges) in `<StepReveal index={2} dim={1}>` (drop the infinite opacity cycle).

- [ ] **Step 2: `CapstonePipelineAnim` (step, 7)** — steps 0–5 highlight stage i (each stage `<motion.g initial={false} animate={{ opacity: step === 6 ? (i === 3 || i === 4 ? 1 : 0.45) : i <= step ? (i === step ? 1 : 0.6) : 0.25 }}>`); the traveling dot parks at the current stage: `animate={{ cx: 66 + Math.min(step, 5) * 106, cy: 67 }} transition={{ duration: 0.5, ease: "easeInOut" }}` (no infinite loop). Step 6 highlights the red retry edge + caption (wrap them in `<motion.g initial={false} animate={{ opacity: step === 6 ? 1 : 0.35 }}>`).

- [ ] **Step 3: `EvalLoopAnim` (loop)** — score dots: `initial={false} animate={playing ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}` — replace the repeating mount cycle with a stagger that only runs while playing: `animate={{ opacity: playing ? [0, 1] : 1, scale: playing ? [0, 1] : 1 }} transition={playing ? { delay: i * 0.35, duration: 0.3, repeat: Infinity, repeatDelay: scores.length * 0.35 + 2 } : { duration: 0.2 }}`.

- [ ] **Step 4: Verify + commit** — `pnpm lint && pnpm build`; `git commit -m "feat: step controls + pauseable loops for production animations"`

---

### Task 7: End-to-end verification

- [ ] **Step 1:** `pnpm lint && pnpm build` — clean.
- [ ] **Step 2:** `pnpm dev`, open a lesson page per module group containing each animation type; verify: step controls walk steps and show n/N; prev/next pause auto-play; replay restarts; play/pause freezes/starts loops; scrolling off-screen pauses (check via React DevTools or visually on return); OS reduced-motion emulation starts animations paused at the completed pose.
- [ ] **Step 3:** Commit any fixes; final commit.
