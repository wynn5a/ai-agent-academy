"use client";

import { motion } from "framer-motion";
import {
  Stage,
  Node,
  FlowEdge,
  StepReveal,
  StepFade,
  loopMotion,
} from "./primitives";
import { useAnimPlayback } from "./controller";

/* ---------- RAG pipeline: ingest + query paths ---------- */
export function RagPipelineAnim() {
  const { playing } = useAnimPlayback();
  return (
    <Stage viewBox="0 0 660 300">
      {/* ingest row */}
      <text x={20} y={30} fill="#64748b" fontSize={10} fontFamily="monospace">
        INGEST (offline)
      </text>
      <Node x={20} y={42} w={100} h={46} label="Docs" color="#94a3b8" />
      <Node x={160} y={42} w={100} h={46} label="Chunks" color="#38bdf8" />
      <Node x={300} y={42} w={110} h={46} label="Embeddings" color="#a78bfa" />
      <Node
        x={450}
        y={42}
        w={130}
        h={46}
        label="Vector DB"
        sub="+ BM25 index"
        color="#34d399"
      />
      <FlowEdge d="M 120 65 H 160" />
      <FlowEdge d="M 260 65 H 300" color="#a78bfa" />
      <FlowEdge d="M 410 65 H 450" color="#34d399" />

      {/* query row */}
      <text x={20} y={140} fill="#64748b" fontSize={10} fontFamily="monospace">
        QUERY (online)
      </text>
      <Node x={20} y={152} w={100} h={46} label="Query" color="#fbbf24" />
      <Node
        x={160}
        y={152}
        w={110}
        h={46}
        label="Rewrite"
        sub="expand/HyDE"
        color="#fbbf24"
      />
      <Node
        x={310}
        y={152}
        w={120}
        h={46}
        label="Hybrid search"
        sub="dense + BM25"
        color="#34d399"
      />
      <Node
        x={470}
        y={152}
        w={110}
        h={46}
        label="Rerank"
        sub="cross-encoder"
        color="#a78bfa"
      />
      <Node
        x={310}
        y={236}
        w={270}
        h={46}
        label="Grounded generation"
        sub="answer + citations"
        color="#38bdf8"
      />
      <FlowEdge d="M 120 175 H 160" color="#fbbf24" />
      <FlowEdge d="M 270 175 H 310" color="#fbbf24" />
      <FlowEdge d="M 430 175 H 470" color="#34d399" />
      <FlowEdge d="M 515 88 V 152" color="#34d399" />
      <FlowEdge d="M 525 198 Q 525 236 580 245" color="#a78bfa" />
      <motion.circle
        r={5}
        fill="#fbbf24"
        {...loopMotion(
          playing,
          {
            animate: {
              cx: [70, 215, 370, 525, 445],
              cy: [175, 175, 175, 175, 259],
              opacity: 1,
            },
            transition: { duration: 3, ease: "easeInOut" },
          },
          { cx: 445, cy: 259, opacity: 0.6 },
        )}
      />
    </Stage>
  );
}

