import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule, modules } from "@/content/registry";
import SectionRenderer from "@/components/SectionRenderer";
import LessonFooter from "@/components/LessonFooter";
import ReadingProgress from "@/components/ReadingProgress";

export function generateStaticParams() {
  return modules.flatMap((m) =>
    m.lessons.map((l) => ({ slug: m.slug, lesson: l.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lesson: string }>;
}): Promise<Metadata> {
  const { slug, lesson: lessonSlug } = await params;
  const mod = getModule(slug);
  const lesson = mod?.lessons.find((l) => l.slug === lessonSlug);
  return { title: lesson ? `${lesson.title} — ${mod!.title}` : "Lesson" };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lesson: string }>;
}) {
  const { slug, lesson: lessonSlug } = await params;
  const mod = getModule(slug);
  const idx = mod?.lessons.findIndex((l) => l.slug === lessonSlug) ?? -1;
  if (!mod || idx < 0) notFound();
  const lesson = mod.lessons[idx];
  const prev = idx > 0 ? mod.lessons[idx - 1] : null;
  const next = idx < mod.lessons.length - 1 ? mod.lessons[idx + 1] : null;

  return (
    <article>
      <ReadingProgress />
      <div className="text-xs font-semibold text-slate-600">
        <Link href={`/modules/${mod.slug}`} className="hover:text-sky-400">
          Module {mod.id}: {mod.title}
        </Link>{" "}
        · Lesson {idx + 1} of {mod.lessons.length} · {lesson.minutes} min
      </div>
      <h1 className="mt-1 text-3xl font-extrabold text-slate-100">
        {lesson.title}
      </h1>
      <p className="mt-3 border-l-2 border-sky-500/50 pl-4 leading-relaxed text-slate-400">
        {lesson.summary}
      </p>

      <div className="mt-8">
        <SectionRenderer sections={lesson.sections} />
      </div>

      <LessonFooter
        moduleSlug={mod.slug}
        lessonSlug={lesson.slug}
        prevHref={prev ? `/modules/${mod.slug}/lessons/${prev.slug}` : null}
        prevTitle={prev?.title ?? null}
        nextHref={
          next
            ? `/modules/${mod.slug}/lessons/${next.slug}`
            : `/modules/${mod.slug}/quiz`
        }
        nextTitle={next?.title ?? "Module quiz →"}
      />
    </article>
  );
}
