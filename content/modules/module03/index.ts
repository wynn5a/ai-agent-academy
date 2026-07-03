import type { Module } from "@/lib/types";
import { lesson01 } from "./lessons/01-why-rag-and-the-pipeline";
import { lesson02 } from "./lessons/02-chunking-strategies";
import { lesson03 } from "./lessons/03-vector-dbs-and-hybrid-search";
import { lesson04 } from "./lessons/04-reranking-and-query-rewriting";
import { lesson05 } from "./lessons/05-grounded-generation-and-evaluation";
import { quiz03 } from "./quiz";
import { lab03 } from "./lab";
import { resources03 } from "./resources";

export const module03: Module = {
  id: 3,
  slug: "rag",
  title: "RAG Done Properly",
  weeks: "Weeks 6–8",
  phase: 2,
  phaseTitle: "Knowledge & state",
  description:
    "RAG shows up in nearly half of agent take-home assignments — but building a pipeline is table stakes. The senior differentiator is *measuring* it: ingest → chunk → embed → index → retrieve → rerank → generate with citations, with an evaluation harness running from day one.",
  outcomes: [
    "Explain what embeddings are, why cosine similarity finds meaning, and where dense retrieval structurally fails",
    "Choose and defend a chunking strategy (fixed-size vs. structural, size, overlap) with your own numbers",
    "Stand up Qdrant locally and implement hybrid search: BM25 + dense vectors fused with RRF",
    "Add a cross-encoder reranking stage and explain the bi-encoder/cross-encoder trade-off",
    "Apply query rewriting, decomposition, and HyDE when the user's question is a bad search query",
    "Build a labeled eval set and report precision@k, recall@k, MRR, faithfulness, and answer relevance",
  ],
  lessons: [lesson01, lesson02, lesson03, lesson04, lesson05],
  quiz: quiz03,
  lab: lab03,
  resources: resources03,
};
