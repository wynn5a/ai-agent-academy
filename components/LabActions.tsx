"use client";

import clsx from "clsx";
import { useProgress } from "@/lib/progress";

export default function LabActions({
  moduleSlug,
  criteriaCount,
}: {
  moduleSlug: string;
  criteriaCount: number;
}) {
  const { labsDone, toggleLab, labChecks } = useProgress();
  const done = !!labsDone[moduleSlug];
  const checks = labChecks[moduleSlug] ?? {};
  const checkedCount = Array.from(
    { length: criteriaCount },
    (_, i) => checks[i],
  ).filter(Boolean).length;
  const allChecked = checkedCount === criteriaCount;
  // completing requires verifying every criterion first; undoing is always allowed
  const locked = !done && !allChecked;

  return (
    <div className="mt-8">
      <button
        onClick={() => toggleLab(moduleSlug)}
        disabled={locked}
        className={clsx(
          "w-full rounded-xl border px-6 py-3 text-sm font-bold transition-colors",
          done
            ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
            : locked
              ? "border-border cursor-not-allowed bg-white/[0.02] text-slate-600"
              : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
        )}
      >
        {done
          ? "✓ Lab completed — click to undo"
          : locked
            ? `Verify all acceptance criteria to unlock (${checkedCount}/${criteriaCount})`
            : "All criteria verified — mark lab complete"}
      </button>
      <p className="mt-2 text-center text-xs text-slate-600">
        Be honest — the gates only mean something if the criteria really pass.
      </p>
    </div>
  );
}
