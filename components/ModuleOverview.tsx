"use client";

import Link from "next/link";
import clsx from "clsx";
import { getModule } from "@/content/registry";
import { useProgress } from "@/lib/progress";
import { PASS_THRESHOLD } from "@/lib/types";
import ResourceList from "./ResourceList";

export default function ModuleOverview({ moduleSlug }: { moduleSlug: string }) {
  const mod = getModule(moduleSlug)!;
  const { completedLessons, moduleStats, ready } = useProgress();
  const stats = ready ? moduleStats(mod.slug) : null;

  return (
    <div>
      <div className="text-xs font-semibold text-slate-600">
        Module {mod.id} · Phase {mod.phase}: {mod.phaseTitle} · {mod.weeks}
      </div>
      <h1 className="mt-1 text-3xl font-extrabold text-slate-100">
        {mod.title}
      </h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-slate-400">
        {mod.description}
      </p>

      <div className="border-border bg-card mt-6 rounded-xl border p-5">
        <div className="mb-3 text-sm font-bold tracking-wider text-sky-400 uppercase">
          After this module you can
        </div>
        <ul className="space-y-2">
          {mod.outcomes.map((o, i) => (
            <li
              key={i}
              className="flex gap-2 text-sm leading-relaxed text-slate-300"
            >
              <span className="mt-0.5 text-sky-400">▸</span>
              <span>{o}</span>
            </li>
          ))}
        </ul>
      </div>

      <h2 className="mt-10 mb-4 text-lg font-bold text-slate-200">Lessons</h2>
      <div className="space-y-3">
        {mod.lessons.map((l, i) => {
          const done = !!completedLessons[`${mod.slug}/${l.slug}`];
          return (
            <Link
              key={l.slug}
              href={`/modules/${mod.slug}/lessons/${l.slug}`}
              className="group border-border bg-card flex items-center gap-4 rounded-xl border p-4 transition-colors hover:border-sky-500/50"
            >
              <span
                className={clsx(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                  done
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-white/5 text-slate-500",
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-200 group-hover:text-sky-300">
                  {l.title}
                </div>
                <div className="mt-0.5 line-clamp-1 text-sm text-slate-500">
                  {l.summary}
                </div>
              </div>
              <span className="shrink-0 text-xs text-slate-600">
                {l.minutes} min
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href={`/modules/${mod.slug}/quiz`}
          className="rounded-xl border border-violet-500/40 bg-violet-500/5 p-5 transition-colors hover:border-violet-400"
        >
          <div className="font-bold text-violet-300">Module quiz</div>
          <div className="mt-1 text-sm text-slate-500">
            {mod.quiz.length} questions · pass ≥{" "}
            {Math.round(PASS_THRESHOLD * 100)}%
          </div>
          {stats?.quizBest != null && (
            <div
              className={clsx(
                "mt-2 text-sm font-bold",
                stats.quizPassed ? "text-emerald-400" : "text-amber-400",
              )}
            >
              Best: {Math.round(stats.quizBest * 100)}%{" "}
              {stats.quizPassed && "✓ passed"}
            </div>
          )}
        </Link>
        <Link
          href={`/modules/${mod.slug}/lab`}
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5 transition-colors hover:border-emerald-400"
        >
          <div className="font-bold text-emerald-300">
            Lab: {mod.lab.title}
            {mod.lab.portfolio && (
              <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
                portfolio
              </span>
            )}
          </div>
          <div className="mt-1 line-clamp-2 text-sm text-slate-500">
            {mod.lab.objective}
          </div>
          {stats?.labDone && (
            <div className="mt-2 text-sm font-bold text-emerald-400">
              ✓ completed
            </div>
          )}
        </Link>
      </div>

      <h2 className="mt-10 mb-1 text-lg font-bold text-slate-200">
        Best external resources
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        Curated reading, docs, and tools that pair with this module.
      </p>
      <ResourceList resources={mod.resources} />
    </div>
  );
}
