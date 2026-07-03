import type { Resource } from "@/lib/types";

export const resources03: Resource[] = [
  {
    title: "RAGAS documentation",
    url: "https://docs.ragas.io/",
    description:
      "The eval framework for Lab 03 — faithfulness, relevance, context metrics.",
    kind: "docs",
  },
  {
    title: "Qdrant docs",
    url: "https://qdrant.tech/documentation/",
    description:
      "Local vector DB for the lab; the hybrid-search tutorial is directly relevant.",
    kind: "docs",
  },
  {
    title: "Eugene Yan — writing",
    url: "https://eugeneyan.com/writing/",
    description:
      "Best practitioner essays on RAG patterns and evaluation design.",
    kind: "essay",
  },
  {
    title: "SBERT — Cross-encoders",
    url: "https://www.sbert.net/examples/applications/cross-encoder/README.html",
    description: "Reranking implementation you'll use in the lab.",
    kind: "docs",
  },
  {
    title: "Anthropic — Contextual Retrieval",
    url: "https://www.anthropic.com/engineering/contextual-retrieval",
    description:
      "Prepend LLM-generated context to chunks: −49% retrieval failures, −67% with reranking. Measured, replicable.",
    kind: "essay",
  },
  {
    title: "DeepLearning.AI short courses",
    url: "https://www.deeplearning.ai/short-courses/",
    description:
      "Free 1–2 hr targeted fills: advanced retrieval, reranking, RAG evaluation.",
    kind: "course",
  },
];
