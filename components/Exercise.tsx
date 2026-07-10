"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { renderInline } from "@/lib/markdown";
import { PROVIDER_META, type ProviderPref } from "@/lib/provider";
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

// Answers are authored as " | "-separated parts. Within a part:
//  - an inline list — "(1) (2)…", "(a) (b)…", or "1. 2.…" — becomes a vertical list
//  - a "follow-up probe" — one or more interviewer Qs + your As — becomes Q/A blocks.
//    Three prefixes occur across the course and may carry multiple Q/A pairs:
//      **Follow-up probe:**  "q" → a              (single)
//      **Follow-up probes:** "q1" → a1; "q2" → a2 (multi, arrow answers)
//      **Probes to expect:** "q1" (a1), "q2" (a2) (multi, parenthetical answers)
// Module 1 splits probes into their own " | "-delimited part; modules 2-8 often
// embed the probe inline after the body, so a part may carry BOTH body and probe.
const PROBE_PREFIX_RE = /\*\*(?:Follow-up probes?|Probes to expect):\*\*/;
const PROBE_FULL_RE = /^\*\*(?:Follow-up probes?|Probes to expect):\*\*\s*([\s\S]+)$/;

type Probe = { q: string; a: string };

/** Strip joiners (";", ",", ", and") and an answer's leading marker (→ or (…)). */
function trimAnswer(seg: string): string {
  let a = seg.trim();
  a = a.replace(/[;,]$/, "").replace(/,\s*and$/i, "").trim();
  a = a.replace(/^→\s*/, "");
  a = a.replace(/^\(([^]*)\)[.,]?$/, "$1").trim();
  return a;
}

/** Parse a probe string into one or more {q, a} pairs. Returns null if not a probe. */
function parseProbes(probeStr: string): Probe[] | null {
  const m = probeStr.match(PROBE_FULL_RE);
  if (!m) return null;
  const body = m[1];
  const quotes = [...body.matchAll(/"([^"]+)"/g)];
  if (quotes.length === 0) return null;
  const pairs: Probe[] = [];
  for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i][1];
    const start = quotes[i].index + quotes[i][0].length;
    const end = i + 1 < quotes.length ? quotes[i + 1].index : body.length;
    const a = trimAnswer(body.slice(start, end));
    pairs.push({ q, a });
  }
  return pairs;
}

// Inline list styles, in priority order. `markerRe` identifies an item;
// `splitRe` finds item boundaries. A part must contain at least two items
// to count as a list, so a stray "(1)" never misfires.
const LIST_STYLES = [
  {
    name: "paren-num" as const,
    splitRe: /\s+(?=\([1-9]\)\s)/,
    markerRe: /^\(([1-9])\)\s*/,
  },
  {
    name: "paren-letter" as const,
    splitRe: /\s+(?=\([a-z]\)\s)/,
    markerRe: /^\(([a-z])\)\s*/,
  },
  {
    name: "dot-num" as const,
    splitRe: /\s+(?=[1-9]\.\s)/,
    markerRe: /^([1-9])\.\s*/,
  },
];

type ParsedList = { intro: string; items: string[]; labels: string[] };

/** Ordinal of a marker capture: "3" → 3, "c" → 3 (both 1-based). */
function markerOrdinal(mark: string): number {
  return /^[0-9]$/.test(mark) ? Number(mark) : mark.toLowerCase().charCodeAt(0) - 96;
}

/** Split a part on its first probe prefix → body + (probe string | null). */
function splitBodyAndProbe(part: string): { body: string; probePart: string | null } {
  const idx = part.search(PROBE_PREFIX_RE);
  if (idx === -1) return { body: part, probePart: null };
  return { body: part.slice(0, idx).trim(), probePart: part.slice(idx) };
}

/** Detect an inline list in any supported style; split into lead-in + items. */
function parseItemList(text: string): ParsedList | null {
  for (const s of LIST_STYLES) {
    const startsWithMarker = s.markerRe.test(text);
    const hasBoundary = text.search(s.splitRe) !== -1;
    if (!startsWithMarker && !hasBoundary) continue;
    const chunks = text.split(s.splitRe).map((c) => c.trim()).filter(Boolean);
    let intro = "";
    let markerChunks: string[];
    // a leading chunk with no marker is a lead-in (e.g. "Three inputs: (a)… (b)…")
    if (chunks.length && !s.markerRe.test(chunks[0])) {
      intro = chunks[0];
      markerChunks = chunks.slice(1);
    } else {
      markerChunks = chunks;
    }
    // Coalesce false boundaries: a marker that isn't the next in sequence is an
    // inline back-reference (e.g. "…reference by file_id. But (c) still bills…"
    // inside item (c)), not a new item — merge it into the current item.
    const items: string[] = [];
    let expected = -1;
    for (const chunk of markerChunks) {
      const m = chunk.match(s.markerRe);
      const ord = m ? markerOrdinal(m[1]) : -1;
      if (items.length && ord !== expected + 1) {
        items[items.length - 1] += " " + chunk;
      } else {
        items.push(chunk);
        expected = ord;
      }
    }
    if (items.length < 2) continue; // a single item isn't a list
    // Keep each item's source marker as its label ("a"→"A", "3"→"3") so a
    // lettered answer renders A/B/C — matching the (a)/(b)/(c) prompt — instead
    // of being renumbered 1/2/3.
    const labels = items.map((it) => {
      const m = it.match(s.markerRe);
      return m && /^[a-z]$/.test(m[1]) ? m[1].toUpperCase() : (m?.[1] ?? "");
    });
    return {
      intro,
      items: items.map((it) => it.replace(s.markerRe, "").trim()),
      labels,
    };
  }
  return null;
}

