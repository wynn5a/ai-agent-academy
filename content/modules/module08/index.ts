import type { Module } from "@/lib/types";
import { lesson01 } from "./lessons/01-architecture-and-exploration";
import { lesson02 } from "./lessons/02-editing-and-repair-loop";
import { lesson03 } from "./lessons/03-pr-gating-and-evaluation";
import { lesson04 } from "./lessons/04-limitations-and-interview-readiness";
import { quiz08 } from "./quiz";
import { lab08 } from "./lab";
import { resources08 } from "./resources";

export const module08: Module = {
  id: 8,
  slug: "capstone",
  title: "Capstone: The Autonomous Coding Agent",
  weeks: "Weeks 21–26",
  phase: 5,
  phaseTitle: "Capstone & interview readiness",
  description:
    "The portfolio anchor. An autonomous software-development agent that takes a GitHub issue, explores the codebase, implements a fix in a sandbox, runs the tests, and opens a PR gated on human approval — shipped with eval results, a cost analysis, and an honest limitations doc. Everything from Modules 1–7 converges here, then you turn it into interview narratives.",
  outcomes: [
    "Architect an issue-to-PR coding agent with checkpointed plans and a sandboxed workspace",
    "Implement codebase exploration that locates relevant files without stuffing the whole repo into context",
    "Choose and apply an edit strategy (search/replace vs. full-file) and defend the trade-off",
    "Run a test-driven repair loop with bounded retries: reproduce (red) → fix → verify (green)",
    "Gate PR creation behind human-in-the-loop approval showing diff, test results, and cost",
    "Assemble a small SWE-bench-style local eval set and report success rate, a partial-success taxonomy, and cost/time per issue",
    "Write a frank limitations doc that scopes the agent honestly",
    "Turn the capstone into system-design answers and STAR behavioral stories at a senior bar",
  ],
  lessons: [lesson01, lesson02, lesson03, lesson04],
  quiz: quiz08,
  lab: lab08,
  resources: resources08,
};
