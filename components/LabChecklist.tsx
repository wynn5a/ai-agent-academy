"use client";

import clsx from "clsx";
import { useProgress } from "@/lib/progress";

/**
 * Interactive acceptance-criteria checklist. Checked state persists in
 * localStorage per module, and LabActions uses it to gate "mark complete" —
 * the same discipline a hiring manager expects from a portfolio README's
 * "how I verified this" section.
 */
export default function LabChecklist({
  moduleSlug,
  criteria,
}: {
  moduleSlug: string;
  criteria: string[];
}) {
  const { labChecks, toggleLabCheck, ready } = useProgress();
  const checks = labChecks[moduleSlug] ?? {};
  const checkedCount = criteria.filter((_, i) => checks[i]).length;
  const allChecked = checkedCount === criteria.length;

  return (
    <div
      className={clsx(
        "mt-10 rounded-xl border p-5 transition-colors",
        allChecked
          ? "border-emerald-500/50 bg-emerald-500/10"
          : "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-bold tracking-wider text-emerald-400 uppercase">
          Acceptance criteria — all must pass
        </div>
        <div className="font-mono text-xs text-slate-500" aria-live="polite">
          {checkedCount}/{criteria.length} verified
        </div>
      </div>
      <ul className="space-y-1">
        {criteria.map((c, i) => {
          const checked = !!checks[i];
          return (
            <li key={i}>
              <label
                className={clsx(
                  "flex cursor-pointer gap-3 rounded-lg px-2 py-1.5 text-sm leading-relaxed transition-colors hover:bg-white/[0.04]",
                  checked ? "text-slate-400" : "text-slate-300",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!ready}
                  onChange={() => toggleLabCheck(moduleSlug, i)}
                  className="mt-1 h-4 w-4 shrink-0 accent-emerald-500"
                />
                <span
                  className={clsx(
                    checked && "line-through decoration-slate-600",
                  )}
                >
                  {c}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
