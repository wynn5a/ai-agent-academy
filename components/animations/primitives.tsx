"use client";

import React from "react";

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
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeOpacity={0.5}
      strokeWidth={1.5}
      strokeDasharray="6 10"
      className="animate-flow-dash"
    />
  );
}
