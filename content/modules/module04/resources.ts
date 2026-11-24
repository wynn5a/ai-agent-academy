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
    title: "Anthropic — Compaction overview (on demand vs. at a threshold vs. your own summarizer)",
    url: "https://platform.claude.com/docs/en/build-with-claude/compaction",
    description:
      "The official comparison of the three ways to summarize, with what each costs you in code and control. Pairs with Lesson 3.",
    kind: "docs",
  },
  {
    title: "Anthropic — Prefix checks on thinking blocks",
    url: "https://platform.claude.com/docs/en/build-with-claude/preserved-thinking/prefix-checks",
    description:
      "Why rewriting earlier turns invalidates later thinking on preserved-thinking models, and the append-only habits that avoid it.",
    kind: "docs",
  },
  {
    title: "OpenAI — Keep the prefix unchanged",
    url: "https://developers.openai.com/api/docs/guides/keep-prefix-unchanged",
    description:
      "The same rule from the other provider: what counts as a prefix change, and how to get the same result by appending.",
    kind: "docs",
  },
  {
    title: "OpenAI — Compaction",
    url: "https://developers.openai.com/api/docs/guides/compaction",
    description:
      "Server-side thresholds, the explicit trigger, and the standalone compact endpoint. The returned item is encrypted.",
    kind: "docs",
  },
  {
    title: "Anthropic — Harness design for long-running application development",
    url: "https://www.anthropic.com/engineering/harness-design-long-running-apps",
    description:
      "Context resets with a structured handoff versus compaction, and the 'context anxiety' failure that resets address.",
    kind: "essay",
  },
  {
    title: "Manus — Context Engineering for AI Agents: Lessons from Building Manus",
    url: "https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus",
    description:
      "Six production lessons, starting with the KV-cache hit rate as the metric that matters most.",
    kind: "essay",
  },
  {
    title: "Compaction Laundering: Provenance Destruction in Context-Compacting Coding Agents",
    url: "https://arxiv.org/abs/2610.29869",
    description:
      "Measured attack: a flattened transcript lets a forged user turn survive compaction. Role-typed harnesses block it.",
    kind: "paper",
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