/* ---------- Embedding space: clusters + query nearest neighbors ---------- */
const CLUSTERS = [
  {
    cx: 150,
    cy: 105,
    color: "#38bdf8",
    pts: [
      [-28, -12],
      [-6, -30],
      [18, -8],
      [-14, 14],
      [12, 20],
    ],
  },
  {
    cx: 330,
    cy: 80,
    color: "#a78bfa",
    pts: [
      [-22, -10],
      [4, -22],
      [24, 2],
      [-4, 16],
    ],
  },
  {
    cx: 480,
    cy: 150,
    color: "#34d399",
    pts: [
      [-24, -14],
      [0, -26],
      [22, -6],
      [-10, 12],
      [16, 18],
    ],
  },
];
export function EmbeddingSpaceAnim() {
  const { playing } = useAnimPlayback();
  const q = { x: 168, y: 96 };
  return (
    <Stage viewBox="0 0 640 240">
      <rect
        x={30}
        y={20}
        width={580}
        height={200}
        rx={12}
        fill="#ffffff03"
        stroke="#232f47"
      />
      <text x={44} y={40} fill="#475569" fontSize={10} fontFamily="monospace">
        semantic space (projected to 2D)
      </text>
      {CLUSTERS.map((c, i) =>
        c.pts.map((p, j) => (
          <motion.circle
            key={`${i}-${j}`}
            cx={c.cx + p[0]}
            cy={c.cy + p[1]}
            r={5}
            fill={c.color}
            fillOpacity={0.75}
            {...loopMotion(
              playing,
              {
                animate: { r: [5, 6, 5] },
                transition: {
                  duration: 2.4,
                  repeat: Infinity,
                  delay: (i * 5 + j) * 0.15,
                },
              },
              { r: 5 },
            )}
          />
        )),
      )}
      <text
        x={150}
        y={150}
        textAnchor="middle"
        fill="#38bdf8"
        fontSize={9.5}
        fontFamily="monospace"
      >
        refund policy docs
      </text>
      <text
        x={330}
        y={125}
        textAnchor="middle"
        fill="#a78bfa"
        fontSize={9.5}
        fontFamily="monospace"
      >
        API reference
      </text>
      <text
        x={480}
        y={200}
        textAnchor="middle"
        fill="#34d399"
        fontSize={9.5}
        fontFamily="monospace"
      >
        onboarding guides
      </text>

      {/* query star + kNN rays — fade in once, then hold */}
      <motion.g
        {...loopMotion(
          playing,
          { animate: { opacity: [0, 1] }, transition: { duration: 0.8 } },
          { opacity: 1 },
        )}
      >
        <text
          x={q.x}
          y={q.y + 5}
          textAnchor="middle"
          fontSize={16}
          fill="#fbbf24"
        >
          ★
        </text>
        <text
          x={q.x}
          y={q.y - 14}
          textAnchor="middle"
          fill="#fbbf24"
          fontSize={9.5}
          fontFamily="monospace"
        >
          embed(&quot;can I get my money back?&quot;)
        </text>
        {CLUSTERS[0].pts.slice(0, 3).map((p, j) => (
          <motion.line
            key={j}
            x1={q.x}
            y1={q.y}
            x2={CLUSTERS[0].cx + p[0]}
            y2={CLUSTERS[0].cy + p[1]}
            stroke="#fbbf24"
            strokeOpacity={0.6}
            strokeDasharray="3 4"
            {...loopMotion(
              playing,
              {
                animate: { pathLength: [0, 1] },
                transition: { duration: 0.8, delay: 0.8 },
              },
              { pathLength: 1 },
            )}
          />
        ))}
      </motion.g>
    </Stage>
  );
}

/* ---------- Chunking strategies ---------- */
export function ChunkingAnim() {
  const { step } = useAnimPlayback();
  const strategies = [
    {
      label: "fixed-size (naive)",
      segs: [88, 88, 88, 88, 88],
      color: "#f87171",
      note: "splits mid-sentence, mid-thought",
    },
    {
      label: "recursive / separator-aware",
      segs: [120, 70, 140, 110],
      color: "#fbbf24",
      note: "respects paragraphs & headers",
    },
    {
      label: "semantic / structural",
      segs: [150, 95, 195],
      color: "#34d399",
      note: "one coherent idea per chunk",
    },
  ];
  return (
    <Stage viewBox="0 0 640 230">
      {strategies.map((s, i) => {
        let acc = 0;
        return (
          <g key={i} transform={`translate(90, ${28 + i * 66})`}>
            <StepReveal index={i}>
              <text
                x={-8}
                y={18}
                textAnchor="end"
                fill="#94a3b8"
                fontSize={10}
                fontFamily="monospace"
              >
                {s.label}
              </text>
              {s.segs.map((w, j) => {
                const x = acc;
                acc += w + 6;
                return (
                  <motion.rect
                    key={j}
                    x={x}
                    y={0}
                    height={28}
                    rx={6}
                    fill={s.color}
                    fillOpacity={0.28}
                    stroke={s.color}
                    strokeOpacity={0.6}
                    initial={false}
                    animate={{ width: i <= step ? w : 0 }}
                    transition={{
                      duration: 0.5,
                      ease: "easeOut",
                      delay: i === step ? j * 0.15 : 0,
                    }}
                  />
                );
              })}
              <text
                x={0}
                y={46}
                fill="#475569"
                fontSize={9.5}
                fontFamily="monospace"
              >
                {s.note}
              </text>
            </StepReveal>
          </g>
        );
      })}
    </Stage>
  );
}

