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
  /** viewBox width/height, used for a zero-layout-shift placeholder box */
  w: number;
  h: number;
  /** present => step-driven animation with prev/next controls */
  steps?: number;
  /** auto-advance interval override (ms) */
  stepMs?: number;
};

/* Step counts must match the row counts inside each animation component. */
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
    Component: dynamic(() =>
      import("./ProdAnims").then((m) => m.EvalLoopAnim),
    ),
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
  const entry = REGISTRY[name] as Entry | undefined;
  const reduced = useReducedMotionPref();
  const [userIntent, setUserIntent] = useState<"play" | "pause" | null>(null);
  const [step, setStep] = useState(0);
  const [runId, setRunId] = useState(0);
  const [inView, setInView] = useState(false);
  const figRef = useRef<HTMLElement>(null);

  const steps = entry?.steps;
  const stepMs = entry?.stepMs ?? 2200;
  const wantsPlay = userIntent ? userIntent === "play" : !reduced;
  const playing = wantsPlay && inView;
  // reduced-motion users see the completed diagram until they interact
  const shownStep = steps && reduced && userIntent === null ? steps - 1 : step;

  useEffect(() => {
    const el = figRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!steps || !playing) return;
    const hold = step === steps - 1 ? stepMs * 1.8 : stepMs;
    const id = setTimeout(() => setStep((s) => (s + 1) % steps), hold);
    return () => clearTimeout(id);
  }, [steps, playing, step, stepMs]);

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
