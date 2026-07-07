import type { Resource } from "@/lib/types";

export const resources02: Resource[] = [
  {
    title: "Anthropic — Building Effective Agents",
    url: "https://www.anthropic.com/research/building-effective-agents",
    description:
      "The essay this module is built on. Read it twice; interviews quote it.",
    kind: "essay",
  },
  {
    title: "OpenAI — A Practical Guide to Building Agents",
    url: "https://developers.openai.com/api/docs/guides/agents",
    description: "Complementary vendor view: guardrails, orchestration, HITL.",
    kind: "guide",
  },
  {
    title: "Lilian Weng — LLM Powered Autonomous Agents",
    url: "https://lilianweng.github.io/posts/2023-06-23-agent/",
    description:
      "The classic conceptual grounding: planning, memory, tool use.",
    kind: "essay",
  },
  {
    title: "ReAct paper (Yao et al.)",
    url: "https://arxiv.org/abs/2210.03629",
    description: "Skim for the idea and the lineage question above.",
    kind: "paper",
  },
  {
    title: "Chip Huyen — Agents",
    url: "https://huyenchip.com/2025/01/07/agents.html",
    description:
      "The most rigorous long-form treatment of planning, tool selection, and agent failure modes.",
    kind: "essay",
  },
  {
    title: "12-Factor Agents (23k★)",
    url: "https://github.com/humanlayer/12-factor-agents",
    description:
      "Production principles from someone who tried every framework: own your loop, prompts, and context window.",
    kind: "repo",
  },
];
