import type { Module } from "@/lib/types";
import { lesson01 } from "./lessons/01-the-eval-pyramid";
import { lesson02 } from "./lessons/02-llm-as-judge";
import { lesson03 } from "./lessons/03-regression-suites-in-ci";
import { lesson04 } from "./lessons/04-tracing-and-cost";
import { lesson05 } from "./lessons/05-injection-hitl-postmortems";
import { quiz07 } from "./quiz";
import { lab07 } from "./lab";
import { resources07 } from "./resources";

export const module07: Module = {
  id: 7,
  slug: "evals-observability-safety",
  title: "Evals, Observability & Safety",
  weeks: "Weeks 18–20",
  phase: 4,
  phaseTitle: "Production readiness",
  description:
    "The #1 senior differentiator. Anyone can demo an agent; seniors can prove it works, see why it fails, and stop it from doing damage. Eval harnesses, tracing, cost dashboards, prompt-injection defense in depth, human-in-the-loop gates, and honest postmortems.",
  outcomes: [
    "Design an eval pyramid — deterministic assertions, validated LLM-as-judge, sampled human review — for a real agent",
    "Validate an LLM judge against human labels and report agreement before trusting it",
    "Build a regression suite that turns every fixed bug into a CI test case",
    "Instrument an agent with tracing so every LLM and tool call carries tokens, cost, and latency",
    "Diagnose a cost regression and a quality regression from traces alone",
    "Reason about prompt injection with the lethal-trifecta lens and layer real defenses",
    "Add a human-in-the-loop approval gate to any irreversible action, with an audit log",
    "Write a blameless postmortem: timeline, root cause, detection gap, fix, regression test",
  ],
  lessons: [lesson01, lesson02, lesson03, lesson04, lesson05],
  quiz: quiz07,
  lab: lab07,
  resources: resources07,
};
