"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { modules } from "@/content/registry";
import { useProgress } from "@/lib/progress";

export default function Sidebar() {
  const pathname = usePathname();
  const { completedLessons, moduleStats, ready } = useProgress();
  const [open, setOpen] = useState(false);

  const activeModuleSlug = modules.find((m) =>
    pathname?.startsWith(`/modules/${m.slug}`),
  )?.slug;
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>(
    {},
  );
  const isModuleOpen = (slug: string) =>
    slug in openOverrides ? openOverrides[slug] : slug === activeModuleSlug;
  const toggleModule = (slug: string) =>
    setOpenOverrides((prev) => ({ ...prev, [slug]: !isModuleOpen(slug) }));

  const nav = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-4">
      <Link
        href="/"
        onClick={() => setOpen(false)}
        className="mb-4 block rounded-lg px-3 py-2 hover:bg-white/5"
      >
        <div className="text-sm font-bold tracking-wide text-sky-400">
          AGENT ENGINEERING
        </div>
        <div className="text-lg font-extrabold text-slate-100">Academy</div>
        <div className="mt-0.5 text-xs text-slate-500">
          26 weeks · senior agent engineer
        </div>
      </Link>

      <Link
        href="/"
        onClick={() => setOpen(false)}
        className={clsx(
          "rounded-lg px-3 py-2 text-sm font-medium",
          pathname === "/"
            ? "bg-sky-500/10 text-sky-300"
            : "text-slate-400 hover:bg-white/5",
        )}
      >
        Dashboard
      </Link>

      <div className="mt-3 px-3 text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
        Modules
      </div>
      {modules.map((m) => {
        const active = pathname?.startsWith(`/modules/${m.slug}`);
        const stats = ready ? moduleStats(m.slug) : null;
        const expanded = isModuleOpen(m.slug);
        return (
          <div key={m.slug}>
            <div
              className={clsx(
                "group flex items-center gap-1 rounded-lg pr-2 text-sm",
                active
                  ? "bg-sky-500/10 text-sky-300"
                  : "text-slate-400 hover:bg-white/5",
              )}
            >
              <Link
                href={`/modules/${m.slug}`}
                onClick={() => setOpen(false)}
                className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2"
              >
                <span
                  className={clsx(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                    stats && stats.percent >= 100
                      ? "bg-emerald-500/20 text-emerald-400"
                      : active
                        ? "bg-sky-500/20 text-sky-300"
                        : "bg-white/5 text-slate-500",
                  )}
                >
                  {stats && stats.percent >= 100 ? "✓" : m.id}
                </span>
                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                {stats && stats.percent > 0 && stats.percent < 100 && (
                  <span className="text-[10px] text-slate-600 tabular-nums">
                    {stats.percent}%
                  </span>
                )}
              </Link>
              <button
                type="button"
                aria-label={expanded ? "Collapse lessons" : "Expand lessons"}
                aria-expanded={expanded}
                onClick={() => toggleModule(m.slug)}
                className="shrink-0 rounded p-1 text-slate-600 hover:bg-white/10 hover:text-slate-300"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={clsx(
                    "transition-transform",
                    expanded ? "rotate-90" : "rotate-0",
                  )}
                >
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {expanded && (
              <div className="mt-0.5 mb-1 ml-[1.875rem] space-y-0.5 border-l border-white/10 pl-3">
                {m.lessons.map((l) => {
                  const href = `/modules/${m.slug}/lessons/${l.slug}`;
                  const lessonActive = pathname === href;
                  const done = !!completedLessons[`${m.slug}/${l.slug}`];
                  return (
                    <Link
                      key={l.slug}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={clsx(
                        "block truncate rounded-md px-2 py-1.5 text-[13px]",
                        lessonActive
                          ? "bg-sky-500/10 font-medium text-sky-300"
                          : "text-slate-500 hover:bg-white/5 hover:text-slate-300",
                      )}
                    >
                      {done && !lessonActive && (
                        <span className="mr-1.5 text-emerald-500">✓</span>
                      )}
                      {l.title}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* mobile toggle */}
      <button
        aria-label="Toggle navigation"
        onClick={() => setOpen(!open)}
        className="border-border bg-surface fixed top-4 left-4 z-50 rounded-lg border p-2 text-slate-300 lg:hidden"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={clsx(
          "border-border bg-surface fixed inset-y-0 left-0 z-40 w-72 border-r transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {nav}
      </aside>
    </>
  );
}
