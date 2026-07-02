import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getModule, modules } from "@/content/registry";
import ModuleOverview from "@/components/ModuleOverview";

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
  return { title: mod ? `${mod.title} — Agent Engineering Academy` : "Module" };
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = getModule(slug);
  if (!mod) notFound();
  return <ModuleOverview moduleSlug={mod.slug} />;
}
