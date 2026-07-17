import type { Lesson } from "@/lib/types";

export const lesson04: Lesson = {
  slug: "reranking-and-query-rewriting",
  title: "Reranking & Query Rewriting (incl. HyDE)",
  minutes: 35,
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
      code: `# Colab cell 1 — run once; no API key needed. Compactly rebuilds
# lesson 3's hybrid stack (numpy dense + BM25 + RRF, same interface,
# no vector DB) so this notebook stands alone, then adds the reranker.
!pip install -q sentence-transformers rank-bm25

import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder, SentenceTransformer

# The same small pre-chunked corpus as lesson 3.
chunks = [
    {"doc_id": "runbook", "heading": "Retry configuration",
     "text": "Set retry_backoff_max to cap exponential backoff at 60 seconds. "
             "Workers retry failed jobs five times before dead-lettering."},
    {"doc_id": "runbook", "heading": "Connection errors",
     "text": "ERR_CONN_5031 means the gateway dropped a keep-alive connection. "
             "Restart the connection pool or raise the idle timeout."},
    {"doc_id": "faq", "heading": "Account access",
     "text": "To reset your password, open Settings, choose Security, and "
             "select 'Send reset link'. The link expires after one hour."},
    {"doc_id": "faq", "heading": "Billing",
     "text": "Invoices are issued on the first of each month. Enterprise "
             "plans can switch to quarterly billing in the console."},
    {"doc_id": "guide", "heading": "Ingestion pipeline",
     "text": "Large PDFs are split into pages before parsing. Ingestion "
             "jobs that stall usually hit the 50 MB per-file limit."},
    {"doc_id": "guide", "heading": "Search tuning",
     "text": "Hybrid search fuses BM25 and dense rankings with reciprocal "
             "rank fusion. Tune top-k on a labeled eval set."},
    {"doc_id": "guide", "heading": "Single sign-on",
     "text": "SAML SSO is available on enterprise plans. Configure the "
             "identity provider under Settings > Authentication."},
    {"doc_id": "runbook", "heading": "Deployments",
     "text": "Deploys roll out region by region. A failed health check "
             "pauses the rollout and pages the on-call engineer."},
    {"doc_id": "guide", "heading": "Data retention",
     "text": "Event logs are retained for 90 days by default. EU tenants "
             "can shorten retention to 30 days for compliance."},
    {"doc_id": "faq", "heading": "Plan changes",
     "text": "Upgrades apply immediately; downgrades take effect at the "
             "next billing cycle. Seat counts adjust pro rata."},
]
for c in chunks:
    c["embed_text"] = f"{c['heading']}\\n{c['text']}"

encoder = SentenceTransformer("all-MiniLM-L6-v2")
doc_vecs = encoder.encode([c["embed_text"] for c in chunks],
                          normalize_embeddings=True)
bm25 = BM25Okapi([c["text"].lower().split() for c in chunks])

def dense_search(query: str, k: int = 50) -> list[int]:
    q = encoder.encode(query, normalize_embeddings=True)
    return [int(i) for i in np.argsort(doc_vecs @ q)[::-1][:k]]

def bm25_search(query: str, k: int = 50) -> list[int]:
    scores = bm25.get_scores(query.lower().split())
    return [int(i) for i in np.argsort(scores)[::-1][:k]]

def rrf_fuse(rankings: list[list[int]], k: int = 60, top: int = 50) -> list[int]:
    scores: dict[int, float] = {}
    for ranking in rankings:
        for rank, chunk_id in enumerate(ranking):
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores, key=lambda cid: scores[cid], reverse=True)[:top]

def hybrid_search(query: str, top: int = 50) -> list[int]:
    return rrf_fuse([dense_search(query), bm25_search(query)], top=top)

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
    return candidates[:5]

q = "what does ERR_CONN_5031 mean"
print("without rerank:", [chunks[c]["heading"] for c in retrieve_pipeline(q, use_rerank=False)])
print("with rerank:   ", [chunks[c]["heading"] for c in retrieve_pipeline(q)])`,
      explanation:
        'Fifty pair-scorings with a small cross-encoder take a fraction of a second on CPU — trivially worth it for the precision gain, which is why "add a reranker" is the standard first answer to "my RAG retrieves junk." Keep the `use_rerank` flag: the eval report needs hybrid vs. hybrid+rerank as separate rows. Hosted reranking APIs (e.g. Cohere\'s) are the managed version of the same idea. The top half of the cell rebuilds lesson 3\'s hybrid stack over numpy — same interface, no vector DB — so this notebook runs on its own.',
    },
    {
      type: "heading",
      text: "After the rerank: three decisions people forget",
    },
    {
      type: "list",
      items: [
        "**How many chunks to pass (k).** More chunks raise recall but dilute precision, burn prompt budget, and give the model more rope to ground in the wrong passage. k=3–8 is the usual range; tune it on the eval set like everything else, and remember k interacts with chunk size — 5 × 350 words is a very different prompt from 5 × 1,200.",
        "**Order matters in the prompt.** Models attend more reliably to the start and end of the context than the middle (the 'lost in the middle' effect). Put the strongest chunks first — or first *and* last — rather than trusting the model to weigh ten passages evenly. The reranker's scores tell you the order; use them.",
        "**Scores are an abstention signal.** A cross-encoder's top score being *low* is information: the shortlist is weak, and weak context invites the model to freelance. Threshold it — below the bar, retrieve differently (rewrite, decompose) or refuse honestly. This wires directly into Lesson 5's 'confidently answers unanswerable questions' defense, and it's the cheapest hallucination guard in the whole pipeline.",
      ],
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
      code: `# Colab cell 2 — run cell 1 first (it defines chunks, encoder, doc_vecs).
# Set your key in the 🔑 panel (name it ANTHROPIC_API_KEY) or paste it.
!pip install -q anthropic

import os
try:
    from google.colab import userdata
    os.environ["ANTHROPIC_API_KEY"] = userdata.get("ANTHROPIC_API_KEY")
except Exception:
    from getpass import getpass
    os.environ.setdefault("ANTHROPIC_API_KEY", getpass("Anthropic API key: "))

import anthropic

llm = anthropic.Anthropic()

def hyde_probe(query: str) -> str:
    """Generate a hypothetical answer passage; embed IT instead of the query."""
    resp = llm.messages.create(
        model="claude-sonnet-5", max_tokens=200,
        messages=[{"role": "user", "content":
            "Write one short documentation-style paragraph that would plausibly "
            f"answer this question: {query}\\n"
            "It will be used only as a search probe, so generic phrasing is fine."}],
    )
    return next(b.text for b in resp.content if b.type == "text")

def decompose(query: str) -> list[str]:
    """Force a structured tool call that returns standalone sub-questions."""
    resp = llm.messages.create(
        model="claude-sonnet-5", max_tokens=512,
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

print(decompose("How does our EU retention policy differ from the US one?"))

# search with the hypothetical answer, not the raw question
probe = hyde_probe("why do ingestion jobs stall on large PDFs?")
print("HyDE probe:", probe[:80] + "...")
q_vec = encoder.encode(probe, normalize_embeddings=True)      # encoder from cell 1
top = [int(i) for i in np.argsort(doc_vecs @ q_vec)[::-1][:3]]
print("HyDE retrieves:", [chunks[i]["heading"] for i in top])`,
      explanation:
        "Both techniques reuse Module 1 machinery — HyDE is a plain completion, decomposition is the forced-tool-call structured-output trick. For multi-hop queries: decompose, run `retrieve_pipeline` per sub-question, deduplicate the union of chunks, then generate one answer over all of them.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `# Colab cell 2 — run cell 1 first (it defines chunks, encoder, doc_vecs).
# Set your key in the 🔑 panel (name it OPENAI_API_KEY) or paste it.
!pip install -q openai

import os
try:
    from google.colab import userdata
    os.environ["OPENAI_API_KEY"] = userdata.get("OPENAI_API_KEY")
except Exception:
    from getpass import getpass
    os.environ.setdefault("OPENAI_API_KEY", getpass("OpenAI API key: "))

import json
from openai import OpenAI

llm = OpenAI()

def hyde_probe(query: str) -> str:
    """Generate a hypothetical answer passage; embed IT instead of the query."""
    resp = llm.responses.create(
        model="gpt-5.5",
        input=[{"role": "user", "content":
            "Write one short documentation-style paragraph that would plausibly "
            f"answer this question: {query}\\n"
            "It will be used only as a search probe, so generic phrasing is fine."}],
    )
    return resp.output_text

SUB_QUESTIONS_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {"type": "array", "items": {"type": "string"},
                      "minItems": 1, "maxItems": 4},
    },
    "required": ["questions"],
    "additionalProperties": False,
}

