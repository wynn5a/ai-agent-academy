import type { QuizQuestion } from "@/lib/types";

export const quiz03: QuizQuestion[] = [
  {
    question:
      "Why is chunking called the highest-leverage decision in a RAG pipeline?",
    options: [
      "Because chunking determines the embedding model's dimensionality",
      "Because smaller chunks are always better and chunking is where you minimize size",
      "Because chunks are the unit of embedding, retrieval, and grounding — if an answer is sliced across a boundary or buried in noise at index time, no reranker or fusion downstream can recover it",
      "Because vector databases charge per chunk, so chunking dominates cost",
    ],
    correct: 2,
    explanation:
      "Every downstream stage can only reorder, merge, or read the chunks that exist. A fact fragmented across a cut retrieves poorly from both halves forever. That's also why 'read twenty raw chunks' is the first debugging step — and why chunking choices should be settled by re-running retrieval metrics, not by taste.",
  },
  {
    question:
      "Which two query types does dense (embedding) retrieval handle poorly while BM25 handles them well?",
    options: [
      "Exact identifiers (error codes, SKUs, config keys) and rare proper nouns/acronyms the embedding model never learned",
      "Paraphrased questions and synonym-heavy queries",
      "Long conversational questions and multi-hop comparisons",
      "Questions in languages other than English and questions with typos",
    ],
    correct: 0,
    explanation:
      "Embedding models squash rare tokens toward noise, so 'ERR_CONN_5031' or an internal project name is a blur to them — while BM25's IDF weighting treats a rare exact term as gold. The reverse holds for paraphrase (option B), which is where dense wins and BM25's zero term overlap fails.",
  },
  {
    question:
      "How does Reciprocal Rank Fusion (RRF) combine BM25 and dense results, and why ranks instead of scores?",
    options: [
      "It averages the BM25 score and cosine similarity after min-max normalization",
      "Each document receives 1/(k + rank) from every ranking that contains it, summed and sorted; ranks are used because BM25 scores and cosine similarities live on incomparable, corpus-dependent scales",
      "It takes the intersection of both top-k lists and orders it by dense score",
      "It alternates results: one from BM25, one from dense, until k are chosen",
    ],
    correct: 1,
    explanation:
      "BM25 scores are unbounded and corpus-dependent; cosine similarities cluster in a narrow band — any weighted score sum is an arbitrary hack that breaks when you swap models. Rank position is the only stable common currency, and the constant k (~60) damps the dominance of rank-1 results.",
  },
  {
    question:
      "Why are bi-encoders used for first-stage retrieval but cross-encoders for reranking?",
    options: [
      "Cross-encoders produce vectors that are too large to index",
      "Bi-encoders are more accurate but slower, so they're reserved for the smaller candidate set",
      "Cross-encoders can only process 50 documents due to context-window limits",
      "Bi-encoders encode query and document independently, so document vectors can be precomputed and searched at corpus scale; cross-encoders attend over each query–document pair jointly — more accurate, but requiring a fresh forward pass per pair, affordable only for a few dozen candidates",
    ],
    correct: 3,
    explanation:
      "The independence of bi-encoder encoding is exactly what enables precomputation and ANN search over millions of chunks — and exactly why it misses subtle relevance that requires reading query and document together. The two-stage design uses each where its cost structure fits: recall at scale, then joint-attention precision on the shortlist.",
  },
  {
    question: "Define precision@5, recall@5, and MRR.",
    options: [
      "Precision@5 = fraction of the corpus retrieved; recall@5 = retrieval speed; MRR = mean rerank ratio",
      "Precision@5 = fraction of the top 5 retrieved chunks that are relevant; recall@5 = fraction of all relevant chunks that appear in the top 5; MRR = mean over queries of 1/rank of the first relevant chunk",
      "All three measure the same thing at different k values",
      "Precision@5 = answer correctness for 5 questions; recall@5 = memory usage; MRR = model response rate",
    ],
    correct: 1,
    explanation:
      "Precision@k asks 'how much of what I fetched is junk?'; recall@k asks 'did the evidence make it in at all?'; MRR asks 'how high does the first good result rank?'. All three require a labeled eval set mapping questions to their relevant chunks.",
  },
  {
    question:
      "Your recall@5 is high but final answers are frequently wrong. Where do you look first?",
    options: [
      "At generation: the evidence is reaching the prompt, so the failure is downstream — check faithfulness (is the model using the context or answering from its weights?) and precision (is junk alongside the good chunks poisoning it?)",
      "At the embedding model: high recall means the embeddings are broken",
      "At chunk size: high recall always indicates chunks are too small",
      "At the vector database: high recall with wrong answers indicates index corruption",
    ],
    correct: 0,
    explanation:
      "High recall@5 means the relevant chunks are in the top 5 — retrieval did its job and the evidence is in the prompt. Wrong answers therefore implicate generation (unfaithfulness) or distracting junk (low precision). This diagnostic split — retrieval metrics vs. generation metrics — is exactly why you compute both.",
  },
  {
    question:
      "What's the difference between faithfulness and answer relevance, and how does LLM-as-judge measure faithfulness?",
    options: [
      "Faithfulness is retrieval quality, answer relevance is generation quality; both are computed from citation counts",
      "They're synonyms; RAGAS reports them as one score",
      "Faithfulness = every claim in the answer is supported by the retrieved context; answer relevance = the answer actually addresses the question. A judge model decomposes the answer into atomic claims and checks each for entailment by the context — faithfulness is the supported fraction",
      "Faithfulness measures whether the model refused appropriately; relevance measures latency",
    ],
    correct: 2,
    explanation:
      "The two are independent failure axes: a faithful non-answer ('the docs describe the config format' when asked for a specific value) scores high faithfulness, low relevance. Claim decomposition + entailment checking is the standard LLM-as-judge recipe RAGAS packages — implement it once by hand so you can explain and sanity-check the judge.",
  },
  {
    question: "How do you build a retrieval eval set cheaply but credibly?",
    options: [
      "Use any public QA benchmark — corpus-specific labels aren't necessary",
      "Sample chunks, have an LLM draft a question each chunk answers (recording the source chunk as the relevance label), then human-verify every item and add some questions the corpus cannot answer",
      "Have the RAG system generate both questions and answers, and mark its own retrievals as relevant",
      "Collect production queries for six months before evaluating anything",
    ],
    correct: 1,
    explanation:
      "LLM-assisted generation makes 50+ items affordable; human verification keeps it credible (LLM questions can parrot the source's wording, inflating retrieval scores — cull those). Option C is circular: the system grading its own retrievals as ground truth measures nothing. Unanswerable questions test the refusal path.",
  },
  {
    question:
      "What is query decomposition, and when is single-shot RAG structurally unable to answer?",
    options: [
      "Splitting long queries to fit the embedding model's token limit; needed for queries over 512 tokens",
      "Tokenizing the query for BM25; needed for all lexical search",
      "Rewriting the query at lower temperature; needed when answers are non-deterministic",
      "Breaking a complex question into independently searchable sub-questions, retrieving for each, and answering over the union — needed for multi-hop/comparison questions where no single chunk contains the answer, so no single retrieval can ever surface sufficient evidence",
    ],
    correct: 3,
    explanation:
      "'How does the EU retention policy differ from the US one?' has its evidence split across documents that no one chunk spans. One query → one neighborhood of embedding space → structurally insufficient evidence. Decomposition (or agentic multi-step retrieval) is the fix, at the cost of extra LLM calls.",
  },
  {
    question:
      "Fixed single-shot RAG pipeline vs. agentic retrieval-as-a-tool: what are the trade-offs?",
    options: [
      "Fixed pipeline: predictable latency and cost, easy to eval and debug, but fails on queries needing reformulation or multiple hops. Agentic: the model reformulates and retries retrieval until satisfied — higher quality ceiling on hard queries, but variable latency/cost and much harder to evaluate and debug",
      "Agentic RAG is strictly better and fixed pipelines are legacy",
      "Fixed pipelines are higher quality; agentic RAG only reduces cost",
      "They differ only in code style; behavior is identical",
    ],
    correct: 0,
    explanation:
      "A fixed pipeline is a pure function — same query, same stages, measurable offline, cheap. Agentic retrieval lets the model notice thin results and re-query, which rescues hard cases but makes every run a different trajectory: harder to cache, budget, and attribute failures. Sensible default: fixed pipeline first, agentic mode where the eval set proves the need.",
  },
  {
    question:
      "Your RAG system confidently answers questions the corpus can't support. Name three layered mitigations.",
    options: [
      "Increase temperature, retrieve more chunks, use a bigger model",
      "Switch to BM25-only, remove the reranker, shorten chunks",
      "Prompt an explicit exact refusal string for insufficient context; abstain when retrieval/rerank scores fall below a threshold; measure faithfulness and citation accuracy in the eval loop, with unanswerable questions in the eval set",
      "Cache all answers, add overlap, embed the headings",
    ],
    correct: 2,
    explanation:
      "Layer 1 gives the model a sanctioned exit (and makes refusal machine-detectable); layer 2 stops weak evidence from reaching generation at all, since low-scoring context invites freelancing; layer 3 catches what slips through and tracks it over time. All three together — prompt, threshold, measurement — is the production answer.",
  },
  {
    question:
      "How does HyDE improve retrieval, and what does it actually embed?",
    options: [
      "It embeds the query at higher precision using a larger embedding model",
      "It has an LLM generate a hypothetical answer passage to the query, then embeds that passage as the search probe — because answer-shaped text lands nearer to real documents in embedding space than question-shaped text does",
      "It hides the query from the embedding model to avoid bias",
      "It embeds document summaries instead of chunks at index time",
    ],
    correct: 1,
    explanation:
      "Short questions and long documentation passages occupy different regions of embedding space. A plausible fake answer — even a factually wrong one — is *shaped* like the real passage you're hunting, so its vector lands in the right neighborhood. Cost: one extra LLM call per query, so let your eval set decide if it earns its keep.",
  },
];
