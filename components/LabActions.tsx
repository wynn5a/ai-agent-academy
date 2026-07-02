"use client";

import clsx from "clsx";
import { useProgress } from "@/lib/progress";

export default function LabActions({ moduleSlug }: { moduleSlug: string }) {
  const { labsDone, toggleLab } = useProgress();
  const done = !!labsDone[moduleSlug];

  return (
    <div className="mt-8">
      <button
        onClick={() => toggleLab(moduleSlug)}
        className={clsx(
          "w-full rounded-xl border px-6 py-3 text-sm font-bold transition-colors",
          done
            ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
            : "border-border bg-card text-slate-300 hover:border-emerald-500/50",
        )}
      >
        {done
          ? "✓ Lab completed — click to undo"
          : "I've met all acceptance criteria — mark lab complete"}
      </button>
      <p className="mt-2 text-center text-xs text-slate-600">
        Be honest — the gates only mean something if the criteria really pass.
      </p>
    </div>
  );
}
