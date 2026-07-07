"use client";

import Link from "next/link";
import clsx from "clsx";
import { modules, PHASES } from "@/content/registry";
import { GATES } from "@/lib/types";
import { useProgress } from "@/lib/progress";

function Ring({ percent }: { percent: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="#232f47"
        strokeWidth="5"
      />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke={percent >= 100 ? "#34d399" : "#38bdf8"}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - percent / 100)}
        transform="rotate(-90 26 26)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text
        x="26"
        y="30"
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize="11"
        fontWeight="700"
      >
        {percent}%
      </text>
    </svg>
  );
}

export default function Dashboard() {
  const { moduleStats, gatePassed, ready, completedLessons } = useProgress();

  const overall = ready
    ? Math.round(
        modules.reduce((acc, m) => acc + moduleStats(m.slug).percent, 0) /
          modules.length,
      )
    : 0;

  // First incomplete step across the curriculum, in order: lessons → quiz → lab.
  let resume: { href: string; label: string } | null = null;
  if (ready) {
    for (const m of modules) {
      const s = moduleStats(m.slug);
      if (s.lessonsDone < s.lessonsTotal) {
        const lesson = m.lessons.find(
          (l) => !completedLessons[`${m.slug}/${l.slug}`],
        );
        if (lesson) {
          resume = {
            href: `/modules/${m.slug}/lessons/${lesson.slug}`,
            label: `Module ${m.id} · ${lesson.title}`,
          };
          break;
        }
      }
      if (!s.quizPassed) {
        resume = {
          href: `/modules/${m.slug}/quiz`,
          label: `Module ${m.id} · quiz`,
        };
        break;
      }
      if (!s.labDone) {
        resume = {
          href: `/modules/${m.slug}/lab`,
          label: `Module ${m.id} · lab`,
        };
        break;
      }
    }
  }

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-100">
          26 Weeks to Senior AI Agent Engineer
        </h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-slate-400">
          Framework-agnostic first: raw APIs → the agent loop → RAG → memory →
          multi-agent → MCP → production evals → a capstone coding agent. ~5
          hrs/week. Every module ends with a quiz (pass ≥ 80%) and a hands-on
          lab.
        </p>
        <div className="border-border bg-card mt-5 rounded-xl border p-4">
          <div className="flex items-center gap-4">
            <Ring percent={overall} />
            <div>
              <div className="font-bold text-slate-200">Overall progress</div>
              <div className="text-sm text-slate-500">
                Lessons 60% · quiz 25% · lab 15% per module
              </div>
            </div>
            <div className="ml-auto flex gap-2">
              {GATES.map((g) => {
                const passed = ready && gatePassed(g.id);
                return (
                  <div
                    key={g.id}
                    title={g.requirement}
                    className={clsx(
                      "rounded-lg border px-2.5 py-1 text-xs font-bold",
                      passed
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : "border-border text-slate-600",
                    )}
                  >
                    {g.id} {passed ? "✓" : "🔒"}
                  </div>
                );
              })}
            </div>
          </div>
          {resume && (
            <Link
              href={resume.href}
              className="mt-4 block rounded-lg bg-sky-500 px-4 py-2.5 text-center text-sm font-bold text-slate-950 transition-colors hover:bg-sky-400"
            >
              {overall === 0 ? "Start here" : "Continue"}: {resume.label} →
            </Link>
          )}
        </div>
      </div>

      {PHASES.map((phase) => (
        <section key={phase.id} className="mb-10">
          <div className="mb-4 flex items-baseline gap-3">
            <h2 className="text-lg font-bold text-slate-200">
              Phase {phase.id} — {phase.title}
            </h2>
            <span className="text-xs text-slate-600">{phase.weeks}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {modules
              .filter((m) => m.phase === phase.id)
              .map((m) => {
                const stats = ready ? moduleStats(m.slug) : null;
                return (
                  <Link
                    key={m.slug}
                    href={`/modules/${m.slug}`}
                    className="group border-border bg-card rounded-xl border p-5 transition-colors hover:border-sky-500/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-600">
                          Module {m.id} · {m.weeks}
                        </div>
                        <div className="mt-1 font-bold text-slate-100 group-hover:text-sky-300">
                          {m.title}
                        </div>
                      </div>
                      {stats && <Ring percent={stats.percent} />}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">
                      {m.description}
                    </p>
                    <div className="mt-3 flex gap-4 text-xs text-slate-600">
                      <span>{m.lessons.length} lessons</span>
                      <span>{m.quiz.length} quiz Qs</span>
                      <span>
                        Lab{m.lab.portfolio ? " · portfolio" : ""}
                        {stats?.labDone ? " ✓" : ""}
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>
      ))}

      <section className="border-border bg-card mb-10 rounded-xl border p-5">
        <h2 className="mb-3 text-lg font-bold text-slate-200">
          Checkpoint gates
        </h2>
        <div className="space-y-2">
          {GATES.map((g) => {
            const passed = ready && gatePassed(g.id);
            // What's still missing, per module this gate covers.
            const blockers =
              !ready || passed
                ? []
                : modules
                    .filter((m) => m.id <= g.afterModule)
                    .map((m) => {
                      const s = moduleStats(m.slug);
                      const parts: string[] = [];
                      if (s.lessonsDone < s.lessonsTotal)
                        parts.push(
                          `lessons ${s.lessonsDone}/${s.lessonsTotal}`,
                        );
                      if (!s.quizPassed) parts.push("quiz");
                      if (!s.labDone) parts.push("lab");
                      return parts.length
                        ? `M${m.id} (${parts.join(", ")})`
                        : null;
                    })
                    .filter((b): b is string => b !== null);
            return (
              <div key={g.id} className="text-sm">
                <div className="flex items-center gap-3">
                  <span
                    className={clsx(
                      "w-10 shrink-0 font-bold",
                      passed ? "text-emerald-400" : "text-slate-500",
                    )}
                  >
                    {g.id}
                  </span>
                  <span className="text-slate-400">{g.requirement}</span>
                  <span className="ml-auto">{passed ? "✅" : "🔒"}</span>
                </div>
                {blockers.length > 0 && (
                  <div className="mt-1 pl-13 text-xs leading-relaxed text-slate-600">
                    Still needed: {blockers.join(" · ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
