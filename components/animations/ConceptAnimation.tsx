"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import type { AnimationName } from "@/lib/types";
import { AnimPlaybackProvider, ControlBar } from "./controller";

type Entry = {
  Component: React.ComponentType;
  /** viewBox width/height, used for a zero-layout-shift placeholder box */
  w: number;
  h: number;
  /** present => step-driven animation with prev/next controls */
  steps?: number;
  /** auto-advance interval override (ms) */
  stepMs?: number;
  /** loop animations: duration of one full pass — playback stops after it */
  cycleMs?: number;
};

/*
 * Step counts must match the row counts inside each animation component.
 * cycleMs must be ≥ the animation's one-pass duration (its internal
 * duration + stagger delays) — playback freezes into the rest pose after it.
 */
const REGISTRY: Record<AnimationName, Entry> = {
  "agent-loop": {
    Component: dynamic(() =>
      import("./FoundationAnims").then((m) => m.AgentLoopAnim),
    ),
    w: 640,
    h: 360,
    steps: 6, // user task → call → result → call → result → final answer (no tool)
    stepMs: 2100,
  },
  "token-stream": {
    Component: dynamic(() =>
      import("./FoundationAnims").then((m) => m.TokenStreamAnim),
    ),
    w: 640,
    h: 210,
    cycleMs: 8900, // last commit ~6.96s + cursor blink sequence (1.8s)
  },
  "token-selection": {
    Component: dynamic(() =>
      import("./FoundationAnims").then((m) => m.TokenSelectionAnim),
    ),
    w: 640,
    h: 300,
    steps: 5,
    stepMs: 2600,
  },
  temperature: {
    Component: dynamic(() =>
      import("./FoundationAnims").then((m) => m.TemperatureAnim),
    ),
    w: 640,
    h: 260,
    cycleMs: 1800, // bars grow in 1s + 0.36s stagger
  },
  "schema-masking": {
    Component: dynamic(() =>
      import("./FoundationAnims").then((m) => m.SchemaMaskingAnim),
    ),
    w: 640,
    h: 300,
    steps: 4,
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
    h: 240,
    steps: 4,
    stepMs: 1000,
  },
  "react-pattern": {
    Component: dynamic(() =>
      import("./FoundationAnims").then((m) => m.ReactPatternAnim),
    ),
    w: 640,
    h: 240,
    steps: 5,
    stepMs: 1500,
  },
  "termination-guards": {
    Component: dynamic(() =>
      import("./FoundationAnims").then((m) => m.TerminationGuardsAnim),
    ),
    w: 640,
    h: 260,
    steps: 5,
  },
  "failure-defenses": {
    Component: dynamic(() =>
      import("./FoundationAnims").then((m) => m.FailureDefensesAnim),
    ),
    w: 640,
    h: 200,
    steps: 3,
  },
  "rag-pipeline": {
    Component: dynamic(() =>
      import("./KnowledgeAnims").then((m) => m.RagPipelineAnim),
    ),
    w: 660,
    h: 300,
    cycleMs: 3600, // 3s pulse travel + hold at the answer
  },
  "embedding-space": {
    Component: dynamic(() =>
      import("./KnowledgeAnims").then((m) => m.EmbeddingSpaceAnim),
    ),
    w: 640,
    h: 240,
    cycleMs: 3000, // query fades in 0.8s, rays draw by 1.6s, dots settle
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
    cycleMs: 3200, // ~2 shuttle bounces (1.4s each way)
  },
  "multi-agent": {
    Component: dynamic(() =>
      import("./ScaleAnims").then((m) => m.MultiAgentAnim),
    ),
    w: 640,
    h: 260,
    cycleMs: 6200, // last worker: 2.4s stagger + 3.6s round trip
  },
  "workflow-patterns": {
    Component: dynamic(() =>
      import("./ScaleAnims").then((m) => m.WorkflowPatternsAnim),
    ),
    w: 640,
    h: 200,
    steps: 5,
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
    cycleMs: 3400, // last dot: 7 × 0.35s stagger + 0.3s pop
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
  const entry = REGISTRY[name] as Entry | undefined;
  const reduced = useReducedMotionPref();
  const [userIntent, setUserIntent] = useState<"play" | "pause" | null>(null);
  const [step, setStep] = useState(0);
  const [runId, setRunId] = useState(0);
  const [inView, setInView] = useState(false);
  // the current pass finished — stay frozen until the user triggers play again
  const [ended, setEnded] = useState(false);
  const figRef = useRef<HTMLElement>(null);

  const steps = entry?.steps;
  const stepMs = entry?.stepMs ?? 2200;
  const cycleMs = entry?.cycleMs;
  const wantsPlay = userIntent ? userIntent === "play" : !reduced;
  const playing = wantsPlay && inView && !ended;
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

  const Component = entry?.Component;
  const playback = useMemo(
    () => ({ playing, step: shownStep }),
    [playing, shownStep],
  );
  const anim = useMemo(
    () => (Component ? <Component key={runId} /> : null),
    [Component, runId],
  );

  // step animations: advance until the last step, then stop
  useEffect(() => {
    if (!steps || !playing) return;
    const id = setTimeout(
      () => (step >= steps - 1 ? setEnded(true) : setStep((s) => s + 1)),
      stepMs,
    );
    return () => clearTimeout(id);
  }, [steps, playing, step, stepMs]);

  // loop animations: stop after one full pass
  useEffect(() => {
    if (steps || !playing || !cycleMs) return;
    const id = setTimeout(() => setEnded(true), cycleMs);
    return () => clearTimeout(id);
  }, [steps, playing, cycleMs]);

  if (!entry) return null;

  const handleStep = (dir: 1 | -1) => {
    if (!steps) return;
    setEnded(false);
    setUserIntent("pause");
    setStep((shownStep + dir + steps) % steps);
  };
  const handleReplay = () => {
    setEnded(false);
    setStep(0);
    setUserIntent("play");
    setRunId((r) => r + 1);
  };
  const handleToggle = () => {
    if (ended) {
      handleReplay();
      return;
    }
    setUserIntent(wantsPlay ? "pause" : "play");
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
          <AnimPlaybackProvider value={playback}>{anim}</AnimPlaybackProvider>
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
          onToggle={handleToggle}
          onReplay={handleReplay}
          onStep={steps ? handleStep : undefined}
        />
      </figcaption>
    </figure>
  );
}
