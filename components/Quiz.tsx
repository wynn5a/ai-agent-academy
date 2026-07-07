"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { QuizQuestion } from "@/lib/types";
import { PASS_THRESHOLD } from "@/lib/types";
import { useProgress } from "@/lib/progress";
import { renderInline } from "@/lib/markdown";

export default function Quiz({
  moduleSlug,
  questions,
}: {
  moduleSlug: string;
  questions: QuizQuestion[];
}) {
  const { recordQuiz, quizScores } = useProgress();
  const [answers, setAnswers] = useState<(number | null)[]>(
    questions.map(() => null),
  );
  const [submitted, setSubmitted] = useState(false);

  const answered = answers.filter((a) => a !== null).length;
  const correct = submitted
    ? answers.filter((a, i) => a === questions[i].correct).length
    : 0;
  const score = questions.length ? correct / questions.length : 0;
  const best = quizScores[moduleSlug];

  const submit = () => {
    setSubmitted(true);
    const c = answers.filter((a, i) => a === questions[i].correct).length;
    recordQuiz(moduleSlug, questions.length ? c / questions.length : 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const retry = () => {
    setAnswers(questions.map(() => null));
    setSubmitted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const missed = submitted
    ? questions
        .map((_, i) => i)
        .filter((i) => answers[i] !== questions[i].correct)
    : [];

  const jumpTo = (qi: number) =>
    document
      .getElementById(`quiz-q-${qi}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });

  const firstUnanswered = answers.findIndex((a) => a === null);

  return (
    <div>
      {best !== undefined && !submitted && (
        <div className="border-border bg-card mb-6 rounded-xl border px-4 py-3 text-sm text-slate-400">
          Best score so far:{" "}
          <span
            className={clsx(
              "font-bold",
              best >= PASS_THRESHOLD ? "text-emerald-400" : "text-amber-400",
            )}
          >
            {Math.round(best * 100)}%
          </span>{" "}
          {best >= PASS_THRESHOLD
            ? "— passed ✓"
            : `— need ${Math.round(PASS_THRESHOLD * 100)}% to pass`}
          {best >= PASS_THRESHOLD && (
            <Link
              href={`/modules/${moduleSlug}/lab`}
              className="ml-2 font-medium text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
            >
              Next: the lab →
            </Link>
          )}
        </div>
      )}

      {submitted && (
        <div
          className={clsx(
            "mb-8 rounded-xl border p-5",
            score >= PASS_THRESHOLD
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-amber-500/40 bg-amber-500/10",
          )}
        >
          <div className="text-2xl font-extrabold text-slate-100">
            {correct}/{questions.length} correct — {Math.round(score * 100)}%
          </div>
          <div className="mt-1 text-sm text-slate-400">
            {score >= PASS_THRESHOLD
              ? "Passed. This counts toward your checkpoint gate."
              : `Below the ${Math.round(PASS_THRESHOLD * 100)}% pass bar. Review the explanations below, revisit the lessons, then retry.`}
          </div>
          {missed.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Review misses:
              </span>
              {missed.map((qi) => (
                <button
                  key={qi}
                  onClick={() => jumpTo(qi)}
                  className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-mono text-xs text-red-300 transition-colors hover:bg-red-500/20"
                >
                  Q{qi + 1}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={retry}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/15"
            >
              Retry quiz
            </button>
            {score >= PASS_THRESHOLD && (
              <Link
                href={`/modules/${moduleSlug}/lab`}
                className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-500/30"
              >
                Next: the lab →
              </Link>
            )}
          </div>
        </div>
      )}

      <ol className="space-y-8">
        {questions.map((q, qi) => {
          const chosen = answers[qi];
          const gotIt = submitted && chosen === q.correct;
          return (
            <li
              key={qi}
              id={`quiz-q-${qi}`}
              className={clsx(
                "border-border bg-card scroll-mt-24 rounded-xl border p-5",
                submitted && !gotIt && "border-red-500/30",
              )}
            >
              <div className="mb-4 flex items-start gap-2 leading-relaxed font-medium text-slate-200">
                <span className="text-slate-500">{qi + 1}.</span>
                <span className="flex-1">{renderInline(q.question)}</span>
                {submitted && (
                  <span
                    className={clsx(
                      "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
                      gotIt
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400",
                    )}
                  >
                    {gotIt ? "✓" : "✗"}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const isChosen = chosen === oi;
                  const isCorrect = q.correct === oi;
                  return (
                    <button
                      key={oi}
                      disabled={submitted}
                      onClick={() =>
                        setAnswers((prev) =>
                          prev.map((a, i) => (i === qi ? oi : a)),
                        )
                      }
                      className={clsx(
                        "block w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-colors",
                        submitted &&
                          isCorrect &&
                          "border-emerald-500/60 bg-emerald-500/10 text-emerald-300",
                        submitted &&
                          isChosen &&
                          !isCorrect &&
                          "border-red-500/60 bg-red-500/10 text-red-300",
                        submitted &&
                          !isChosen &&
                          !isCorrect &&
                          "border-border text-slate-500",
                        !submitted &&
                          isChosen &&
                          "border-sky-500/60 bg-sky-500/10 text-sky-200",
                        !submitted &&
                          !isChosen &&
                          "border-border text-slate-300 hover:border-slate-600 hover:bg-white/[0.03]",
                      )}
                    >
                      <span className="mr-2 font-mono text-xs text-slate-500">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      {renderInline(opt)}
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <div className="border-border mt-4 rounded-lg border bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-slate-400">
                  <span className="font-semibold text-slate-300">Why: </span>
                  {renderInline(q.explanation)}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!submitted && (
        <div className="sticky bottom-4 mt-8 space-y-2">
          {answered > 0 && answered < questions.length && (
            <button
              onClick={() => jumpTo(firstUnanswered)}
              className="border-border bg-bg/90 mx-auto block rounded-full border px-4 py-1.5 text-xs text-slate-400 shadow-lg backdrop-blur transition-colors hover:text-sky-300"
            >
              ↓ Jump to next unanswered (Q{firstUnanswered + 1})
            </button>
          )}
          <button
            onClick={submit}
            disabled={answered < questions.length}
            className={clsx(
              "w-full rounded-xl px-6 py-3 text-sm font-bold shadow-lg transition-colors",
              answered < questions.length
                ? "cursor-not-allowed bg-white/5 text-slate-600"
                : "bg-sky-500 text-slate-950 hover:bg-sky-400",
            )}
          >
            {answered < questions.length
              ? `Answer all questions (${answered}/${questions.length})`
              : "Submit answers"}
          </button>
        </div>
      )}
    </div>
  );
}
