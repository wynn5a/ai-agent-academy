import type { Module } from "@/lib/types";
import { lesson01 } from "./lessons/01-context-window-as-budget";
import { lesson02 } from "./lessons/02-compaction-and-summarization";
import { lesson03 } from "./lessons/03-memory-taxonomy-and-stores";
import { lesson04 } from "./lessons/04-write-path-and-read-path";
import { lesson05 } from "./lessons/05-memory-security";
import { quiz04 } from "./quiz";
import { lab04 } from "./lab";
import { resources04 } from "./resources";

export const module04: Module = {
  id: 4,
  slug: "memory-context",
  title: "Memory & Context Engineering",
  weeks: "Weeks 9–11",
  phase: 2,
  phaseTitle: "Knowledge & state",
  description:
    '"How would you design agent memory?" is now a standard senior interview question. This module gives you a real implementation to talk about: context-window budgeting, compaction, a persistent memory store with disciplined write and read paths, contradiction resolution — and defenses against memory injection, where a prompt attack becomes a persistent compromise.',
  outcomes: [
    "Treat the context window as a budgeted resource with an explicit allocation policy per call",
    "Implement compaction that summarizes old turns without breaking tool-call pairing or losing task state",
    "Explain the memory taxonomy — working, episodic, semantic, procedural — and map each to storage + recall",
    "Build a write path: extract candidate facts, deduplicate, detect contradictions, store with provenance",
    "Build a read path scoring relevance + recency + importance, injecting sparingly as delimited untrusted data",
    "Describe a concrete memory-injection attack and implement layered defenses your own red-team test can't beat",
  ],
  lessons: [lesson01, lesson02, lesson03, lesson04, lesson05],
  quiz: quiz04,
  lab: lab04,
  resources: resources04,
};
