import type { Lesson } from "@/lib/types";

export const lesson05: Lesson = {
  slug: "grounded-generation-and-evaluation",
  title: "Grounded Generation & Evaluation from Day One",
  minutes: 40,
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
      code: `# Colab cell 1 — run once. Set your key in the 🔑 panel (name it
# ANTHROPIC_API_KEY) or just paste it when prompted.
!pip install -q anthropic

import os
try:
    from google.colab import userdata
    os.environ["ANTHROPIC_API_KEY"] = userdata.get("ANTHROPIC_API_KEY")
except Exception:
    from getpass import getpass
    os.environ.setdefault("ANTHROPIC_API_KEY", getpass("Anthropic API key: "))

import re
import anthropic

llm = anthropic.Anthropic()

# The same small pre-chunked corpus as lessons 3-4.
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

def generate_grounded(query: str, chunk_ids: list[int]) -> dict:
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
        model="claude-sonnet-5", max_tokens=1024,
        system=system,
        messages=[{"role": "user",
                   "content": f"Context:\\n{context}\\n\\nQuestion: {query}"}],
    )
    answer = next(b.text for b in resp.content if b.type == "text")
    cited = sorted({int(m) for m in re.findall(r"\\[(\\d+)\\]", answer)})
    valid = [c for c in cited if 1 <= c <= len(chunk_ids)]
    return {"answer": answer, "cited_passages": valid,
            "invalid_citations": [c for c in cited if c not in valid],
            "chunk_ids": chunk_ids}

# ids picked by hand here; in the lab they come from lesson 4's retrieve_pipeline
result = generate_grounded("How do I reset my password?", [2, 0, 5])
print(result["answer"])
print("cited:", result["cited_passages"], " invalid:", result["invalid_citations"])`,
      explanation:
        "Three load-bearing choices: an explicit refusal string (so \"can't answer\" is machine-detectable, not prose), parsing the citation markers back out, and **validating them against the passages that actually exist** — a model that cites [7] when you sent five passages just told you, for free, that it's fabricating; log `invalid_citations` as a first-class unfaithfulness signal. In the eval harness the same parse also checks whether the *right* sources got cited.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `# Colab cell 1 — run once. Set your key in the 🔑 panel (name it
# OPENAI_API_KEY) or just paste it when prompted.
!pip install -q openai

import os
try:
    from google.colab import userdata
    os.environ["OPENAI_API_KEY"] = userdata.get("OPENAI_API_KEY")
except Exception:
    from getpass import getpass
    os.environ.setdefault("OPENAI_API_KEY", getpass("OpenAI API key: "))

import re
from openai import OpenAI

llm = OpenAI()

# The same small pre-chunked corpus as lessons 3-4.
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

def generate_grounded(query: str, chunk_ids: list[int]) -> dict:
    context = "\\n\\n".join(
        f"[{i + 1}] (source: {chunks[cid]['doc_id']} / {chunks[cid]['heading']})\\n"
        f"{chunks[cid]['text']}"
        for i, cid in enumerate(chunk_ids)
    )
    instructions = (
        "You answer questions about a document corpus.\\n"
        "Rules:\\n"
        "1. Use ONLY the numbered context passages. No outside knowledge.\\n"
        "2. Cite the passage number after every factual claim, like [2].\\n"
        "3. If the passages do not contain the answer, reply exactly: "
        "'The corpus does not contain enough information to answer this.'"
    )
    resp = llm.responses.create(
        model="gpt-5.5",
        instructions=instructions,
        input=[{"role": "user",
                "content": f"Context:\\n{context}\\n\\nQuestion: {query}"}],
    )
    answer = resp.output_text
    cited = sorted({int(m) for m in re.findall(r"\\[(\\d+)\\]", answer)})
    valid = [c for c in cited if 1 <= c <= len(chunk_ids)]
    return {"answer": answer, "cited_passages": valid,
            "invalid_citations": [c for c in cited if c not in valid],
            "chunk_ids": chunk_ids}

# ids picked by hand here; in the lab they come from lesson 4's retrieve_pipeline
result = generate_grounded("How do I reset my password?", [2, 0, 5])
print(result["answer"])
print("cited:", result["cited_passages"], " invalid:", result["invalid_citations"])`,
          explanation:
            "The grounding rules go in `instructions` (OpenAI's name for the system prompt, vs. Anthropic's `system` param), `max_tokens` is optional here where the Messages API requires it, and the answer is simply `resp.output_text`. Everything that makes this snippet worth stealing — the exact refusal string, citation parsing, and out-of-range validation — is identical across providers.",
        },
      ],
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
      code: `# Colab cell 2 — run cell 1 first (it defines chunks). This cell rebuilds
# lesson 4's compact retrieval stack, then scores every config side by side.
!pip install -q sentence-transformers rank-bm25

import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder, SentenceTransformer

encoder = SentenceTransformer("all-MiniLM-L6-v2")
doc_vecs = encoder.encode([c["embed_text"] for c in chunks],
                          normalize_embeddings=True)
bm25 = BM25Okapi([c["text"].lower().split() for c in chunks])
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

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

def rerank(query: str, candidate_ids: list[int], top: int = 5) -> list[int]:
    pairs = [(query, chunks[cid]["text"]) for cid in candidate_ids]
    order = np.argsort(reranker.predict(pairs))[::-1][:top]
    return [candidate_ids[i] for i in order]

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

# In Lab 03 this is a labeled JSON file; inline items keep the cell runnable.
eval_set = [
    {"question": "How do I get back into my account?",
     "relevant_chunk_ids": [2]},
    {"question": "What does ERR_CONN_5031 mean?",
     "relevant_chunk_ids": [1]},
    {"question": "Why do ingestion jobs stall on big PDFs?",
     "relevant_chunk_ids": [4]},
    {"question": "How often do we send invoices?",
     "relevant_chunk_ids": [3]},
    {"question": "How long are event logs kept in the EU?",
     "relevant_chunk_ids": [8]},
]

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
        "This loop — four configs, three metrics, one comparison table — *is* Lab 03's deliverable and the artifact a hiring panel wants to see. Diagnostic reading: high recall + low precision → rerank harder or retrieve fewer; low recall → fix chunking or add the missing retrieval mode; good retrieval numbers but wrong final answers → the problem is *generation*, so look at faithfulness next. With a ten-chunk corpus the absolute numbers are toys (MRR separates the configs most visibly here); Lab 03's labeled set over a real corpus is where the deltas become meaningful.",
    },
    {
      type: "callout",
      kind: "career",
      text: 'A RAG pipeline **with a real evaluation harness** — retrieval precision/recall, faithfulness, answer relevance, not just "it works on my three test questions" — is one of the portfolio projects hiring managers most often cite as generating callbacks. RAGAS appears by name in job postings, and the metrics table this loop prints is precisely what separates your repo from the thousand tutorial RAG clones on GitHub: it proves you tune systems by measurement, which is the actual job.',
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
      type: "paragraph",
      text: "\"Distrust the judge\" deserves specifics, because **an unvalidated judge is a random-number generator with confidence**. The known biases: *position bias* (in A/B comparisons, judges favor whichever answer they read first — always score both orders and average); *self-preference* (a model rates its own family's outputs higher — use a different model as judge than as generator when you can); *verbosity bias* (longer answers score higher at equal correctness); and *rubric drift* (vague criteria like 'is this good?' produce incoherent scores — judge one narrow question per call, with the rubric spelled out). The calibration ritual before trusting any judge: hand-label 30–50 answers yourself, run the judge over them, and check agreement; if judge-vs-human agreement is poor, fix the judge prompt before believing a single dashboard number. Seniors treat the judge as a component with its own eval — juniors treat its output as ground truth.",
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
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "A teammate builds the eval set by having the RAG system's own generator model draft one question per chunk, then — pressed for time — skips human verification and ships. Retrieval metrics come back at a glorious P@5 = 0.94. Two weeks later, real users report constant retrieval misses. What inflated the number?",
      answer:
        "Two compounding biases. **Lexical leakage**: LLM-drafted questions parrot the source chunk's exact vocabulary ('What does the retry_backoff_max flag configure?' straight from a chunk about `retry_backoff_max`), so both BM25 and dense retrieval find the source trivially — the eval measures string echo, not retrieval. Real users ask 'why does it keep retrying forever?' — paraphrase, vaguer, no shared terms. **Distribution mismatch**: one question per sampled chunk means every question is answerable, single-hop, and chunk-aligned; real traffic includes multi-hop questions, unanswerables, and questions whose evidence straddles chunks. The number was real; the test was fake. Fixes: human-verify and *rewrite questions away from source wording*, seed the set with real user queries as soon as any exist, include unanswerables and multi-hop items, and treat a suspiciously high score as a bug in the eval before a triumph of the pipeline. The interview line: **an eval set is a claim about your traffic distribution — validate the claim, not just the pipeline.**",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"Users say the RAG assistant 'gives wrong answers.' You have an eval set and one afternoon. Walk me through the debugging tree, with the metric that gates each branch.\"",
      answer:
        "Narrate it as a decision tree, gating each branch on a number. **Step 0**: reproduce — run the eval set, get the table: P@5, R@5, MRR per config, faithfulness, refusal accuracy. **Branch on recall@5**: *low* → the evidence never reaches the prompt; go upstream — read twenty raw chunks (chunking autopsy, Lesson 2), check whether misses cluster on exact-token queries (add/fix hybrid) or paraphrase (embedding model), and verify ANN recall vs brute force (Lesson 3). No generation work until recall recovers. *High recall but low MRR* → evidence retrieved but buried; that's the reranker's exact job — add or tune it (Lesson 4). *High recall, good MRR, low precision* → junk rides along with the evidence; retrieve fewer, rerank harder, threshold scores. **All retrieval metrics healthy but answers still wrong** → generation: check faithfulness (claims vs context), invalid-citation rate, and whether wrong answers correlate with low rerank scores (abstention threshold missing). **Also always check the unanswerable subset** — if refusal accuracy is poor, users experience confident fabrication as 'wrong answers' regardless of retrieval quality. Close with discipline: one change per re-run, and the failing eval items become regression fixtures (Module 2's habit). **Follow-up probe:** \"everything's green but users still complain\" → the eval set no longer matches traffic — sample recent production queries, label them, and refresh the set; green dashboards on a stale distribution are how RAG rots silently.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Your faithfulness metric comes from an LLM judge. Convince me I should believe it." — the validation story, end to end.',
      answer:
        "Structure: calibrate, de-bias, monitor. **Calibrate**: hand-label 30–50 answers for faithfulness yourself (or with a teammate for inter-rater agreement — if two humans can't agree, no judge can be validated against you); run the judge on the same items; report agreement. Below ~85–90% agreement, iterate on the judge prompt — narrower rubric, claim-by-claim decomposition instead of holistic scores, explicit examples of supported vs unsupported — and re-calibrate. **De-bias by construction**: judge a *different model family* than the generator (self-preference), score claims individually rather than whole answers (verbosity bias), randomize or dual-order any pairwise comparisons (position bias), and pin the judge model version so scores are comparable across weeks. **Monitor**: keep a canary set of known-faithful and known-unfaithful answers in every eval run — if the judge's scores on the canaries drift, the judge changed, not your pipeline; and spot-check a random 5% of judge verdicts by hand each cycle. The one-liner that lands the point: **the judge is a model in production — it gets an eval too.** **Follow-up probe:** \"judge agreement is 92% — done?\" → check *which* 8% disagree: if they're all near-miss borderline claims, fine; if the judge systematically passes fabricated numbers or misses negations, the 92% is hiding a correlated blind spot your users will find.",
    },
    {
      type: "keypoints",
      points: [
        "Ground hard: context-only answers, per-claim citations, an exact machine-detectable refusal string — and validate cited passage numbers actually exist (out-of-range citations are free unfaithfulness signals).",
        "Build a ≥50-item eval set: LLM-drafted, human-verified and rewritten away from source wording, with unanswerable and multi-hop questions included — an eval set is a claim about your traffic distribution.",
        "Precision@k = junk in prompt; recall@k = evidence missing; MRR = ordering. Each points at a different stage.",
        "Faithfulness (claims supported by context) vs. answer relevance (question addressed) — LLM-as-judge, packaged by RAGAS.",
        "The judge is a model in production: calibrate against human labels, de-bias (position, self-preference, verbosity), pin its version, canary its drift.",
        "One change per eval run. The metrics table is the deliverable — and the interview artifact.",
      ],
    },
  ],
};
