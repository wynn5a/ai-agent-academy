import type { Resource } from "@/lib/types";

export const resources07: Resource[] = [
  {
    title: "Hamel Husain — Your AI Product Needs Evals",
    url: "https://hamel.dev/blog/posts/evals/",
    description:
      "The essay hiring managers reference. The error-analysis workflow is the job.",
    kind: "essay",
  },
  {
    title: "Langfuse docs",
    url: "https://langfuse.com/docs",
    description:
      "Open-source tracing + evals; what Lab 07 wires into Labs 02 and 05.",
    kind: "docs",
  },
  {
    title: "Simon Willison — prompt injection series",
    url: "https://simonwillison.net/series/prompt-injection/",
    description: "Threat model, lethal trifecta, why filters aren't enough.",
    kind: "essay",
  },
  {
    title: "OWASP Top 10 for LLM Apps",
    url: "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
    description: "Know LLM01 (injection) cold; skim the rest for vocabulary.",
    kind: "guide",
  },
  {
    title: "Eugene Yan — Evaluating LLM-Evaluators",
    url: "https://eugeneyan.com/writing/llm-evaluators/",
    description:
      "Survey of judge techniques and their measured biases — the depth behind this module's judge table.",
    kind: "essay",
  },
  {
    title: "Gandalf (Lakera)",
    url: "https://gandalf.lakera.ai/",
    description:
      "A game: extract a password from a defended LLM, level by level. The fastest way to build injection intuition.",
    kind: "interactive",
  },
];
