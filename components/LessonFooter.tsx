"use client";

import Link from "next/link";
import clsx from "clsx";
import { useProgress } from "@/lib/progress";

export default function LessonFooter({
  moduleSlug,
  lessonSlug,
  prevHref,
  prevTitle,
  nextHref,
  nextTitle,
}: {
  moduleSlug: string;
  lessonSlug: string;
  prevHref: string | null;
  prevTitle: string | null;
  nextHref: string;
  nextTitle: string;
}) {
  const { completedLessons, toggleLesson } = useProgress();
  const done = !!completedLessons[`${moduleSlug}/${lessonSlug}`];

  return (
    <footer className="border-border mt-12 border-t pt-6">
      <button
        onClick={() => toggleLesson(moduleSlug, lessonSlug)}
        className={clsx(
          "w-full rounded-xl border px-6 py-3 text-sm font-bold transition-colors",
          done
            ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
            : "border-sky-500/60 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20",
        )}
      >
        {done ? "✓ Lesson completed — click to undo" : "Mark lesson complete"}
      </button>
      <div className="mt-4 flex justify-between gap-4 text-sm">
        {prevHref ? (
          <Link href={prevHref} className="text-slate-500 hover:text-sky-400">
            ← {prevTitle}
          </Link>
        ) : (
          <span />
        )}
        <Link
          href={nextHref}
          className="text-right text-slate-400 hover:text-sky-400"
        >
          {nextTitle} →
        </Link>
      </div>
    </footer>
  );
}
