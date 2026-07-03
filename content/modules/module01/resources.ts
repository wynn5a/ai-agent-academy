import type { Resource } from "@/lib/types";

export const resources01: Resource[] = [
  {
    title: "Anthropic — Tool use docs",
    url: "https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview",
    description:
      "The canonical reference for the message shapes used in Lab 01.",
    kind: "docs",
  },
  {
    title: "OpenAI — Function calling & structured outputs",
    url: "https://platform.openai.com/docs/guides/function-calling",
    description: "Compare the two vendors' shapes — interviews ask about both.",
    kind: "docs",
  },
  {
    title: "OpenAI — Migrate to the Responses API",
    url: "https://platform.openai.com/docs/guides/migrate-to-responses",
    description:
      "Chat Completions vs. Responses API, side by side — interviews still ask about both surfaces.",
    kind: "docs",
  },
  {
    title: "Anthropic Cookbook",
    url: "https://github.com/anthropics/anthropic-cookbook",
    description:
      "Runnable notebooks for every pattern in this module. Run the tool-use ones.",
    kind: "repo",
  },
  {
    title: "Prompt Engineering Guide",
    url: "https://www.promptingguide.ai/",
    description:
      "Reference for prompting techniques; skim the basics, bookmark the rest.",
    kind: "guide",
  },
  {
    title: "OpenAI Cookbook",
    url: "https://cookbook.openai.com/",
    description:
      "The other vendor's runnable examples — structured outputs, function calling, streaming.",
    kind: "repo",
  },
  {
    title: "Chip Huyen — AI Engineering (book)",
    url: "https://huyenchip.com/books/",
    description:
      "The best book-length treatment of this whole curriculum; chapters 1–2 pair with this module.",
    kind: "book",
  },
];
