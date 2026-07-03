"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { renderInline } from "@/lib/markdown";
import CodeBlock from "./CodeBlock";

type ExerciseKind = "predict" | "spot-the-bug" | "concept";

const KIND_STYLES: Record<ExerciseKind, { label: string; badge: string }> = {
  predict: {
    label: "Predict the output",
    badge: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  },
  "spot-the-bug": {
    label: "Spot the bug",
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  },
  concept: {
    label: "Check yourself",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  },
};

export default function Exercise({
  kind,
  prompt,
  code,
  language,
  answer,
}: {
  kind: ExerciseKind;
  prompt: string;
  code?: string;
  language?: string;
  answer: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const st = KIND_STYLES[kind];

  return (
    <div className="border-border my-6 rounded-xl border bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase ${st.badge}`}
        >
          {st.label}
        </span>
      </div>
      <div className="leading-relaxed text-slate-300">
        {renderInline(prompt)}
      </div>
      {code && <CodeBlock language={language ?? "python"} code={code} />}
      <button
        onClick={() => setRevealed((r) => !r)}
        className="border-border mt-4 rounded-lg border px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
      >
        {revealed ? "Hide answer" : "Reveal answer"}
      </button>
      <AnimatePresence initial={false}>
        {revealed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm leading-relaxed text-slate-300">
              {renderInline(answer)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
