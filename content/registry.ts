import type { Module } from "@/lib/types";
import { module01 } from "./modules/module01";
import { module02 } from "./modules/module02";
import { module03 } from "./modules/module03";
import { module04 } from "./modules/module04";
import { module05 } from "./modules/module05";
import { module06 } from "./modules/module06";
import { module07 } from "./modules/module07";
import { module08 } from "./modules/module08";

export const modules: Module[] = [
  module01,
  module02,
  module03,
  module04,
  module05,
  module06,
  module07,
  module08,
];

export const PHASES: { id: number; title: string; weeks: string }[] = [
  { id: 1, title: "Foundations from raw APIs", weeks: "Weeks 1–5" },
  { id: 2, title: "Knowledge & state", weeks: "Weeks 6–11" },
  { id: 3, title: "Scale & interoperability", weeks: "Weeks 12–17" },
  { id: 4, title: "Production readiness", weeks: "Weeks 18–20" },
  { id: 5, title: "Capstone & interview readiness", weeks: "Weeks 21–26" },
];

export function getModule(slug: string): Module | undefined {
  return modules.find((m) => m.slug === slug);
}
