import type { Resource } from "@/lib/types";

export const resources04: Resource[] = [
  {
    title: "MemGPT paper (Letta)",
    url: "https://arxiv.org/abs/2310.08560",
    description:
      "Hierarchical memory — the design everyone cites in interviews.",
    kind: "paper",
  },
  {
    title: "Anthropic — Effective context engineering for AI agents",
    url: "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents",
    description:
      "How production agents budget and structure their windows. The core reading for this module.",
    kind: "essay",
  },
  {
    title: "12-Factor Agents — Factor 3: Own your context window",
    url: "https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-03-own-your-context-window.md",
    description:
      "The production-engineer's case for treating context as code you control.",
    kind: "repo",
  },
  {
    title: "Simon Willison — prompt injection series",
    url: "https://simonwillison.net/series/prompt-injection/",
    description: "The foundation for understanding memory injection. Required.",
    kind: "essay",
  },
];
