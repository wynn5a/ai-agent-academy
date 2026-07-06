"use client";

import React from "react";
import { motion } from "framer-motion";
import type { TargetAndTransition, Transition } from "framer-motion";
import { useAnimPlayback } from "./controller";

/* ---------- shared SVG primitives for concept animations ---------- */

export function Stage({
  viewBox,
  children,
}: {
  viewBox: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox}
      className="mx-auto block w-full max-w-2xl"
      role="img"
    >
      {children}
    </svg>
  );
}

export function Node({
  x,
  y,
  w,
  h,
  label,
  sub,
  color = "#38bdf8",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  color?: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        fill={`${color}14`}
        stroke={color}
        strokeOpacity={0.55}
        strokeWidth={1.5}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + (sub ? -4 : 4)}
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize={13}
        fontWeight={600}
        fontFamily="ui-monospace, Menlo, monospace"
      >
        {label}
      </text>
      {sub && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 13}
          textAnchor="middle"
          fill="#64748b"
          fontSize={10}
          fontFamily="ui-monospace, Menlo, monospace"
        >
          {sub}
        </text>
      )}
    </g>
  );
}

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

/**
 * Spreadable props for a loop animation element: runs `active` keyframes while
 * playing, settles into the `rest` pose when paused/ended.
 */
export function loopMotion(
  playing: boolean,
  active: { animate: TargetAndTransition; transition: Transition },
  rest: TargetAndTransition,
) {
  return {
    // an explicit pose (not `false`) so Replay — which remounts the
    // component via a new `key` while `playing` is already true — still
    // transitions from `rest` instead of snapping straight to the animate
    // keyframes' end state.
    initial: rest,
    animate: playing ? active.animate : rest,
    transition: playing ? active.transition : { duration: 0.3 },
  };
}

/** Step-driven opacity fade with the shared reveal timing. */
export function StepFade({
  opacity,
  children,
}: {
  opacity: number;
  children: React.ReactNode;
}) {
  return (
    <motion.g
      initial={false}
      animate={{ opacity }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.g>
  );
}

/**
 * Cumulative step reveal: hidden until `index` is reached, full opacity while
 * current, dimmed once passed. `dim={1}` keeps passed steps fully visible.
 */
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
