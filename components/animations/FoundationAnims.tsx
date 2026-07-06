"use client";

import { motion } from "framer-motion";
import { Stage, Node, FlowEdge, StepReveal, loopMotion } from "./primitives";
import { useAnimPlayback } from "./controller";

/* ---------- 1. The agent loop: LLM → tool call → result → LLM ---------- */
export function AgentLoopAnim() {
  const { playing } = useAnimPlayback();
  return (
    <Stage viewBox="0 0 640 300">
      <Node
        x={40}
        y={110}
        w={150}
        h={80}
        label="LLM"
        sub="reason + decide"
        color="#a78bfa"
      />
      <Node
        x={450}
        y={110}
        w={150}
        h={80}
        label="Tools"
        sub="execute"
        color="#34d399"
      />
      <Node x={245} y={20} w={150} h={54} label="User task" color="#38bdf8" />
      <Node
        x={245}
        y={226}
        w={150}
        h={54}
        label="Final answer"
        color="#38bdf8"
      />

      <FlowEdge d="M 320 74 V 96 Q 320 110 300 118 L 200 148" color="#38bdf8" />
      <FlowEdge d="M 190 130 Q 320 70 450 130" color="#a78bfa" />
      <FlowEdge d="M 450 170 Q 320 230 190 170" color="#34d399" />
      <FlowEdge
        d="M 200 165 L 300 190 Q 320 196 320 210 V 226"
        color="#38bdf8"
      />

      {/* pulse riding the loop — one lap per pass, ends back at the LLM */}
      <motion.circle
        r={6}
        fill="#a78bfa"
        {...loopMotion(
          playing,
          {
            animate: {
              cx: [190, 320, 450, 450, 320, 190],
              cy: [130, 88, 130, 170, 212, 170],
              opacity: 1,
            },
            transition: { duration: 3.6, ease: "easeInOut" },
          },
          { cx: 190, cy: 130, opacity: 0.6 },
        )}
      />
      <motion.text
        x={320}
        y={158}
        textAnchor="middle"
        fill="#64748b"
        fontSize={11}
        fontFamily="ui-monospace, Menlo, monospace"
        {...loopMotion(
          playing,
          {
            animate: { opacity: [0.4, 1, 0.4] },
            transition: { duration: 3.6 },
          },
          { opacity: 0.7 },
        )}
      >
        loop until done ↺
      </motion.text>
      <text
        x={320}
        y={100}
        textAnchor="middle"
        fill="#a78bfa"
        fontSize={10}
        fontFamily="monospace"
      >
        tool_call(name, args)
      </text>
      <text
        x={320}
        y={205}
        textAnchor="middle"
        fill="#34d399"
        fontSize={10}
        fontFamily="monospace"
      >
        tool result → appended to messages
      </text>
    </Stage>
  );
}

/* ---------- 2. Token streaming ---------- */
const TOKENS = [
  "The",
  " agent",
  " calls",
  " the",
  " search",
  " tool",
  " and",
  " waits",
  "…",
];
// seconds: one chip's flight time from model to client, and the gap
// between successive chips departing (several overlap in flight at once,
// same as a real token stream). Slow enough to read each word as it lands.
const FLIGHT_S = 1.6;
const STAGGER_S = 0.7;
// monospace px/char for the "rendered" sentence building up at the client —
// independent of the flight chips' own (larger, padded) pill width.
const CHAR_W = 7.2;
const RESPONSE_X = 66;

// cumulative layout: each token's flight-chip width and its x offset within
// the accumulating response line, so the two stay in the same left-to-right
// order even though they're drawn at different scales.
let charsSoFar = 0;
const TOKEN_LAYOUT = TOKENS.map((t) => {
  const responseX = RESPONSE_X + charsSoFar * CHAR_W;
  charsSoFar += t.length;
  return { text: t, chipWidth: t.length * 7 + 14, responseX };
});
const RESPONSE_END_X = RESPONSE_X + charsSoFar * CHAR_W;

