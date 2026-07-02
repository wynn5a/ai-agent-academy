import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule, modules } from "@/content/registry";
import Quiz from "@/components/Quiz";
import { PASS_THRESHOLD } from "@/lib/types";

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
  return { title: mod ? `Quiz — ${mod.title}` : "Quiz" };
}

export default async function QuizPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = getModule(slug);
  if (!mod) notFound();

  return (
    <div>
      <div className="text-xs font-semibold text-slate-600">
        <Link href={`/modules/${mod.slug}`} className="hover:text-sky-400">
          Module {mod.id}: {mod.title}
        </Link>
      </div>
      <h1 className="mt-1 text-3xl font-extrabold text-slate-100">
        Module quiz
      </h1>
      <p className="mt-2 mb-8 text-slate-400">
        {mod.quiz.length} questions · pass bar{" "}
        {Math.round(PASS_THRESHOLD * 100)}% · retry as often as you like — your
        best score counts toward the gate.
      </p>
      <Quiz moduleSlug={mod.slug} questions={mod.quiz} />
    </div>
  );
}