const LABELED_ITEM_RE = /\*\*[^*]+\*\*:/g;

/**
 * Detect a "labeled list": 2+ bold-label segments such as
 * "**Calibrate**: … **De-bias by construction**: … **Monitor**: …".
 * Text before the first label is a lead-in; items keep their labels so the
 * bold term reads as the item heading. Numbered lists are handled first by
 * parseItemList, so this only fires on label-only structure.
 */
function parseLabeledList(text: string): ParsedList | null {
  const matches = [...text.matchAll(LABELED_ITEM_RE)];
  if (matches.length < 2) return null;
  const intro = text.slice(0, matches[0].index).trim();
  const items: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    items.push(text.slice(start, end).trim());
  }
  return { intro, items, labels: [] }; // rendered as bullets; labels unused
}

export default function Exercise({
  kind,
  prompt,
  code,
  language,
  answer,
  provider,
}: {
  kind: ExerciseKind;
  prompt: string;
  code?: string;
  language?: string;
  answer: string;
  provider?: ProviderPref;
}) {
  const [revealed, setRevealed] = useState(false);
  const st = KIND_STYLES[kind];
  const pm = provider ? PROVIDER_META[provider] : null;
  const answerParts = answer
    .split(" | ")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="border-border my-6 rounded-xl border bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase ${st.badge}`}
        >
          {st.label}
        </span>
        {pm && (
          <span className="border-border inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${pm.dot}`} />
            {pm.label} SDK
          </span>
        )}
      </div>
      <div className="text-[0.95rem] leading-relaxed text-slate-200">
        {renderInline(prompt)}
      </div>
      {code && <CodeBlock language={language ?? "python"} code={code} />}
      <button
        onClick={() => setRevealed((r) => !r)}
        className="border-border mt-4 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5"
        aria-expanded={revealed}
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
            <div className="mt-4 overflow-hidden rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] px-5 py-4">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="text-[0.7rem] font-bold uppercase tracking-wider text-emerald-400/80">
                  Answer
                </span>
                <span className="h-px flex-1 bg-emerald-500/15" />
              </div>
              <div className="space-y-4">
                {answerParts.map((part, i) => {
                  // A part may carry an inline probe after the body
                  // (modules 2-8 style) — split it off first.
                  const { body, probePart } = splitBodyAndProbe(part);
                  const probes = probePart ? parseProbes(probePart) : null;
                      // The body, in turn, may be an inline list, a labeled
                      // list, or plain prose (checked in that priority order).
                      const list = body ? parseItemList(body) : null;
                      const labeled = !list && body ? parseLabeledList(body) : null;
                      const hasBody = body.length > 0;

                  return (
                    <div key={i} className="space-y-4">
                      {/* Body: numbered/lettered inline list */}
                      {hasBody && list && (
                        <div className="border-l-2 border-emerald-400/40 pl-4">
                          {list.intro && (
                            <p className="mb-3 text-[0.95rem] leading-relaxed text-slate-200 [&_strong]:text-slate-50">
                              {renderInline(list.intro)}
                            </p>
                          )}
                          <ol className="space-y-2.5">
                            {list.items.map((item, n) => (
                              <li
                                key={n}
                                className="flex gap-3 text-[0.95rem] leading-relaxed text-slate-200"
                              >
                                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500/15 text-[0.7rem] font-bold text-emerald-300">
                                  {list.labels[n] || n + 1}
                                </span>
                                <span className="[&_strong]:text-slate-50">
                                  {renderInline(item)}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {/* Body: labeled list (e.g. **Calibrate** / **Monitor**) */}
                      {hasBody && !list && labeled && (
                        <div className="border-l-2 border-emerald-400/40 pl-4">
                          {labeled.intro && (
                            <p className="mb-3 text-[0.95rem] leading-relaxed text-slate-200 [&_strong]:text-slate-50">
                              {renderInline(labeled.intro)}
                            </p>
                          )}
                          <ul className="space-y-3">
                            {labeled.items.map((item, n) => (
                              <li
                                key={n}
                                className="relative pl-4 text-[0.95rem] leading-relaxed text-slate-200"
                              >
                                <span className="absolute left-0 top-[0.6em] h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
                                <span className="[&_strong]:text-slate-50 [&_strong]:font-semibold">
                                  {renderInline(item)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* Body: plain prose */}
                      {hasBody && !list && !labeled && (
                        <div className="border-l-2 border-emerald-400/40 pl-4 text-[0.95rem] leading-relaxed text-slate-200 [&_strong]:text-slate-50">
                          {renderInline(body)}
                        </div>
                      )}

                      {/* Probes: one or more interviewer Q + your A blocks */}
                      {probes && (
                        <div className="rounded-lg border border-dashed border-emerald-400/30 bg-emerald-500/[0.03] px-4 py-3.5">
                          <div className="mb-3 text-[0.7rem] font-bold uppercase tracking-wider text-emerald-400/70">
                            ↳{" "}
                            {probes.length > 1
                              ? "Follow-up probes"
                              : "Follow-up probe"}
                          </div>
                          <div className="space-y-3.5">
                            {probes.map((p, n) => (
                              <div key={n}>
                                <p className="text-[0.95rem] italic leading-relaxed text-slate-400">
                                  <span className="mr-1.5 not-italic font-bold text-emerald-400/80">
                                    Q.
                                  </span>
                                  {renderInline(p.q)}
                                </p>
                                <p className="mt-2.5 text-[0.95rem] leading-relaxed text-slate-200 [&_strong]:text-slate-50">
                                  <span className="mr-1.5 font-bold text-emerald-400/80">
                                    A.
                                  </span>
                                  {renderInline(p.a)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
