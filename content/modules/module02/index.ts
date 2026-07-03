import type { Module } from "@/lib/types";
import { lesson01 } from "./lessons/01-the-loop-that-makes-an-agent";
import { lesson02 } from "./lessons/02-react-and-planning";
import { lesson03 } from "./lessons/03-workflows-vs-agents";
import { lesson04 } from "./lessons/04-termination-and-budgets";
import { lesson05 } from "./lessons/05-failure-recovery-and-tracing";
import { quiz02 } from "./quiz";
import { lab02 } from "./lab";
import { resources02 } from "./resources";

export const module02: Module = {
  id: 2,
  slug: "agent-loop",
  title: "The Agent Loop",
  weeks: "Weeks 3–5",
  phase: 1,
  phaseTitle: "Foundations from raw APIs",
  description:
    "An agent is an LLM calling tools in a loop, with the model deciding what to do next. This module is the heart of the curriculum: the loop itself, ReAct, Anthropic's workflows-vs-agents taxonomy, planning, termination, budgets, and failure recovery.",
  outcomes: [
    "Implement the core agent loop — model picks a tool, you execute, results feed back — with the model choosing the path",
    "Explain Anthropic's workflows-vs-agents taxonomy and argue when a workflow beats an agent (the interview staple)",
    "Implement the five workflow patterns: prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer",
    "Explain ReAct and how native tool calling absorbed it; add upfront planning and re-planning to a loop",
    "Enforce termination with layered guards: finish tool, max iterations, cost budget, wall-clock deadline — with graceful degradation",
    "Recover from tool failures without crashing, keep context from exploding across iterations, and emit a JSONL trace log for every run",
  ],
  lessons: [lesson01, lesson02, lesson03, lesson04, lesson05],
  quiz: quiz02,
  lab: lab02,
  resources: resources02,
};