/* ---------- Memory types ---------- */
export function MemoryTypesAnim() {
  const { playing } = useAnimPlayback();
  const types = [
    {
      label: "Working",
      sub: "current context window",
      example: '"the user just asked about refunds"',
      color: "#38bdf8",
      x: 30,
    },
    {
      label: "Episodic",
      sub: "past interactions",
      example: '"last week she deployed v2 to staging"',
      color: "#a78bfa",
      x: 235,
    },
    {
      label: "Semantic",
      sub: "distilled facts",
      example: '"prefers Python; timezone UTC+8"',
      color: "#34d399",
      x: 440,
    },
  ];
  return (
    <Stage viewBox="0 0 640 240">
      {types.map((t, i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.35 }}
        >
          <rect
            x={t.x}
            y={30}
            width={170}
            height={110}
            rx={12}
            fill={`${t.color}0f`}
            stroke={t.color}
            strokeOpacity={0.5}
          />
          <text
            x={t.x + 85}
            y={58}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize={14}
            fontWeight={700}
            fontFamily="monospace"
          >
            {t.label}
          </text>
          <text
            x={t.x + 85}
            y={76}
            textAnchor="middle"
            fill="#64748b"
            fontSize={9.5}
            fontFamily="monospace"
          >
            {t.sub}
          </text>
          <foreignObject x={t.x + 10} y={86} width={150} height={48}>
            <div
              style={{
                color: "#94a3b8",
                fontSize: 9,
                fontFamily: "monospace",
                textAlign: "center",
                lineHeight: 1.4,
              }}
            >
              {t.example}
            </div>
          </foreignObject>
        </motion.g>
      ))}
      <Node
        x={220}
        y={182}
        w={200}
        h={44}
        label="Agent turn"
        sub="retrieve → reason → write back"
        color="#fbbf24"
      />
      <FlowEdge d="M 115 140 Q 150 182 220 198" color="#38bdf8" />
      <FlowEdge d="M 320 140 V 182" color="#a78bfa" />
      <FlowEdge d="M 525 140 Q 490 182 420 198" color="#34d399" />
      <motion.circle
        r={4}
        fill="#fbbf24"
        {...loopMotion(
          playing,
          {
            animate: { cx: 320, cy: [182, 148] },
            transition: {
              duration: 1.4,
              repeat: Infinity,
              repeatType: "reverse",
            },
          },
          { cx: 320, cy: 165 },
        )}
      />
    </Stage>
  );
}

/* ---------- Context folding: evict with a stub, reload at the tail ---------- */
const FOLD_RESULTS = 6; // tool results in the scripted window
const FOLD_STUBS = 4; // the oldest ones are evicted at step 1
const FOLD_W = 58; // width of one tool-result block
const FOLD_STUB_W = 24; // width of its stub once evicted