export function TokenStreamAnim() {
  const { playing } = useAnimPlayback();
  const lastCommitDelay =
    (TOKEN_LAYOUT.length - 1) * STAGGER_S + FLIGHT_S * 0.85;

  return (
    <Stage viewBox="0 0 640 210">
      <Node
        x={30}
        y={46}
        w={130}
        h={70}
        label="Model"
        sub="generates"
        color="#a78bfa"
      />
      <Node
        x={480}
        y={46}
        w={130}
        h={70}
        label="Client"
        sub="renders"
        color="#38bdf8"
      />
      <FlowEdge d="M 160 81 H 480" color="#38bdf8" />

      {/* first chip only: call out time-to-first-token */}
      <motion.text
        x={320}
        y={26}
        textAnchor="middle"
        fill="#34d399"
        fontSize={10.5}
        fontFamily="monospace"
        {...loopMotion(
          playing,
          {
            animate: { opacity: [0, 1, 1, 0] },
            transition: { duration: 1.2, times: [0, 0.25, 0.8, 1] },
          },
          { opacity: 0 },
        )}
      >
        first token arrives → perceived latency starts here
      </motion.text>

      {/* flying chips: one SSE delta each, model → client */}
      {TOKEN_LAYOUT.map((tok, i) => (
        <motion.g
          key={i}
          {...loopMotion(
            playing,
            {
              animate: { opacity: [0, 1, 1, 0], x: [0, 300] },
              transition: {
                duration: FLIGHT_S,
                times: [0, 0.12, 0.85, 1],
                delay: i * STAGGER_S,
                ease: "linear",
              },
            },
            { opacity: 0 },
          )}
        >
          <rect
            x={165}
            y={69}
            width={tok.chipWidth}
            height={24}
            rx={6}
            fill="#38bdf81f"
            stroke="#38bdf8"
            strokeOpacity={0.4}
          />
          <text
            x={165 + tok.chipWidth / 2}
            y={85}
            textAnchor="middle"
            fill="#7dd3fc"
            fontSize={11}
            fontFamily="monospace"
          >
            {tok.text.trim() || "·"}
          </text>
        </motion.g>
      ))}

      {/* the client "renders incrementally": each token is appended to a
          growing response line the moment its chip lands, and stays put —
          this is the part a fire-and-forget chip animation can't show. */}
      <rect
        x={55}
        y={140}
        width={530}
        height={40}
        rx={8}
        fill="none"
        stroke="#232f47"
        strokeWidth={1.5}
      />
      {TOKEN_LAYOUT.map((tok, i) => (
        <motion.text
          key={i}
          x={tok.responseX}
          y={165}
          xmlSpace="preserve"
          fill="#e2e8f0"
          fontSize={12}
          fontFamily="monospace"
          {...loopMotion(
            playing,
            {
              animate: { opacity: [0, 1] },
              transition: {
                duration: 0.3,
                delay: i * STAGGER_S + FLIGHT_S * 0.85,
              },
            },
            { opacity: 0 },
          )}
        >
          {tok.text}
        </motion.text>
      ))}
      {/* cursor: solid while text is still landing, blinks a couple of
          times once the stream completes, then rests hidden */}
      <motion.rect
        x={RESPONSE_END_X + 2}
        y={153}
        width={2}
        height={16}
        fill="#7dd3fc"
        {...loopMotion(
          playing,
          {
            animate: { opacity: [1, 1, 0, 1, 0, 1, 0] },
            transition: {
              duration: lastCommitDelay + 1.8,
              times: [
                0,
                lastCommitDelay / (lastCommitDelay + 1.8),
                (lastCommitDelay + 0.3) / (lastCommitDelay + 1.8),
                (lastCommitDelay + 0.6) / (lastCommitDelay + 1.8),
                (lastCommitDelay + 0.9) / (lastCommitDelay + 1.8),
                (lastCommitDelay + 1.2) / (lastCommitDelay + 1.8),
                1,
              ],
            },
          },
          { opacity: 0 },
        )}
      />

      <text
        x={320}
        y={195}
        textAnchor="middle"
        fill="#64748b"
        fontSize={10.5}
        fontFamily="monospace"
      >
        server-sent events: data: {"{"}&quot;delta&quot;: &quot;…&quot;{"}"} —
        each one is appended, not replaced
      </text>
    </Stage>
  );
}

