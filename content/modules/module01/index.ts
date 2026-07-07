import type { Module } from "@/lib/types";
import { lesson00 } from "./lessons/00-setup";
import { lesson01 } from "./lessons/01-messages-are-the-only-state";
import { lesson02 } from "./lessons/02-sampling-and-streaming";
import { lesson03 } from "./lessons/03-tool-calling";
import { lesson04 } from "./lessons/04-structured-outputs";
import { lesson05 } from "./lessons/05-errors-and-resilience";
import { lesson06 } from "./lessons/06-multimodal-inputs";
import { quiz01 } from "./quiz";
import { lab01 } from "./lab";
import { resources01 } from "./resources";

export const module01: Module = {
  id: 1,
  slug: "llm-api-mastery",
  title: "LLM API Mastery",
  weeks: "Weeks 1–2",
  phase: 1,
  phaseTitle: "Foundations from raw APIs",
  description:
    "No frameworks. Raw HTTP/SDK calls only. Everything an agent does reduces to these mechanics: the message array, tool calling, structured outputs, thinking & effort, streaming, multimodal input, tokens, and robust error handling.",
  outcomes: [
    "Explain and implement the chat message format (system/user/assistant/tool roles) from memory",
    "Implement tool calling end-to-end: schema → model emits call → you execute → return result → model continues",
    "Produce validated structured outputs with JSON schema and recover from malformed JSON",
    "Stream responses token-by-token and explain why streaming matters for agent UX",
    "Count tokens, estimate cost per call, and reason about context-window budgets",
    "Handle rate limits, timeouts, and refusals with exponential backoff and graceful degradation",
    "Enable adaptive thinking, tune effort, and explain why frontier models replaced sampling parameters",
    "Send images and PDFs as content blocks and combine document input with structured outputs for extraction",
  ],
  lessons: [
    lesson00,
    lesson01,
    lesson02,
    lesson03,
    lesson04,
    lesson05,
    lesson06,
  ],
  quiz: quiz01,
  lab: lab01,
  resources: resources01,
};
