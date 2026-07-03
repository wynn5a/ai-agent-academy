import type { Module } from "@/lib/types";
import { lesson01 } from "./lessons/01-what-frameworks-actually-buy-you";
import { lesson02 } from "./lessons/02-state-nodes-and-edges";
import { lesson03 } from "./lessons/03-checkpoints-resume-and-hitl";
import { lesson04 } from "./lessons/04-orchestrators-workers-and-handoffs";
import { lesson05 } from "./lessons/05-when-multi-agent-is-worth-it";
import { quiz05 } from "./quiz";
import { lab05 } from "./lab";
import { resources05 } from "./resources";

export const module05: Module = {
  id: 5,
  slug: "multi-agent-frameworks",
  title: "Multi-Agent Systems & Frameworks",
  weeks: "Weeks 12–14",
  phase: 3,
  phaseTitle: "Scale & interoperability",
  description:
    "Frameworks enter — you've earned them by building everything by hand. LangGraph for stateful, checkpointed, resumable agent graphs; orchestrator-worker and handoff patterns; and the senior-level judgment call interviews probe hardest: when multi-agent is worth the coordination cost (usually it isn't).",
  outcomes: [
    "Build a LangGraph StateGraph from memory: typed state, nodes, fixed and conditional edges, compile, invoke",
    "Enable checkpointing so a graph can resume after a crash, time-travel to past states, and pause for humans",
    "Implement human-in-the-loop interrupts that pause a graph mid-run and resume with human feedback",
    "Implement orchestrator-worker and handoff patterns with structured briefs, not raw transcripts",
    "Quantify error compounding and coordination cost, and argue when multi-agent is and isn't justified",
    "Run a single-agent baseline comparison and report quality, cost, and latency honestly",
  ],
  lessons: [lesson01, lesson02, lesson03, lesson04, lesson05],
  quiz: quiz05,
  lab: lab05,
  resources: resources05,
};