/* ---------- 3. Temperature / sampling ---------- */
const DIST = [
  { tok: '"Paris"', p0: 0.86, p1: 0.44 },
  { tok: '"paris"', p0: 0.08, p1: 0.22 },
  { tok: '"The"', p0: 0.04, p1: 0.18 },
  { tok: '"France"', p0: 0.02, p1: 0.16 },
];
export function TemperatureAnim() {
  const { playing } = useAnimPlayback();
  return (
    <Stage viewBox="0 0 640 260">
      {[0, 1].map((mode) => (
        <g key={mode} transform={`translate(${40 + mode * 320}, 30)`}>
          <text
            x={130}
            y={0}
            textAnchor="middle"
            fill={mode ? "#fbbf24" : "#38bdf8"}
            fontSize={13}
            fontWeight={700}
            fontFamily="monospace"
          >
            temperature = {mode ? "1.0" : "0.1"}
          </text>
          <text
            x={130}
            y={18}
            textAnchor="middle"
            fill="#64748b"
            fontSize={10}
            fontFamily="monospace"
          >
            {mode ? "flatter — more diverse" : "peaked — near-deterministic"}
          </text>
          {DIST.map((d, i) => {
            const p = mode ? d.p1 : d.p0;
            return (
              <g key={i} transform={`translate(0, ${40 + i * 40})`}>
                <text
                  x={58}
                  y={16}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize={11}
                  fontFamily="monospace"
                >
                  {d.tok}
                </text>
                <rect
                  x={66}
                  y={2}
                  width={160}
                  height={20}
                  rx={4}
                  fill="#ffffff08"
                />
                <motion.rect
                  x={66}
                  y={2}
                  height={20}
                  rx={4}
                  fill={mode ? "#fbbf24" : "#38bdf8"}
                  fillOpacity={0.7}
                  {...loopMotion(
                    playing,
                    {
                      animate: { width: [0, 160 * p] },
                      transition: { duration: 1, delay: i * 0.12 },
                    },
                    { width: 160 * p },
                  )}
                />
                <text
                  x={232}
                  y={16}
                  fill="#64748b"
                  fontSize={10}
                  fontFamily="monospace"
                >
                  {Math.round(p * 100)}%
                </text>
              </g>
            );
          })}
        </g>
      ))}
    </Stage>
  );
}

