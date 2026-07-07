"use client";

import { useProgress } from "@/lib/progress";

/** Persisted free-form notes for a lab: repo URL, demo link, reflections.
 *  Especially useful on portfolio-flagged labs, where the artifact lives
 *  outside this site. Stored in localStorage with the rest of progress. */
export default function LabNotes({ moduleSlug }: { moduleSlug: string }) {
  const { labNotes, setLabNote, ready } = useProgress();
  const value = labNotes[moduleSlug] ?? "";

  return (
    <div className="border-border bg-card mt-6 rounded-xl border p-5">
      <div className="mb-1 text-sm font-bold tracking-wider text-slate-500 uppercase">
        Your work
      </div>
      <p className="mb-3 text-xs leading-relaxed text-slate-600">
        Repo URL, demo link, notes to your future self — saved locally with your
        progress, and handy when you package the portfolio.
      </p>
      <textarea
        value={value}
        onChange={(e) => setLabNote(moduleSlug, e.target.value)}
        disabled={!ready}
        rows={4}
        placeholder="https://github.com/you/lab-repo — what worked, what you'd improve next..."
        className="border-border w-full resize-y rounded-lg border bg-white/[0.02] px-3 py-2 text-sm leading-relaxed text-slate-300 placeholder:text-slate-600 focus:border-sky-500/60 focus:outline-none"
      />
    </div>
  );
}