export function ContextFoldingAnim() {
  const { step } = useAnimPlayback();
  const folded = step >= 1;
  const bx = (i: number) => 232 + i * FOLD_W; // left edge of block i, unfolded
  const reclaimed = (FOLD_W - FOLD_STUB_W) * FOLD_STUBS; // room the fold frees
  const tail = bx(FOLD_RESULTS) - reclaimed; // first free slot after folding
  const captions = [
    "tool results fill the window; the model has already extracted what it needs",
    "fold: r1–r4 move out verbatim, leaving stubs. the cache breaks once, here",
    "the reclaimed space absorbs the next turn; older messages are untouched",
    'reload("r2") appends at the tail: exact bytes back, cached prefix intact',
  ];
  return (
    <Stage viewBox="0 0 640 250">
      <text
        x={55}
        y={24}
        fill="#94a3b8"
        fontSize={12}
        fontFamily="monospace"
      >
        context window (finite budget)
      </text>
      {/* the fold edits history at r1: everything after it re-caches, once */}
      <StepFade opacity={folded ? 1 : 0}>
        <line
          x1={bx(0)}
          y1={34}
          x2={bx(0)}
          y2={92}
          stroke="#f87171"
          strokeDasharray="4 4"
          strokeWidth={1.5}
        />
        <text
          x={585}
          y={24}
          textAnchor="end"
          fill="#f87171"
          fontSize={11}
          fontFamily="monospace"
        >
          ⚠ cache invalid from here (once)
        </text>
      </StepFade>
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
      {/* fixed allocations */}
      <rect
        x={58}
        y={47}
        width={62}
        height={38}
        rx={5}
        fill="#a78bfa59"
        stroke="#a78bfa99"
      />
      <text
        x={89}
        y={70}
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize={9.5}
        fontFamily="monospace"
      >
        system
      </text>
      <rect
        x={124}
        y={47}
        width={104}
        height={38}
        rx={5}
        fill="#38bdf859"
        stroke="#38bdf899"
      />
      <text
        x={176}
        y={70}
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize={9.5}
        fontFamily="monospace"
      >
        turns
      </text>
      {/* tool results: the oldest shrink to stubs and pack together, the
          rest slide left. A stub's box and its label move by different
          amounts (the box narrows from the right), so each gets its own g. */}
      {Array.from({ length: FOLD_RESULTS }, (_, i) => {
        const evicts = i < FOLD_STUBS;
        const slide = folded
          ? evicts
            ? -(FOLD_W - FOLD_STUB_W) * i
            : -reclaimed
          : 0;
        const ease = { duration: 0.45, ease: "easeOut" } as const;
        return (
          <g key={i}>
            <motion.g initial={false} animate={{ x: slide }} transition={ease}>
              <motion.rect
                x={bx(i)}
                y={47}
                height={38}
                rx={5}
                fill="#fbbf24"
                fillOpacity={0.3}
                stroke="#fbbf24"
                strokeOpacity={0.6}
                strokeDasharray={folded && evicts ? "3 3" : undefined}
                initial={false}
                animate={{
                  width: folded && evicts ? FOLD_STUB_W - 4 : FOLD_W - 4,
                }}
                transition={ease}
              />
            </motion.g>
            <motion.g
              initial={false}
              animate={{
                x:
                  slide +
                  (folded && evicts ? -(FOLD_W - FOLD_STUB_W) / 2 : 0),
                opacity: folded && evicts ? 0.8 : 1,
              }}
              transition={ease}
            >
              <text
                x={bx(i) + (FOLD_W - 4) / 2}
                y={70}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize={9.5}
                fontFamily="monospace"
              >
                {`r${i + 1}`}
              </text>
            </motion.g>
          </g>
        );
      })}
      <StepReveal index={1} dim={1}>
        <FlowEdge
          d={`M ${bx(0) + (FOLD_STUB_W * FOLD_STUBS) / 2} 92 V 170 H 368`}
          color="#fbbf24"
        />
        <path d="M 368 165 L 376 170 L 368 175 Z" fill="#fbbf24" />
        <rect
          x={376}
          y={150}
          width={207}
          height={40}
          rx={8}
          fill="none"
          stroke="#fbbf24"
          strokeOpacity={0.5}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text
          x={479}
          y={166}
          textAnchor="middle"
          fill="#e2e8f0"
          fontSize={10.5}
          fontFamily="monospace"
        >
          cold store (outside the window)
        </text>
        <text
          x={479}
          y={181}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize={10}
          fontFamily="monospace"
        >
          r1 r2 r3 r4 — verbatim
        </text>
      </StepReveal>
      {/* free space label: only while the space is still empty */}
      <StepFade opacity={step === 1 ? 1 : 0}>
        <text
          x={tail + 68}
          y={70}
          textAnchor="middle"
          fill="#475569"
          fontSize={10}
          fontFamily="monospace"
        >
          ← reclaimed
        </text>
      </StepFade>
      <StepReveal index={2} dim={1}>
        <rect
          x={tail + 4}
          y={47}
          width={86}
          height={38}
          rx={5}
          fill="#f8717159"
          stroke="#f8717199"
        />
        <text
          x={tail + 47}
          y={70}
          textAnchor="middle"
          fill="#e2e8f0"
          fontSize={9.5}
          fontFamily="monospace"
        >
          new turn
        </text>
      </StepReveal>
      <StepReveal index={3}>
        <FlowEdge d={`M ${tail + 135} 150 V 98`} color="#34d399" />
        <path
          d={`M ${tail + 130} 100 L ${tail + 135} 92 L ${tail + 140} 100 Z`}
          fill="#34d399"
        />
        <rect
          x={tail + 94}
          y={47}
          width={42}
          height={38}
          rx={5}
          fill="#34d39959"
          stroke="#34d39999"
        />
        <text
          x={tail + 115}
          y={70}
          textAnchor="middle"
          fill="#e2e8f0"
          fontSize={9.5}
          fontFamily="monospace"
        >
          r2
        </text>
        {/* everything before the reload is still a cached prefix */}
        <line
          x1={58}
          y1={100}
          x2={tail + 90}
          y2={100}
          stroke="#34d399"
          strokeWidth={1.5}
        />
        <text
          x={(58 + tail + 90) / 2}
          y={114}
          textAnchor="middle"
          fill="#34d399"
          fontSize={10.5}
          fontFamily="monospace"
        >
          cached prefix — untouched by the reload
        </text>
      </StepReveal>
      {captions.map((c, i) => (
        <StepFade key={i} opacity={step === i ? 1 : 0}>
          <text
            x={320}
            y={236}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={10.5}
            fontFamily="monospace"
          >
            {c}
          </text>
        </StepFade>
      ))}
    </Stage>
  );
}
