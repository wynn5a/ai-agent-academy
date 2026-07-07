import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule, modules } from "@/content/registry";
import SectionRenderer from "@/components/SectionRenderer";
import LabActions from "@/components/LabActions";
import LabChecklist from "@/components/LabChecklist";
import LabNotes from "@/components/LabNotes";
import ReadingProgress from "@/components/ReadingProgress";

export function generateStaticParams() {
  return modules.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const mod = getModule(slug);
  return { title: mod ? `Lab — ${mod.title}` : "Lab" };
}

export default async function LabPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = getModule(slug);
  if (!mod) notFound();
  const lab = mod.lab;
  const nextModule = modules.find((m) => m.id === mod.id + 1);

  return (
    <div>
      <ReadingProgress />
      <div className="text-xs font-semibold text-slate-600">
        <Link href={`/modules/${mod.slug}`} className="hover:text-sky-400">
          Module {mod.id}: {mod.title}
        </Link>{" "}
        · Hands-on lab
        {lab.portfolio && (
          <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
            portfolio piece
          </span>
        )}
      </div>
      <h1 className="mt-1 text-3xl font-extrabold text-slate-100">
        {lab.title}
      </h1>
      <p className="mt-3 border-l-2 border-emerald-500/50 pl-4 leading-relaxed text-slate-400">
        {lab.objective}
      </p>

      <div className="mt-8">
        <SectionRenderer sections={lab.sections} />
      </div>

      <LabChecklist moduleSlug={mod.slug} criteria={lab.acceptanceCriteria} />

      {lab.stretchGoals && lab.stretchGoals.length > 0 && (
        <div className="border-border bg-card mt-6 rounded-xl border p-5">
          <div className="mb-3 text-sm font-bold tracking-wider text-slate-500 uppercase">
            Stretch goals
          </div>
          <ul className="space-y-2">
            {lab.stretchGoals.map((g, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm leading-relaxed text-slate-400"
              >
                <span className="mt-0.5 text-slate-600">◇</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <LabActions
        moduleSlug={mod.slug}
        criteriaCount={lab.acceptanceCriteria.length}
      />

      <LabNotes moduleSlug={mod.slug} />

      <div className="border-border mt-8 flex justify-end border-t pt-6 text-sm">
        {nextModule ? (
          <Link
            href={`/modules/${nextModule.slug}`}
            className="text-slate-400 hover:text-sky-400"
          >
            Next: Module {nextModule.id} — {nextModule.title} →
          </Link>
        ) : (
          <Link href="/" className="text-slate-400 hover:text-sky-400">
            Course complete — back to the dashboard →
          </Link>
        )}
      </div>
    </div>
  );
}