def decompose(query: str) -> list[str]:
    """Constrain the output to a JSON schema of standalone sub-questions."""
    resp = llm.responses.create(
        model="gpt-5.5",
        input=[{"role": "user", "content":
            f"Break this into independently searchable sub-questions: {query}"}],
        text={"format": {"type": "json_schema", "name": "sub_questions",
                         "schema": SUB_QUESTIONS_SCHEMA, "strict": True}},
    )
    return json.loads(resp.output_text)["questions"]

print(decompose("How does our EU retention policy differ from the US one?"))

# search with the hypothetical answer, not the raw question
probe = hyde_probe("why do ingestion jobs stall on large PDFs?")
print("HyDE probe:", probe[:80] + "...")
q_vec = encoder.encode(probe, normalize_embeddings=True)      # encoder from cell 1
top = [int(i) for i in np.argsort(doc_vecs @ q_vec)[::-1][:3]]
print("HyDE retrieves:", [chunks[i]["heading"] for i in top])`,
          explanation:
            "HyDE is the same plain completion, read off `resp.output_text`. For decomposition, OpenAI's native structured outputs (`text.format` with `strict: True` — note the required `additionalProperties: False`) replace Anthropic's forced-tool-call trick: the schema is enforced server-side and you `json.loads` the text, instead of fishing a `tool_use` block out of the response.",
        },
      ],
    },
    {
      type: "callout",
      kind: "warning",
      title: "Every rewrite is an extra LLM call",
      text: "HyDE and decomposition add latency and tokens to **every query** that uses them. Measure before adopting: run your eval set with and without, and keep them only if the retrieval metrics move. A common production compromise is conditional use — a cheap classifier (or the agent itself) decides whether a query needs decomposition. This is the door to **agentic RAG**: instead of a fixed pipeline, retrieval becomes a tool the model calls repeatedly, reformulating the query and re-querying when results look thin — a higher quality ceiling on hard multi-hop queries. The price is that every run becomes a different trajectory: a fixed pipeline is a pure function (same query → same stages → same chunks) with predictable latency and cost, cheap to evaluate offline and easy to debug, while an agentic loop's latency and spend vary per query and its failures are harder to attribute, cache, and budget. Sensible default: fixed pipeline first, and reach for retrieval-as-a-tool only where the eval set proves the fixed pipeline fails.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "Match the fix to the symptom, one line each: (a) turn 3 of a chat, user asks 'and does it work with SSO?' — retrieval returns SSO docs for the wrong product; (b) 'compare our EU and US retention policies' scores zero on recall; (c) short vague queries ('pdf stuck') retrieve poorly though the runbook exists; (d) queries containing exact config keys already retrieve perfectly.",
      answer:
        "(a) **Query rewriting with chat history** — resolve 'it' to the product under discussion before retrieval; the retriever never sees the conversation unless you put it in the query. (b) **Decomposition** — no single chunk spans both policies; split into two sub-queries, retrieve each, answer over the union. (c) **HyDE** — 'pdf stuck' is question-shaped and information-poor; a hypothetical answer paragraph ('Large PDF ingestion can stall when...') lands in the runbook's neighborhood. (d) **Nothing** — hybrid already nails exact tokens; adding rewrites here spends latency and tokens on solved queries. The senior tell is (d): knowing when to *stop* adding machinery — every technique must pay rent on the eval set.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** Your RAG chatbot is excellent on the first user message and garbage by turn three. Traces show retrieval quality collapsing across turns. Diagnose and fix.",
      answer:
        "Classic multi-turn failure, and the diagnosis is one sentence: **the retriever only sees the latest message, and by turn three the latest message is 'and what about the older version?'** — pronouns, ellipsis, and context-dependent fragments make terrible search probes. Confirm in traces by reading the literal query strings sent to retrieval. Fixes in order: (1) **contextualized rewriting** — a cheap, fast LLM call that rewrites the turn into a standalone query given the chat history ('does Acme Gateway v2 support SAML SSO?'); this is table stakes for RAG chat, not an optimization; (2) rewrite quality is now load-bearing → log every rewrite next to its raw turn, and add rewrites to the eval set (multi-turn eval items: history + turn → expected retrieval); (3) watch the two rewrite failure modes — *over-resolution* (injecting stale topics after the user changed subject) and *latency* (it's a serial LLM call on every turn; use the cheapest model that passes eval). **Follow-up probe:** \"could you skip the rewrite and just embed the whole conversation?\" → embedding a transcript retrieves the *conversation's* topic soup, not the current question — precision collapses; rewriting is compression with intent.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** End-to-end answer latency budget is 800ms at p95. Your pipeline: embed query → hybrid search → rerank 50 → generate. Where does the time actually go, and what do you cut when you're over budget?",
      answer:
        "Ballpark the stages first — knowing the shape of the numbers is the point of the question. Query embedding (small local model): ~5–20ms. Hybrid search (ANN + BM25): ~5–30ms. Cross-encoder rerank of 50: ~50–200ms on CPU, ~15ms on GPU. Generation: **everything else** — hundreds of ms to seconds; it dominates. So the honest first answer: the retrieval side is rarely the bottleneck, and cutting rerank to save 100ms while generation takes 2s is optimizing the wrong stage. Real levers in order: (1) **stream the generation** — perceived latency is time-to-first-token (Module 1), which retrieval work delays serially, so the retrieval stages *are* worth trimming for TTFT; (2) rerank fewer candidates (50→20 loses little), or use a lighter reranker; (3) make rewrites/HyDE **conditional** — they're serial LLM calls that double the pre-generation latency, so gate them on a cheap heuristic (query length, chat context present); (4) cache — frequent-query embedding cache, even full answer cache for FAQ-shaped traffic. And say the discipline: measure per-stage latency in the trace before cutting anything. **Follow-up probe:** \"TTFT is fine but total time ballooned after adding decomposition\" → you're doing N retrievals + one big generation serially; parallelize the sub-query retrievals and cap N.",
    },
    {
      type: "keypoints",
      points: [
        "Two-stage design: cheap high-recall retrieval to top-50, cross-encoder rerank to top-5.",
        "Bi-encoders encode independently (precomputable, scalable); cross-encoders attend jointly (accurate, per-pair cost) — that asymmetry dictates their roles.",
        "Rewriting fixes conversational queries; decomposition fixes multi-hop questions single-shot RAG structurally cannot answer.",
        "HyDE: embed a hypothetical *answer* because answer-shaped text lives nearer to documents than question-shaped text.",
        "After reranking: tune k on the eval set, order strongest chunks first (lost-in-the-middle), and threshold low scores into abstention or re-retrieval.",
        "Multi-turn chat requires contextualized query rewriting — the retriever never sees the conversation unless the rewrite puts it there.",
        "Every query-time enhancement costs latency and tokens — adopt only what your eval set proves out. Generation dominates total latency; retrieval stages dominate TTFT.",
      ],
    },
  ],
};
