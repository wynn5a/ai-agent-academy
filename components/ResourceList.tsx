import type { Resource, ResourceKind } from "@/lib/types";

const KIND_META: Record<
  ResourceKind,
  { label: string; text: string; bg: string; ring: string; icon: React.ReactNode }
> = {
  docs: {
    label: "Docs",
    text: "text-sky-300",
    bg: "bg-sky-500/10",
    ring: "group-hover:ring-sky-500/40",
    icon: (
      <path d="M7 4h7l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm7 0v4h4M9 13h6M9 16.5h6" />
    ),
  },
  guide: {
    label: "Guide",
    text: "text-cyan-300",
    bg: "bg-cyan-500/10",
    ring: "group-hover:ring-cyan-500/40",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m14.5 9.5-2 5-5 2 2-5Z" />
      </>
    ),
  },
  essay: {
    label: "Essay",
    text: "text-violet-300",
    bg: "bg-violet-500/10",
    ring: "group-hover:ring-violet-500/40",
    icon: (
      <path d="M4 19.5 15 8l1-3 3-1-1 3-11 11-3 1Zm7-11L18 15" />
    ),
  },
  paper: {
    label: "Paper",
    text: "text-amber-300",
    bg: "bg-amber-500/10",
    ring: "group-hover:ring-amber-500/40",
    icon: (
      <path d="M9 3h6l-1 6h3l-8 12 1-8H7Z" />
    ),
  },
  repo: {
    label: "Repo",
    text: "text-emerald-300",
    bg: "bg-emerald-500/10",
    ring: "group-hover:ring-emerald-500/40",
    icon: (
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13 6l-2 12" />
    ),
  },
  book: {
    label: "Book",
    text: "text-rose-300",
    bg: "bg-rose-500/10",
    ring: "group-hover:ring-rose-500/40",
    icon: (
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 0 4 23.5v-18ZM20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 1 2.5 2.5v-18Z" />
    ),
  },
  course: {
    label: "Course",
    text: "text-indigo-300",
    bg: "bg-indigo-500/10",
    ring: "group-hover:ring-indigo-500/40",
    icon: (
      <path d="M12 4 2 9l10 5 8-4v6M6 11.5V17c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-5.5" />
    ),
  },
  interactive: {
    label: "Interactive",
    text: "text-fuchsia-300",
    bg: "bg-fuchsia-500/10",
    ring: "group-hover:ring-fuchsia-500/40",
    icon: (
      <path d="m5 3 6 16 2-6.5L19 10 5 3Zm8 12 4 4" />
    ),
  },
  benchmark: {
    label: "Benchmark",
    text: "text-orange-300",
    bg: "bg-orange-500/10",
    ring: "group-hover:ring-orange-500/40",
    icon: <path d="M5 20V10M12 20V4M19 20v-7" />,
  },
};

function KindIcon({ kind }: { kind: ResourceKind }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {KIND_META[kind].icon}
    </svg>
  );
}

export default function ResourceList({ resources }: { resources: Resource[] }) {
  if (!resources?.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {resources.map((r) => {
        const meta = KIND_META[r.kind];
        return (
          <a
            key={r.url}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className={`group border-border bg-card relative flex gap-3 rounded-xl border p-4 transition-colors hover:border-white/20 hover:ring-1 ${meta.ring}`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.text}`}
            >
              <KindIcon kind={r.kind} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-slate-200 group-hover:text-slate-100">
                  {r.title}
                </div>
                <svg
                  viewBox="0 0 24 24"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600 transition-colors group-hover:text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {r.description}
              </p>
              <span
                className={`mt-2 inline-block text-[10px] font-bold tracking-wider uppercase ${meta.text} opacity-70`}
              >
                {meta.label}
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
