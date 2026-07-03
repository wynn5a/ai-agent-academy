import type { Lesson } from "@/lib/types";

export const lesson04: Lesson = {
  slug: "reranking-and-query-rewriting",
  title: "Reranking & Query Rewriting (incl. HyDE)",
  minutes: 25,
  summary:
    "First-stage retrieval is built for recall: get the answer somewhere in the top 50, cheap. A cross-encoder reranker then buys you precision in the top 5 — the biggest quality win per engineering hour. And when the user's question is a lousy search query, rewrite it before retrieving.",
  sections: [
    {
      type: "paragraph",
      text: "Retrieval has a split personality. The first stage must be **fast over the whole corpus**, so it uses bi-encoders and BM25 — both of which score query and document *without ever reading them together*. That independence is what makes precomputation possible, and it's also why first-stage rankings are mediocre at the top: subtle relevance distinctions need joint attention. The fix is a two-stage design: **retrieve top-50 cheaply for recall, then rerank to top-5 with a cross-encoder for precision**.",
    },
    {
      type: "heading",
      text: "Bi-encoder vs. cross-encoder",
    },
    {
      type: "table",
      headers: ["", "Bi-encoder", "Cross-encoder"],
      rows: [
        [
          "Input",
          "Query and document encoded **separately**",
          "Query and document concatenated, attended over **jointly**",
        ],
        [
          "Output",
          "Two vectors → cosine similarity",
          "One direct relevance score per pair",
        ],
        [
          "Precompute?",
          "Yes — document vectors indexed once",
          "No — every query–document pair is a fresh forward pass",
        ],
        [
          "Cost at query time",
          "One query encoding + ANN lookup",
          "One model call **per candidate** (50 candidates = 50 passes)",
        ],
        [
          "Role",
          "First-stage retrieval over millions of chunks",
          "Rerank a few dozen candidates",
        ],
      ],
    },
    {
      type: "code",
      language: "python",
      title: "cross-encoder reranking: top-50 in, top-5 out",
      code: `import numpy as np
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")  # small, local

def rerank(query: str, candidate_ids: list[int], top: int = 5) -> list[int]:
    pairs = [(query, chunks[cid]["text"]) for cid in candidate_ids]
    scores = reranker.predict(pairs)          # one joint forward pass per pair
    order = np.argsort(scores)[::-1][:top]
    return [candidate_ids[i] for i in order]

def retrieve_pipeline(query: str, use_rerank: bool = True) -> list[int]:
    candidates = hybrid_search(query, top=50)     # recall stage (Lesson 3)
    if use_rerank:
        return rerank(query, candidates, top=5)   # precision stage
    return candidates[:5]`,
      explanation:
        'Fifty pair-scorings with a small cross-encoder take a fraction of a second on CPU — trivially worth it for the precision gain, which is why "add a reranker" is the standard first answer to "my RAG retrieves junk." Keep the `use_rerank` flag: the eval report needs hybrid vs. hybrid+rerank as separate rows. Hosted reranking APIs (e.g. Cohere\'s) are the managed version of the same idea.',
    },
    {
      type: "heading",
      text: "When the question isn't a good query",
    },
    {
      type: "list",
      items: [
        '**Query rewriting**: strip conversational fluff, resolve pronouns from chat history ("does *it* support SSO?" → "does Acme Gateway support SSO?"), expand acronyms. Essential for multi-turn RAG chat.',
        '**Query decomposition**: "How does our EU retention policy differ from the US one?" — no single chunk answers a comparison. Split into sub-queries, retrieve for each, answer over the union. Single-shot RAG is *structurally* unable to answer multi-hop questions.',
        "**HyDE (Hypothetical Document Embeddings)**: short queries and long documents live in different regions of embedding space. So generate a *hypothetical answer* to the query and embed **that** as the search probe — documents that resemble a plausible answer are likelier to contain the real one.",
      ],
    },
    {
      type: "code",
      language: "python",
      title: "HyDE and decomposition with the raw SDK",
      code: `import anthropic

llm = anthropic.Anthropic()

def hyde_probe(query: str) -> str:
    """Generate a hypothetical answer passage; embed IT instead of the query."""
    resp = llm.messages.create(
        model="claude-sonnet-4-5", max_tokens=200, temperature=0.3,
        messages=[{"role": "user", "content":
            "Write one short documentation-style paragraph that would plausibly "
            f"answer this question: {query}\\n"
            "It will be used only as a search probe, so generic phrasing is fine."}],
    )
    return resp.content[0].text

def decompose(query: str) -> list[str]:
    """Force a structured tool call that returns standalone sub-questions."""
    resp = llm.messages.create(
        model="claude-sonnet-4-5", max_tokens=512, temperature=0,
        tools=[{
            "name": "sub_questions",
            "description": "Record the standalone sub-questions needed to answer a complex question.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "questions": {"type": "array", "items": {"type": "string"},
                                  "minItems": 1, "maxItems": 4},
                },
                "required": ["questions"],
            },
        }],
        tool_choice={"type": "tool", "name": "sub_questions"},
        messages=[{"role": "user", "content":
            f"Break this into independently searchable sub-questions: {query}"}],
    )
    block = next(b for b in resp.content if b.type == "tool_use")
    return block.input["questions"]

# usage: search with the hypothetical answer, not the raw question
probe_vec = encoder.encode(hyde_probe("why do ingestion jobs stall on large PDFs?"))`,
      explanation:
        "Both techniques reuse Module 1 machinery — HyDE is a plain completion, decomposition is the forced-tool-call structured-output trick. For multi-hop queries: decompose, run `retrieve_pipeline` per sub-question, deduplicate the union of chunks, then generate one answer over all of them.",
    },
    {
      type: "callout",
      kind: "warning",
      title: "Every rewrite is an extra LLM call",
      text: "HyDE and decomposition add latency and tokens to **every query** that uses them. Measure before adopting: run your eval set with and without, and keep them only if the retrieval metrics move. A common production compromise is conditional use — a cheap classifier (or the agent itself) decides whether a query needs decomposition. This is the door to **agentic RAG**: retrieval as a tool the agent calls repeatedly, reformulating queries when results look thin, at the cost of latency, tokens, and debuggability compared to a fixed pipeline.",
    },
    {
      type: "keypoints",
      points: [
        "Two-stage design: cheap high-recall retrieval to top-50, cross-encoder rerank to top-5.",
        "Bi-encoders encode independently (precomputable, scalable); cross-encoders attend jointly (accurate, per-pair cost) — that asymmetry dictates their roles.",
        "Rewriting fixes conversational queries; decomposition fixes multi-hop questions single-shot RAG structurally cannot answer.",
        "HyDE: embed a hypothetical *answer* because answer-shaped text lives nearer to documents than question-shaped text.",
        "Every query-time enhancement costs latency and tokens — adopt only what your eval set proves out.",
      ],
    },
  ],
};
