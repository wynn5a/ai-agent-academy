import React from "react";
import type { Section, CalloutKind } from "@/lib/types";
import { renderInline } from "@/lib/markdown";
import CodeBlock from "./CodeBlock";
import Exercise from "./Exercise";
import ConceptAnimation from "./animations/ConceptAnimation";

const CALLOUT_STYLES: Record<
  CalloutKind,
  { border: string; bg: string; label: string; icon: string }
> = {
  info: {
    border: "border-sky-500/40",
    bg: "bg-sky-500/5",
    label: "Note",
    icon: "ℹ",
  },
  tip: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/5",
    label: "Tip",
    icon: "✦",
  },
  warning: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/5",
    label: "Watch out",
    icon: "⚠",
  },
  danger: {
    border: "border-red-500/40",
    bg: "bg-red-500/5",
    label: "Danger",
    icon: "✕",
  },
  insight: {
    border: "border-violet-500/40",
    bg: "bg-violet-500/5",
    label: "Key insight",
    icon: "◆",
  },
};

export default function SectionRenderer({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-1">
      {sections.map((s, i) => {
        switch (s.type) {
          case "heading":
            return (
              <h2
                key={i}
                className="mt-10 mb-3 text-xl font-bold text-slate-100"
              >
                {s.text}
              </h2>
            );
          case "paragraph":
            return (
              <p key={i} className="my-4 leading-relaxed text-slate-300">
                {renderInline(s.text)}
              </p>
            );
          case "list": {
            const cls = "my-4 space-y-2 pl-6 leading-relaxed text-slate-300";
            return s.ordered ? (
              <ol key={i} className={`${cls} list-decimal marker:text-sky-500`}>
                {s.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ol>
            ) : (
              <ul key={i} className={`${cls} list-disc marker:text-sky-500`}>
                {s.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ul>
            );
          }
          case "callout": {
            const st = CALLOUT_STYLES[s.kind];
            return (
              <div
                key={i}
                className={`my-6 rounded-xl border ${st.border} ${st.bg} px-4 py-3`}
              >
                <div className="mb-1 text-xs font-bold tracking-wider text-slate-400 uppercase">
                  {st.icon} {s.title ?? st.label}
                </div>
                <div className="text-sm leading-relaxed text-slate-300">
                  {renderInline(s.text)}
                </div>
              </div>
            );
          }
          case "code":
            return (
              <CodeBlock
                key={i}
                language={s.language}
                title={s.title}
                code={s.code}
                explanation={s.explanation}
              />
            );
          case "table":
            return (
              <div
                key={i}
                className="border-border my-6 overflow-x-auto rounded-xl border"
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border border-b bg-white/[0.03]">
                      {s.headers.map((h, j) => (
                        <th
                          key={j}
                          className="px-4 py-2.5 text-left font-semibold text-slate-200"
                        >
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((row, j) => (
                      <tr
                        key={j}
                        className="border-border/50 border-b last:border-0"
                      >
                        {row.map((cell, k) => (
                          <td
                            key={k}
                            className="px-4 py-2.5 align-top text-slate-400"
                          >
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "animation":
            return (
              <ConceptAnimation key={i} name={s.name} caption={s.caption} />
            );
          case "keypoints":
            return (
              <div
                key={i}
                className="my-6 rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-violet-500/5 p-5"
              >
                <div className="mb-3 text-sm font-bold tracking-wider text-sky-400 uppercase">
                  {s.title ?? "Key takeaways"}
                </div>
                <ul className="space-y-2">
                  {s.points.map((p, j) => (
                    <li
                      key={j}
                      className="flex gap-2 text-sm leading-relaxed text-slate-300"
                    >
                      <span className="mt-0.5 text-sky-400">▸</span>
                      <span>{renderInline(p)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          case "exercise":
            return (
              <Exercise
                key={i}
                kind={s.kind}
                prompt={s.prompt}
                code={s.code}
                language={s.language}
                answer={s.answer}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
