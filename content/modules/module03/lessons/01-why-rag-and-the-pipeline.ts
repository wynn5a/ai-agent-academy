import type { Lesson } from "@/lib/types";

export const lesson01: Lesson = {
  slug: "why-rag-and-the-pipeline",
  title: "Why RAG, and the Anatomy of the Pipeline",
  minutes: 35,
  summary:
    "Models know nothing about your private data and their world knowledge is frozen at training time. Retrieval-augmented generation fixes both — but only as well as its weakest stage. Meet the pipeline and the geometry of embeddings.",
  sections: [
    {
      type: "paragraph",
      text: "An LLM's weights encode a snapshot of public text from training time. Ask it about **your company's docs, last week's incident report, or a niche internal API** and it either refuses or — worse — confidently invents. RAG (retrieval-augmented generation) sidesteps retraining entirely: at question time, *search* a corpus for relevant passages, paste them into the prompt as context, and instruct the model to answer **only from that context, with citations**. The model becomes a reasoning engine over evidence you supply, instead of an oracle recalling from memory.",
    },
    {
      type: "animation",
      name: "rag-pipeline",
      caption:
        "Two lanes: an offline indexing lane (ingest → chunk → embed → index) and an online query lane (retrieve → rerank → generate with citations).",
    },
    {
      type: "table",
      headers: ["Stage", "What it does", "How it silently fails"],
      rows: [
        [
          "Ingest",
          "Parse PDFs/HTML/markdown into clean text + metadata",
          "Mangled tables, lost headings, boilerplate noise poisoning every later stage",
        ],
        [
          "Chunk",
          "Split documents into retrievable units",
          "Chunks cut mid-thought; answers straddle two chunks; nothing downstream can repair this",
        ],
        [
          "Embed + index",
          "Map chunks to vectors, store in a vector DB",
          "Wrong model for the domain; chunks too big to embed crisply",
        ],
        [
          "Retrieve",
          "Find top-k candidates for the query",
          "Dense misses exact IDs; BM25 misses paraphrase; top-k too shallow",
        ],
        [
          "Rerank",
          "Reorder candidates by true relevance",
          "Skipped entirely — the biggest precision win left on the table",
        ],
        [
          "Generate",
          "Answer grounded in retrieved context",
          "Model ignores context and answers from its weights (unfaithfulness)",
        ],
      ],
    },
    {
      type: "heading",
      text: "Embeddings: meaning as geometry",
    },
    {
      type: "paragraph",
      text: 'An **embedding model** maps text to a fixed-length vector (hundreds to a few thousand dimensions) such that *semantically similar texts land near each other*. "How do I reset my password?" and "forgot login credentials" share almost no words, yet their vectors sit close together. Retrieval becomes geometry: embed the query, find the nearest chunk vectors by **cosine similarity**. The models that do this are **bi-encoders** — query and document are encoded independently, which is exactly what makes them fast (document vectors are precomputed once) and slightly blunt (the model never sees query and document *together* — that\'s the cross-encoder\'s job, Lesson 4).',
    },
    {
      type: "code",
      language: "python",
      title: "embeddings and cosine similarity in ten lines",
      code: `# Colab cell 1 — run once (downloads a small local embedding model;
# no API key needed).
!pip install -q sentence-transformers

from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("all-MiniLM-L6-v2")   # small, fast, local, 384-dim

docs = [
    "Qdrant is a vector database written in Rust.",
    "BM25 ranks documents by lexical term overlap with the query.",
    "To reset your password, open Settings and choose Security.",
]
doc_vecs = model.encode(docs, normalize_embeddings=True)

query = "I forgot my login credentials"
q_vec = model.encode(query, normalize_embeddings=True)

scores = doc_vecs @ q_vec        # dot product of unit vectors = cosine similarity
for score, doc in sorted(zip(scores, docs), reverse=True):
    print(f"{score:.3f}  {doc}")`,
      explanation:
        "With `normalize_embeddings=True` every vector has length 1, so a plain dot product *is* cosine similarity. Note what just happened: the password-reset doc wins despite sharing zero keywords with the query — that paraphrase robustness is dense retrieval's superpower, and its blind spots (exact IDs, rare tokens) are Lesson 3's subject.",
    },
    {
      type: "animation",
      name: "embedding-space",
      caption:
        "Chunks as points in vector space; the query lands among its semantic neighbors regardless of shared keywords.",
    },
    {
      type: "code",
      language: "python",
      title: "the smallest honest RAG system",
      code: `# Colab cell 2 — run cell 1 first (it defines model, docs, doc_vecs).
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

def retrieve(query: str, k: int = 3) -> list[str]:
    q = model.encode(query, normalize_embeddings=True)
    top = np.argsort(doc_vecs @ q)[::-1][:k]
    return [docs[i] for i in top]

def answer(query: str) -> str:
    chunks = retrieve(query)
    context = "\\n\\n".join(f"[{i + 1}] {c}" for i, c in enumerate(chunks))
    prompt = (
        "Answer the question using ONLY the numbered context below. "
        "Cite chunks like [1]. If the context does not contain the answer, "
        "say 'The corpus does not cover this.' Do not use outside knowledge.\\n\\n"
        f"Context:\\n{context}\\n\\nQuestion: {query}"
    )
    resp = llm.messages.create(
        model="claude-sonnet-5", max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    return next(b.text for b in resp.content if b.type == "text")

print(answer("How do I recover my account?"))`,
      explanation:
        'Twenty lines: embed, retrieve top-k, ground the generation, demand citations, and give the model an explicit *out* ("the corpus does not cover this") so it isn\'t cornered into inventing. Every production RAG system is this skeleton plus better chunking, better retrieval, reranking, and — above all — measurement.',
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `# Colab cell 2 — run cell 1 first (it defines model, docs, doc_vecs).
# Set your key in the 🔑 panel (name it OPENAI_API_KEY) or paste it.
!pip install -q openai

import os
try:
    from google.colab import userdata
    os.environ["OPENAI_API_KEY"] = userdata.get("OPENAI_API_KEY")
except Exception:
    from getpass import getpass
    os.environ.setdefault("OPENAI_API_KEY", getpass("OpenAI API key: "))

from openai import OpenAI

llm = OpenAI()

def retrieve(query: str, k: int = 3) -> list[str]:
    q = model.encode(query, normalize_embeddings=True)
    top = np.argsort(doc_vecs @ q)[::-1][:k]
    return [docs[i] for i in top]

def answer(query: str) -> str:
    chunks = retrieve(query)
    context = "\\n\\n".join(f"[{i + 1}] {c}" for i, c in enumerate(chunks))
    prompt = (
        "Answer the question using ONLY the numbered context below. "
        "Cite chunks like [1]. If the context does not contain the answer, "
        "say 'The corpus does not cover this.' Do not use outside knowledge.\\n\\n"
        f"Context:\\n{context}\\n\\nQuestion: {query}"
    )
    resp = llm.responses.create(
        model="gpt-5.5",
        input=[{"role": "user", "content": prompt}],
    )
    return resp.output_text

print(answer("How do I recover my account?"))`,
          explanation:
            "Identical skeleton — only the generation call changes. OpenAI's Responses API hands you the assembled text as `resp.output_text` (no content-block filtering), and `max_tokens` is optional where Anthropic requires it. The retrieval half is provider-agnostic either way; note that Anthropic ships no embeddings endpoint (its docs recommend Voyage AI) while OpenAI's `text-embedding-3-large` could replace the local model here.",
        },
      ],
    },
    {
      type: "callout",
      kind: "insight",
      text: "**RAG quality is retrieval quality.** If the right passage isn't in the prompt, no amount of model intelligence can produce a grounded answer — and if the wrong passages are, the model will happily ground itself in garbage. That's why this module builds the eval harness *alongside* the pipeline, not after it: you cannot tune six stages by vibes.",
    },
    {
      type: "heading",
      text: "RAG vs. the alternatives: the question every interview opens with",
    },
    {
      type: "paragraph",
      text: "Before any pipeline detail, expect: **\"models have million-token context windows now — why not just paste the whole corpus in?\"** and **\"why not fine-tune instead?\"** These deserve crisp answers. Against **context stuffing**: (1) *cost* — you'd re-send and re-process the corpus on every query (Module 1's quadratic lesson at corpus scale; caching helps but a 500K-token cached prefix still costs real money per read, and any corpus update invalidates it); (2) *attention* — retrieval quality inside a stuffed window degrades, with mid-context evidence most at risk, whereas RAG hands the model 5 pre-vetted passages; (3) *access control* — RAG filters at retrieval time so user A never gets user B's documents in-prompt; a stuffed context is all-or-nothing; (4) *scale* — corpora outgrow any window. When the 'corpus' is genuinely one document that fits comfortably, though, skipping RAG *is* the senior answer — no pipeline beats no pipeline.",
    },
    {
      type: "paragraph",
      text: "Against **fine-tuning**: tuning teaches *behavior* — style, format, domain vocabulary, tool-use patterns — but is a poor store of *facts*: it's slow to update (retrain per docs change vs. re-index one file), unauditable (no citation possible — the fact is smeared across weights), and prone to making confident hallucination *worse*, since the model now sounds native in your domain. The clean division to say out loud: **fine-tune for how the model should act, RAG for what it should know.** They compose — a tuned model with retrieval — but knowledge freshness, provenance, and per-user permissions all live on the RAG side.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "Symptom → stage. For each production complaint, name the pipeline stage you'd inspect first: (a) answers cite passages that are visibly half a sentence; (b) asking about error code ERR_CONN_5031 retrieves generic networking docs; (c) the right passage is in the prompt but the answer contradicts it; (d) answers about the pricing page are correct but cite a page deleted last month.",
      answer:
        "(a) **Chunking** — mid-thought cuts are visible right in the citations; read raw chunks before touching anything else. (b) **Retrieve** — the dense-retrieval blind spot for rare exact tokens; the fix is hybrid search (Lesson 3), not a better prompt. (c) **Generate** — retrieval delivered; this is unfaithfulness, a grounding/prompt/eval problem (Lesson 5). (d) **Ingest/index freshness** — the pipeline is answering from a stale index; you need re-indexing on document change and delete-propagation, which is an offline-lane operations problem no query-time stage can fix. The interview skill being tested: mapping symptoms to stages instead of reflexively reaching for a bigger model.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Context windows are a million tokens now. Convince me RAG isn\'t dead." — give the four-part answer, then concede what *did* change.',
      answer:
        "Four parts, in order of interview weight. **cost**: every query re-processes whatever you stuff — at 500K tokens × thousands of queries/day, retrieval's 5-passage prompt wins by orders of magnitude, cache or no cache. **quality**: a model attending over 5 relevant passages beats one hunting through 500K tokens of mostly-irrelevant text — long-context recall degrades, especially mid-window. **access control and provenance**: retrieval-time filtering enforces per-user permissions and yields checkable citations; a stuffed window can do neither. **freshness at scale**: re-index one changed file vs. rebuild a giant cached prefix. Then the concession that marks seniority: long context *did* kill RAG's low end — a single manual, one contract, a day's logs now go straight into context, and hybrid designs (retrieve whole *documents* rather than snippets, let the model read generously) got better. The line to land: **RAG is how you decide what deserves the window; long context is how much fits once you've decided.** **Follow-up probe:** \"where's the crossover?\" → roughly when the corpus fits in-window *and* is queried rarely enough that re-processing beats maintaining a pipeline — a cost inequality you can sketch, not a dogma.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** Product wants the support bot to 'know our product deeply' and suggests fine-tuning on the docs. Steer the decision.",
      answer:
        "Split the ask into its two real requirements. *Knowing the facts*: RAG — updatable per docs release, citable (support answers need provenance), permission-aware, and testable with retrieval metrics. Fine-tuning on docs is a fact store you can't update without retraining, can't cite, and that makes hallucination more fluent — the failure mode is the bot confidently describing a feature as it existed eight months ago. *Sounding like our product* (tone, terminology, response format, escalation habits): that's behavior, where fine-tuning (or often just a strong system prompt with exemplars — cheaper, try it first) legitimately helps. So the recommendation: RAG for knowledge now; revisit tuning only if style/format problems survive prompt iteration, and even then tune on *conversations*, not documentation. **Follow-up probe:** \"how do you prove the RAG bot 'knows the product' to stakeholders?\" → the Lesson 5 eval set built from real support tickets, with accuracy and citation-validity numbers — never a demo.",
    },
    {
      type: "keypoints",
      points: [
        "RAG = search your corpus at question time, answer **only from retrieved evidence, with citations**.",
        "Two lanes: offline (ingest → chunk → embed → index) and online (retrieve → rerank → generate).",
        "Embeddings map text to vectors where semantic neighbors are geometric neighbors; cosine similarity finds them.",
        "Bi-encoders encode query and document independently — fast (precomputable) but blunt.",
        "RAG vs long context: retrieval decides *what deserves* the window (cost, attention, permissions, freshness); long context is how much fits once decided.",
        "Fine-tune for behavior, RAG for knowledge — tuned facts are stale, uncitable, and fluently wrong.",
        "Every stage fails silently; the eval harness is a first-class component, not an afterthought.",
      ],
    },
  ],
};