/* ---------- 4. Context window fill + compaction ---------- */
const SEGS = [
  { label: "system", color: "#a78bfa", w: 70 },
  { label: "tools", color: "#34d399", w: 60 },
  { label: "history", color: "#38bdf8", w: 210 },
  { label: "tool results", color: "#fbbf24", w: 130 },
  { label: "new turn", color: "#f87171", w: 60 },
];
export function ContextWindowAnim() {
  const { step } = useAnimPlayback();
  const placed = SEGS.reduce<Array<(typeof SEGS)[number] & { x: number }>>(
    (rows, s) => {
      const prev = rows.at(-1);
      const x = prev ? prev.x + prev.w : 0;
      return [...rows, { ...s, x }];
    },
    [],
  );
  return (
    <Stage viewBox="0 0 640 220">
      <text
        x={320}
        y={28}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={12}
        fontFamily="monospace"
      >
        context window (finite budget)
      </text>
      <rect
        x={55}
        y={44}
        width={530}
        height={44}
        rx={8}
        fill="none"
        stroke="#232f47"
        strokeWidth={1.5}
      />
      {placed.map((s, i) => (
        <StepReveal key={i} index={i} dim={1}>
          <motion.rect
            x={58 + s.x}
            y={47}
            height={38}
            rx={5}
            fill={s.color}
            fillOpacity={0.35}
            stroke={s.color}
            strokeOpacity={0.6}
            initial={false}
            animate={{ width: i <= step ? s.w - 4 : 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
          <text
            x={58 + s.x + (s.w - 4) / 2}
            y={70}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize={9.5}
            fontFamily="monospace"
          >
            {s.label}
          </text>
        </StepReveal>
      ))}
      <StepReveal index={5} dim={1}>
        <text
          x={320}
          y={120}
          textAnchor="middle"
          fill="#f87171"
          fontSize={11}
          fontFamily="monospace"
        >
          ⚠ approaching limit → compact
        </text>
        <rect
          x={55}
          y={136}
          width={530}
          height={44}
          rx={8}
          fill="none"
          stroke="#232f47"
          strokeWidth={1.5}
        />
        <rect
          x={58}
          y={139}
          width={66}
          height={38}
          rx={5}
          fill="#a78bfa59"
          stroke="#a78bfa99"
        />
        <text
          x={91}
          y={162}
          textAnchor="middle"
          fill="#e2e8f0"
          fontSize={9.5}
          fontFamily="monospace"
        >
          system
        </text>
        <rect
          x={128}
          y={139}
          width={110}
          height={38}
          rx={5}
          fill="#34d39959"
          stroke="#34d39999"
        />
        <text
          x={183}
          y={162}
          textAnchor="middle"
          fill="#e2e8f0"
          fontSize={9.5}
          fontFamily="monospace"
        >
          summary ✦
        </text>
        <rect
          x={242}
          y={139}
          width={90}
          height={38}
          rx={5}
          fill="#38bdf859"
          stroke="#38bdf899"
        />
        <text
          x={287}
          y={162}
          textAnchor="middle"
          fill="#e2e8f0"
          fontSize={9.5}
          fontFamily="monospace"
        >
          recent turns
        </text>
        <text
          x={430}
          y={162}
          textAnchor="middle"
          fill="#475569"
          fontSize={10}
          fontFamily="monospace"
        >
          ← reclaimed budget
        </text>
      </StepReveal>
      <text
        x={320}
        y={205}
        textAnchor="middle"
        fill="#64748b"
        fontSize={10.5}
        fontFamily="monospace"
      >
        old turns are summarized; system prompt and recent turns survive
        verbatim
      </text>
    </Stage>
  );
}

/* ---------- 5. Tool calling handshake ---------- */
const TC_STEPS = [
  { from: "app", text: "messages + tool schemas", y: 66 },
  {
    from: "llm",
    text: 'stop_reason: "tool_use" → get_weather({city:"Tokyo"})',
    y: 106,
  },
  { from: "app", text: 'tool_result: {"temp": 21, "sky": "clear"}', y: 146 },
  { from: "llm", text: '"It\'s 21°C and clear in Tokyo."', y: 186 },
];
export function ToolCallingAnim() {
  return (
    <Stage viewBox="0 0 640 230">
      <Node x={30} y={20} w={120} h={44} label="Your app" color="#38bdf8" />
      <Node x={490} y={20} w={120} h={44} label="LLM API" color="#a78bfa" />
      <line
        x1={90}
        y1={64}
        x2={90}
        y2={215}
        stroke="#232f47"
        strokeWidth={1.5}
      />
      <line
        x1={550}
        y1={64}
        x2={550}
        y2={215}
        stroke="#232f47"
        strokeWidth={1.5}
      />
      {TC_STEPS.map((s, i) => {
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
      })}
      <defs>
        <marker
          id="arr"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6" fill="none" stroke="#64748b" />
        </marker>
      </defs>
    </Stage>
  );
}

/* ---------- 6. ReAct pattern trace ---------- */
const REACT_ROWS = [
  {
    tag: "Thought",
    color: "#a78bfa",
    text: "I need current pricing — my training data is stale.",
  },
  {
    tag: "Action",
    color: "#34d399",
    text: 'web_search("Claude API pricing 2026")',
  },
  {
    tag: "Observation",
    color: "#fbbf24",
    text: "Result: pricing page → $/MTok input, output…",
  },
  {
    tag: "Thought",
    color: "#a78bfa",
    text: "I have what I need. Compose the answer.",
  },
  {
    tag: "Answer",
    color: "#38bdf8",
    text: "Grounded response with the fresh numbers.",
  },
];
export function ReactPatternAnim() {
  return (
    <Stage viewBox="0 0 640 240">
      {REACT_ROWS.map((r, i) => (
        <StepReveal key={i} index={i}>
          <rect
            x={40}
            y={18 + i * 42}
            width={560}
            height={34}
            rx={8}
            fill={`${r.color}0f`}
            stroke={r.color}
            strokeOpacity={0.35}
          />
          <text
            x={56}
            y={39 + i * 42}
            fill={r.color}
            fontSize={11}
            fontWeight={700}
            fontFamily="monospace"
          >
            {r.tag}:
          </text>
          <text
            x={150}
            y={39 + i * 42}
            fill="#cbd5e1"
            fontSize={11}
            fontFamily="monospace"
          >
            {r.text}
          </text>
        </StepReveal>
      ))}
    </Stage>
  );
}
