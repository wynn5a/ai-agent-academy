import type { Lab } from "@/lib/types";

export const lab03: Lab = {
  title: "RAG Pipeline with Eval Harness",
  portfolio: true,
  objective:
    "Build a full RAG pipeline over a real corpus of 100+ documents — structural chunking, hybrid retrieval (BM25 + dense with RRF), cross-encoder reranking, grounded generation with citations — plus a labeled eval set and a committed metrics report comparing every retrieval configuration. This is a portfolio piece: a hiring manager should grasp the architecture and your results in three minutes.",
  sections: [
    {
      type: "heading",
      text: "What you're building",
    },
    {
      type: "paragraph",
      text: "Pick a corpus you actually care about — Pacvue docs, a stack of technical PDFs, or a large OSS project's documentation. Two entry points: an **ingest command** that chunks, embeds, and indexes the corpus into local Qdrant, and an **ask command** that retrieves (any of four toggleable configs), optionally reranks, and generates a cited answer. Around them, an **eval harness**: ≥50 human-verified question/answer/source triples, and a script that emits the full metrics table as a markdown report you commit to the repo.",
    },
    {
      type: "animation",
      name: "rag-pipeline",
      caption:
        "Your lab, end to end: the indexing lane runs once per corpus; the query lane runs per question; the eval harness loops over both.",
    },
    {
      type: "heading",
      text: "Suggested structure",
    },
    {
      type: "code",
      language: "python",
      title: "skeleton (fill in the TODOs)",
      code: `# config.py — every stage toggleable; the eval report depends on this
CONFIG = {
    "chunk_size": 350, "chunk_overlap": 50,
    "use_dense": True, "use_bm25": True,     # hybrid = both on
    "use_rerank": True,
    "retrieve_k": 50, "final_k": 5,
}

# ingest.py
def ingest(corpus_dir: str) -> None:
    # 1. parse each file to clean text (handle at least .md and .pdf)
    # 2. structural_chunks() with CONFIG sizes; keep doc_id/heading/position
    # 3. batch-encode embed_text; upsert to Qdrant with payload metadata
    # 4. build + pickle the BM25 index over the same chunk list
    ...

# pipeline.py
def retrieve(query: str, cfg: dict) -> list[int]:
    rankings = []
    if cfg["use_dense"]:
        rankings.append(dense_search(query, cfg["retrieve_k"]))
    if cfg["use_bm25"]:
        rankings.append(bm25_search(query, cfg["retrieve_k"]))
    ids = rrf_fuse(rankings) if len(rankings) > 1 else rankings[0]
    if cfg["use_rerank"]:
        ids = rerank(query, ids[:cfg["retrieve_k"]], top=cfg["final_k"])
    return ids[:cfg["final_k"]]

def ask(query: str, cfg: dict) -> dict:
    # grounded generation with numbered citations + explicit refusal path
    ...

# evaluate.py
def run_eval(eval_set_path: str, report_path: str) -> None:
    # for each config (dense/bm25/hybrid/hybrid+rerank):
    #   precision@5, recall@5, MRR over the eval set
    # for the best config: faithfulness + answer relevance (RAGAS or
    # your own LLM-as-judge with model="claude-sonnet-5")
    # write eval_report.md: metrics table + 'what I'd improve' section
    ...`,
      explanation:
        "Design decisions that matter: the BM25 index and the vector index must be built over the *identical* chunk list (fuse by shared chunk id, or RRF merges nonsense); batch the embedding calls; keep the eval harness a one-command script so re-running after every change is frictionless — the eval loop is only a loop if it's cheap to run.",
    },
    {
      type: "paragraph",
      text: '**The eval report is the deliverable.** The committed `eval_report.md` is what separates this from every tutorial RAG repo: a table of precision@5 / recall@5 / MRR for **dense-only vs. BM25-only vs. hybrid vs. hybrid+rerank**, faithfulness and answer relevance for the best config, and an honest "what I\'d improve" section. Your practical test is presenting this report to Claude as if to a hiring panel — be ready to defend the chunking parameters and fusion choice **with your own numbers**, not folklore.',
    },
  ],
  acceptanceCriteria: [
    "Ingestion handles ≥100 documents; structural chunking with configurable size/overlap",
    "Hybrid retrieval (BM25 + dense, RRF fusion) with a config flag to toggle each mode",
    "Cross-encoder reranking stage, also toggleable",
    "Answers include citations to source chunks",
    "Eval set of ≥50 question/answer/source-doc triples (LLM-assisted generation is fine, human-verified)",
    "Committed markdown eval report: precision@5, recall@5, MRR for dense-only vs. BM25-only vs. hybrid vs. hybrid+rerank; RAGAS faithfulness + answer relevance for the best config; a short 'what I'd improve' section",
    "README a hiring manager can skim in 3 minutes: architecture diagram, results table, limitations",
  ],
  stretchGoals: [
    "Agentic mode: expose retrieval as a tool to your Lab 02 loop, let the model reformulate and re-query, and compare its eval metrics (and cost) against the fixed pipeline",
    "Add HyDE and/or query decomposition behind config flags and report whether they move your retrieval metrics enough to justify the extra LLM call",
    "Chunking ablation: run the full eval at three chunk sizes and two overlap settings; include the sensitivity table in the report",
  ],
};
