import type { Lesson } from "@/lib/types";

export const lesson05: Lesson = {
  slug: "grounded-generation-and-evaluation",
  title: "Grounded Generation & Evaluation from Day One",
  minutes: 30,
  summary:
    "The senior differentiator: citations the reader can check, a labeled eval set, retrieval metrics (precision@k, recall@k, MRR), and generation metrics (faithfulness, answer relevance). If you can't produce a metrics table, you don't know if your RAG works.",
  sections: [
    {
      type: "paragraph",
      text: "Generation is where all upstream work either pays off or gets squandered. The failure mode to fear is **unfaithfulness**: the model ignores the retrieved context and answers from its weights — fluently, confidently, and unverifiably. The defenses are prompt-level (answer *only* from context, cite every claim, refuse when evidence is missing) and eval-level (measure faithfulness continuously). Citations aren't decoration: they make every answer auditable, and **citation accuracy is itself a metric**.",
    },
    {
      type: "code",
      language: "python",
      title: "grounded generation with checkable citations",
      code: `def generate_grounded(query: str, chunk_ids: list[int]) -> dict:
    context = "\\n\\n".join(
        f"[{i + 1}] (source: {chunks[cid]['doc_id']} / {chunks[cid]['heading']})\\n"
        f"{chunks[cid]['text']}"
        for i, cid in enumerate(chunk_ids)
    )
    system = (
        "You answer questions about a document corpus.\\n"
        "Rules:\\n"
        "1. Use ONLY the numbered context passages. No outside knowledge.\\n"
        "2. Cite the passage number after every factual claim, like [2].\\n"
        "3. If the passages do not contain the answer, reply exactly: "
        "'The corpus does not contain enough information to answer this.'"
    )
    resp = llm.messages.create(
        model="claude-sonnet-4-5", max_tokens=1024, temperature=0,
        system=system,
        messages=[{"role": "user",
                   "content": f"Context:\\n{context}\\n\\nQuestion: {query}"}],
    )
    answer = resp.content[0].text
    cited = sorted({int(m) for m in re.findall(r"\\[(\\d+)\\]", answer)})
    return {"answer": answer, "cited_passages": cited, "chunk_ids": chunk_ids}`,
      explanation:
        'Three load-bearing choices: temperature 0 (grounded QA wants determinism), an explicit refusal string (so "can\'t answer" is machine-detectable, not prose), and parsing the citation markers back out — which lets you verify every cited passage exists and, in the eval harness, check whether the *right* sources got cited.',
    },
    {
      type: "paragraph",
      text: "Retrieval metrics come first, and they require a **labeled eval set**: question / expected answer / source chunk(s) triples. Even 50 examples is transformative. Build it cheaply but credibly: sample chunks, have an LLM draft a question each chunk answers, then **human-verify every item** (delete the bad ones — LLM-generated questions can be unnaturally well-matched to their source's wording, which inflates scores). Add 5–10 questions the corpus *cannot* answer, to test refusal.",
    },
    {
      type: "table",
      headers: ["Metric", "Definition", "What a low value tells you"],
      rows: [
        [
          "Precision@k",
          "Of the k retrieved chunks, what fraction are relevant?",
          "You're stuffing the prompt with junk — poisoning generation",
        ],
        [
          "Recall@k",
          "Of all relevant chunks, what fraction made the top k?",
          "The evidence isn't reaching the model — no generation fix can help",
        ],
        [
          "MRR",
          "Mean of 1/rank of the *first* relevant chunk",
          "Relevant results exist but rank low — a reranker's exact job",
        ],
      ],
    },
    {
      type: "code",
      language: "python",
      title: "the eval harness: every config, every metric, one table",
      code: `import json

def precision_at_k(retrieved: list[int], relevant: set[int], k: int = 5) -> float:
    top = retrieved[:k]
    return sum(1 for c in top if c in relevant) / len(top) if top else 0.0

def recall_at_k(retrieved: list[int], relevant: set[int], k: int = 5) -> float:
    return sum(1 for c in retrieved[:k] if c in relevant) / len(relevant)

def reciprocal_rank(retrieved: list[int], relevant: set[int]) -> float:
    for rank, c in enumerate(retrieved, start=1):
        if c in relevant:
            return 1.0 / rank
    return 0.0

CONFIGS = {
    "dense":         lambda q: dense_search(q, k=50)[:5],
    "bm25":          lambda q: bm25_search(q, k=50)[:5],
    "hybrid":        lambda q: hybrid_search(q, top=50)[:5],
    "hybrid+rerank": lambda q: rerank(q, hybrid_search(q, top=50), top=5),
}

eval_set = json.load(open("eval_set.json"))   # [{question, answer, relevant_chunk_ids}]

for name, search in CONFIGS.items():
    p, r, rr = [], [], []
    for item in eval_set:
        retrieved = search(item["question"])
        relevant = set(item["relevant_chunk_ids"])
        p.append(precision_at_k(retrieved, relevant))
        r.append(recall_at_k(retrieved, relevant))
        rr.append(reciprocal_rank(retrieved, relevant))
    n = len(eval_set)
    print(f"{name:14s} P@5={sum(p)/n:.3f}  R@5={sum(r)/n:.3f}  MRR={sum(rr)/n:.3f}")`,
      explanation:
        "This loop — four configs, three metrics, one comparison table — *is* Lab 03's deliverable and the artifact a hiring panel wants to see. Diagnostic reading: high recall + low precision → rerank harder or retrieve fewer; low recall → fix chunking or add the missing retrieval mode; good retrieval numbers but wrong final answers → the problem is *generation*, so look at faithfulness next.",
    },
    {
      type: "heading",
      text: "Generation metrics: faithfulness & answer relevance",
    },
    {
      type: "paragraph",
      text: "**Faithfulness**: is every claim in the answer supported by the retrieved context? **Answer relevance**: does the answer actually address the question (a perfectly faithful non-answer scores high on one, low on the other)? Both are measured with **LLM-as-judge**: decompose the answer into atomic claims, then ask a judge model whether each claim is entailed by the context — faithfulness is the supported fraction. The **RAGAS** library packages these (plus context precision/recall) as off-the-shelf metrics; use it in the lab, but implement faithfulness once by hand so you can explain — and distrust — the judge.",
    },
    {
      type: "animation",
      name: "eval-loop",
      caption:
        "The improvement flywheel: run the eval set → read the metrics table → change ONE stage → re-run. Never tune two stages on one measurement.",
    },
    {
      type: "callout",
      kind: "insight",
      title: "The debugging decision tree",
      text: "Your system confidently answers questions the corpus can't support? Three mitigations, layered: (1) **prompt** — an explicit, exact refusal path; (2) **threshold** — abstain when top retrieval/rerank scores are weak, because low-scoring context invites the model to freelance; (3) **measure** — faithfulness and citation checks in the eval loop, including the unanswerable questions in your eval set. High recall@5 but wrong answers means retrieval delivered and generation dropped the ball — that's a faithfulness problem, not a search problem.",
    },
    {
      type: "keypoints",
      points: [
        "Ground hard: context-only answers, per-claim citations, an exact machine-detectable refusal string, temperature 0.",
        "Build a ≥50-item eval set: LLM-drafted, human-verified, with unanswerable questions included.",
        "Precision@k = junk in prompt; recall@k = evidence missing; MRR = ordering. Each points at a different stage.",
        "Faithfulness (claims supported by context) vs. answer relevance (question addressed) — LLM-as-judge, packaged by RAGAS.",
        "One change per eval run. The metrics table is the deliverable — and the interview artifact.",
      ],
    },
  ],
};
