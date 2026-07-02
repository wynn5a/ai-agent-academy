"use client";

import { motion } from "framer-motion";
import { Stage, Node, FlowEdge } from "./primitives";

/* ---------- Orchestrator-workers multi-agent ---------- */
export function MultiAgentAnim() {
  const workers = [
    { label: "Searcher", x: 40, color: "#38bdf8" },
    { label: "Writer", x: 250, color: "#34d399" },
    { label: "Critic", x: 460, color: "#fbbf24" },
  ];
  return (
    <Stage viewBox="0 0 640 260">
      <Node
        x={230}
        y={20}
        w={180}
        h={54}
        label="Orchestrator"
        sub="plans + routes"
        color="#a78bfa"
      />
      {workers.map((w, i) => (
        <g key={i}>
          <Node
            x={w.x}
            y={140}
            w={140}
            h={54}
            label={w.label}
            sub="own context"
            color={w.color}
          />
          <FlowEdge
            d={`M ${320} 74 Q ${320} 110 ${w.x + 70} 140`}
            color={w.color}
          />
        </g>
      ))}
      {workers.map((w, i) => (
        <motion.circle
          key={i}
          r={5}
          fill={w.color}
          animate={{
            cx: [320, w.x + 70, w.x + 70, 320],
            cy: [74, 140, 140, 74],
            opacity: [1, 1, 0.4, 1],
          }}
          transition={{
            duration: 3.6,
            repeat: Infinity,
            delay: i * 1.2,
            ease: "easeInOut",
          }}
        />
      ))}
      <text
        x={320}
        y={235}
        textAnchor="middle"
        fill="#64748b"
        fontSize={10.5}
        fontFamily="monospace"
      >
        subtasks fan out · results + traces flow back · orchestrator decides
        what&apos;s next
      </text>
    </Stage>
  );
}

/* ---------- Anthropic workflow patterns ---------- */
const PATTERNS = [
  { name: "Prompt chaining", desc: "A → B → C, each step validated" },
  { name: "Routing", desc: "classify, then dispatch to a specialist" },
  { name: "Parallelization", desc: "fan out, vote or merge" },
  { name: "Orchestrator–workers", desc: "dynamic decomposition" },
  { name: "Evaluator–optimizer", desc: "generate → critique → refine loop" },
];
export function WorkflowPatternsAnim() {
  const CYCLE = PATTERNS.length * 1.4;
  return (
    <Stage viewBox="0 0 640 200">
      {PATTERNS.map((p, i) => (
        <motion.g
          key={i}
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{
            duration: CYCLE,
            times: [
              Math.max(0, (i * 1.4 - 0.4) / CYCLE),
              (i * 1.4 + 0.5) / CYCLE,
              Math.min(1, (i * 1.4 + 1.6) / CYCLE),
            ],
            repeat: Infinity,
          }}
        >
          <rect
            x={60}
            y={16 + i * 34}
            width={520}
            height={28}
            rx={7}
            fill="#38bdf80d"
            stroke="#38bdf8"
            strokeOpacity={0.3}
          />
          <text
            x={76}
            y={34 + i * 34}
            fill="#7dd3fc"
            fontSize={11.5}
            fontWeight={700}
            fontFamily="monospace"
          >
            {p.name}
          </text>
          <text
            x={300}
            y={34 + i * 34}
            fill="#64748b"
            fontSize={10.5}
            fontFamily="monospace"
          >
            {p.desc}
          </text>
        </motion.g>
      ))}
      <text
        x={320}
        y={192}
        textAnchor="middle"
        fill="#475569"
        fontSize={10}
        fontFamily="monospace"
      >
        workflows = predefined code paths · agents = the model decides the path
      </text>
    </Stage>
  );
}

/* ---------- MCP handshake sequence ---------- */
const MCP_STEPS = [
  { from: "c", text: "initialize (protocol version, capabilities)" },
  { from: "s", text: "capabilities: tools, resources, prompts" },
  { from: "c", text: "tools/list" },
  { from: "s", text: '[{name: "query_db", inputSchema: {…}}, …]' },
  { from: "c", text: 'tools/call → query_db({sql: "SELECT …"})' },
  { from: "s", text: 'content: [{type: "text", text: "42 rows…"}]' },
];
export function McpHandshakeAnim() {
  const CYCLE = MCP_STEPS.length * 1.0 + 1.8;
  return (
    <Stage viewBox="0 0 640 300">
      <Node
        x={30}
        y={16}
        w={150}
        h={46}
        label="MCP client"
        sub="host app / agent"
        color="#38bdf8"
      />
      <Node
        x={460}
        y={16}
        w={150}
        h={46}
        label="MCP server"
        sub="your tools"
        color="#34d399"
      />
      <line
        x1={105}
        y1={62}
        x2={105}
        y2={285}
        stroke="#232f47"
        strokeWidth={1.5}
      />
      <line
        x1={535}
        y1={62}
        x2={535}
        y2={285}
        stroke="#232f47"
        strokeWidth={1.5}
      />
      {MCP_STEPS.map((s, i) => {
        const ltr = s.from === "c";
        const y = 88 + i * 33;
        return (
          <motion.g
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{
              duration: CYCLE,
              times: [i / CYCLE, (i + 0.35) / CYCLE, (CYCLE - 0.6) / CYCLE, 1],
              repeat: Infinity,
            }}
          >
            <line
              x1={ltr ? 105 : 535}
              y1={y}
              x2={ltr ? 535 : 105}
              y2={y}
              stroke={ltr ? "#38bdf8" : "#34d399"}
              strokeOpacity={0.55}
              strokeWidth={1.2}
              markerEnd="url(#mcparr)"
            />
            <text
              x={320}
              y={y - 6}
              textAnchor="middle"
              fill={ltr ? "#7dd3fc" : "#6ee7b7"}
              fontSize={10}
              fontFamily="monospace"
            >
              {s.text}
            </text>
          </motion.g>
        );
      })}
      <defs>
        <marker
          id="mcparr"
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
