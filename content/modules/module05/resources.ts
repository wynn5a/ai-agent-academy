import type { Resource } from "@/lib/types";

export const resources05: Resource[] = [
  {
    title: "LangChain Academy — Intro to LangGraph",
    url: "https://academy.langchain.com/",
    description: "Free official course; do modules 1–4 before Lab 05.",
    kind: "course",
  },
  {
    title: "Anthropic — How we built our multi-agent research system",
    url: "https://www.anthropic.com/engineering/multi-agent-research-system",
    description:
      "Real production numbers on orchestrator-worker, incl. token cost honesty.",
    kind: "essay",
  },
  {
    title: "Cognition — Don't Build Multi-Agents",
    url: "https://cognition.ai/blog/dont-build-multi-agents",
    description:
      "The counterargument. Read both sides; interviews reward the synthesis.",
    kind: "essay",
  },
  {
    title: "Hugging Face AI Agents Course",
    url: "https://huggingface.co/learn/agents-course",
    description:
      "Free, certified; broad framework coverage (smolagents, LlamaIndex, LangGraph).",
    kind: "course",
  },
  {
    title: "LangGraph reference docs",
    url: "https://langchain-ai.github.io/langgraph/",
    description:
      "The API reference for Lab 05 — state, reducers, checkpointers, interrupts.",
    kind: "docs",
  },
];
