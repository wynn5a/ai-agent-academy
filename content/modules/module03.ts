import type { Module } from "@/lib/types";

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
  lessons: [
    {
      slug: "why-rag-and-the-pipeline",
      title: "Why RAG, and the Anatomy of the Pipeline",
      minutes: 25,
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
          code: `from sentence_transformers import SentenceTransformer
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
          code: `import anthropic
import numpy as np

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
        model="claude-sonnet-4-5", max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text

print(answer("How do I recover my account?"))`,
          explanation:
            'Twenty lines: embed, retrieve top-k, ground the generation, demand citations, and give the model an explicit *out* ("the corpus does not cover this") so it isn\'t cornered into inventing. Every production RAG system is this skeleton plus better chunking, better retrieval, reranking, and — above all — measurement.',
        },
        {
          type: "callout",
          kind: "insight",
          text: "**RAG quality is retrieval quality.** If the right passage isn't in the prompt, no amount of model intelligence can produce a grounded answer — and if the wrong passages are, the model will happily ground itself in garbage. That's why this module builds the eval harness *alongside* the pipeline, not after it: you cannot tune six stages by vibes.",
        },
        {
          type: "keypoints",
          points: [
            "RAG = search your corpus at question time, answer **only from retrieved evidence, with citations**.",
            "Two lanes: offline (ingest → chunk → embed → index) and online (retrieve → rerank → generate).",
            "Embeddings map text to vectors where semantic neighbors are geometric neighbors; cosine similarity finds them.",
            "Bi-encoders encode query and document independently — fast (precomputable) but blunt.",
            "Every stage fails silently; the eval harness is a first-class component, not an afterthought.",
          ],
        },
      ],
    },
    {
      slug: "chunking-strategies",
      title: "Chunking: The Highest-Leverage Decision",
      minutes: 25,
      summary:
        "Chunks are the unit of everything downstream — embedding, retrieval, citation, grounding. Cut them badly and no reranker, no fusion trick, no bigger model can repair the damage.",
      sections: [
        {
          type: "paragraph",
          text: "A chunk is what gets embedded, what gets retrieved, and what the model reads as evidence. That triple duty creates tension: **small chunks embed crisply** (one idea per vector) but may lack the surrounding context needed to actually answer; **large chunks carry context** but their embeddings blur into topic soup and they burn prompt budget. And if a fact straddles a chunk boundary — question in one chunk, answer in the next — *neither* chunk retrieves well. This is why chunking is the highest-leverage decision in the pipeline: **errors here are unrecoverable downstream**.",
        },
        {
          type: "animation",
          name: "chunking",
          caption:
            "The same document cut three ways: naive fixed-size splits mid-sentence; overlap heals boundaries; structural chunking follows the document's own seams.",
        },
        {
          type: "heading",
          text: "Fixed-size vs. structural",
        },
        {
          type: "table",
          headers: ["Strategy", "How", "Strengths", "Weaknesses"],
          rows: [
            [
              "Fixed-size",
              "Every N tokens/words, hard cut",
              "Trivial, uniform, predictable budget",
              "Cuts mid-sentence/mid-thought; ignores document structure",
            ],
            [
              "Fixed-size + overlap",
              "Windows share 10–20% of content",
              "Facts near boundaries appear intact in at least one chunk",
              "Index bloat; near-duplicate retrievals",
            ],
            [
              "Structural",
              "Split on headings/paragraphs, then size-cap",
              "Chunks align with authors' units of meaning; heading path makes great citation metadata",
              "Needs format-aware parsing; sections vary wildly in size",
            ],
            [
              "Semantic",
              "Split where embedding similarity between consecutive sentences drops",
              "Adapts to unstructured prose",
              "Slower, fussier, rarely beats structural on well-formatted docs",
            ],
          ],
        },
        {
          type: "code",
          language: "python",
          title: "fixed-size chunker with overlap",
          code: `def fixed_size_chunks(text: str, size: int = 350, overlap: int = 50) -> list[str]:
    """Split into word windows of ~size words, consecutive windows sharing
    'overlap' words so boundary-straddling facts survive in one piece."""
    words = text.split()
    chunks, start = [], 0
    while start < len(words):
        end = min(start + size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start = end - overlap          # step back to create the overlap
    return chunks`,
          explanation:
            "Word-based sizing is a fine proxy (a word is roughly 1.3 tokens in English); swap in a real tokenizer when you need exact budgets. The overlap is the load-bearing part: without it, any fact within a few sentences of a cut is fragmented across two chunks and retrieves poorly from both.",
        },
        {
          type: "code",
          language: "python",
          title: "structural chunker for markdown, with citation metadata",
          code: `import re

def structural_chunks(md: str, doc_id: str,
                      max_words: int = 350, overlap: int = 50) -> list[dict]:
    """Split on headings first; size-cap oversized sections with the
    fixed-size chunker. Keep the heading path for citations, and prepend
    it to the text we embed so section context reaches the vector."""
    parts = re.split(r"(?m)^(#{1,4}\\s.*)$", md)
    chunks, heading = [], "(intro)"
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if re.match(r"^#{1,4}\\s", part):
            heading = part.lstrip("#").strip()
            continue
        for i, piece in enumerate(fixed_size_chunks(part, max_words, overlap)):
            chunks.append({
                "doc_id": doc_id,
                "heading": heading,
                "position": i,
                "text": piece,
                "embed_text": f"{heading}\\n{piece}",   # heading rides into the embedding
            })
    return chunks`,
          explanation:
            'Two tricks worth stealing: (1) the metadata (`doc_id`, `heading`, `position`) is what makes citations possible later — store it now or regret it; (2) embedding `heading + text` instead of bare text injects section context into the vector, so a chunk that just says "set this flag to true" still retrieves for queries about the feature its heading names.',
        },
        {
          type: "list",
          items: [
            "**Chunk size**: start around 250–500 words for technical docs. Smaller for FAQ-like corpora (one Q&A per chunk), larger for narrative prose.",
            "**Overlap**: 10–20% of chunk size. More than that mostly buys you duplicate retrievals.",
            "**Never mix units across the corpus** without recording which chunker produced each chunk — you can't A/B what you can't attribute.",
            "**Chunking is an eval-set question, not a taste question**: re-run retrieval metrics (Lesson 5) for each candidate strategy and let precision@5 decide.",
          ],
        },
        {
          type: "callout",
          kind: "warning",
          title: "Bad chunking cannot be fixed downstream",
          text: "A reranker can only reorder the chunks that exist. Fusion can only merge rankings of the chunks that exist. If the answer was sliced in half at index time, every downstream stage is optimizing over damaged goods. When RAG quality disappoints, **look at the actual chunks first** — read twenty of them raw before touching any other dial.",
        },
        {
          type: "keypoints",
          points: [
            "Chunks serve three masters at once: embedding quality, retrieval unit, and grounding evidence.",
            "Small chunks embed crisply but lose context; large chunks blur; overlap heals boundary cuts.",
            "Structural chunking (headings/paragraphs + size cap) beats naive fixed-size on formatted docs.",
            "Store `doc_id`, heading path, and position with every chunk — citations depend on it.",
            "Chunking mistakes are unrecoverable downstream; choose by measured retrieval metrics, not vibes.",
          ],
        },
      ],
    },
    {
      slug: "vector-dbs-and-hybrid-search",
      title: "Vector DBs & Hybrid Search (BM25 + Dense + RRF)",
      minutes: 30,
      summary:
        "In-memory numpy stops scaling fast; a vector DB gives you ANN search, filters, and persistence. But dense retrieval alone has famous blind spots — production systems fuse it with BM25 keyword search using reciprocal rank fusion.",
      sections: [
        {
          type: "paragraph",
          text: 'Brute-force cosine over a numpy matrix is fine for a thousand chunks; at hundreds of thousands you want a **vector database**: approximate-nearest-neighbor (ANN) indexes for sub-linear search, metadata filtering ("only chunks from the billing docs"), persistence, and updates without re-indexing the world. We use **Qdrant in local mode** — it runs embedded inside your Python process, no server, no Docker, and the same client API scales to a real deployment later.',
        },
        {
          type: "code",
          language: "python",
          title: "Qdrant local: create, upsert, query",
          code: `from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer

encoder = SentenceTransformer("all-MiniLM-L6-v2")
qdrant = QdrantClient(path="./qdrant_data")     # embedded local mode — a directory, not a server

qdrant.create_collection(
    collection_name="docs",
    vectors_config=VectorParams(size=384, distance=Distance.COSINE),
)

points = [
    PointStruct(
        id=i,
        vector=encoder.encode(c["embed_text"]).tolist(),
        payload={"text": c["text"], "doc_id": c["doc_id"], "heading": c["heading"]},
    )
    for i, c in enumerate(chunks)          # chunks from Lesson 2's chunker
]
qdrant.upsert(collection_name="docs", points=points)

hits = qdrant.query_points(
    collection_name="docs",
    query=encoder.encode("how do I configure retries?").tolist(),
    limit=10,
).points
for h in hits:
    print(f"{h.score:.3f}  [{h.payload['doc_id']}] {h.payload['heading']}")`,
          explanation:
            "The payload carries the chunk text and citation metadata alongside the vector, so one query returns everything the generator needs. Batch-encode in production (`encoder.encode(list_of_texts)`) — per-chunk encoding is the classic accidental 50× slowdown of ingestion.",
        },
        {
          type: "heading",
          text: "Where dense retrieval fails — and BM25 wins",
        },
        {
          type: "list",
          items: [
            "**Exact identifiers**: error codes (`ERR_CONN_5031`), SKUs, ticket numbers, config keys. Embedding models squash rare tokens toward noise; BM25 treats a rare exact term as gold.",
            "**Rare proper nouns and acronyms**: an internal project name the embedding model never saw is just an out-of-vocabulary blur to it.",
            '**Conversely, BM25 fails on paraphrase**: "reset my password" vs. "forgot login credentials" share no terms — lexical overlap is zero, dense similarity is high.',
            "Neither mode dominates; their failure sets barely overlap. That's exactly the situation where **fusion** wins.",
          ],
        },
        {
          type: "paragraph",
          text: "**BM25** is the classic lexical ranking function: score a document by the query terms it shares, weighting rare terms more (inverse document frequency), diminishing returns for repetition (term-frequency saturation), and normalizing for document length. No training, no vectors, decades of production mileage. **Hybrid search** runs both retrievers and merges their rankings — and because BM25 scores and cosine similarities live on incomparable scales, you merge *ranks*, not scores, with **Reciprocal Rank Fusion (RRF)**: each document earns 1/(k + rank) from each list that contains it (k ≈ 60 damps the top-rank dominance), and you sort by the summed score.",
        },
        {
          type: "code",
          language: "python",
          title: "hybrid retrieval: BM25 + dense, fused with RRF",
          code: `import numpy as np
from rank_bm25 import BM25Okapi

tokenized = [c["text"].lower().split() for c in chunks]
bm25 = BM25Okapi(tokenized)

def bm25_search(query: str, k: int = 50) -> list[int]:
    scores = bm25.get_scores(query.lower().split())
    return [int(i) for i in np.argsort(scores)[::-1][:k]]

def dense_search(query: str, k: int = 50) -> list[int]:
    hits = qdrant.query_points(
        collection_name="docs",
        query=encoder.encode(query).tolist(),
        limit=k,
    ).points
    return [h.id for h in hits]

def rrf_fuse(rankings: list[list[int]], k: int = 60, top: int = 50) -> list[int]:
    scores: dict[int, float] = {}
    for ranking in rankings:
        for rank, chunk_id in enumerate(ranking):
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores, key=lambda cid: scores[cid], reverse=True)[:top]

def hybrid_search(query: str, top: int = 50) -> list[int]:
    return rrf_fuse([dense_search(query), bm25_search(query)], top=top)`,
          explanation:
            "Note that RRF never looks at a raw score — only at positions. A chunk ranked #1 by BM25 and #40 by dense still fuses high, which is the desired behavior for an exact-ID query that dense fumbled. Keep each retriever toggleable behind a config flag: your Lab 03 eval report compares dense-only vs. BM25-only vs. hybrid, and that requires running each in isolation.",
        },
        {
          type: "callout",
          kind: "insight",
          text: "Why rank fusion instead of score fusion? BM25 scores are unbounded and corpus-dependent; cosine similarities live in [-1, 1] and cluster tightly. Any weighted sum of the two is an arbitrary, corpus-specific hack that breaks when you change embedding models. **Ranks are the only stable common currency** — which is why RRF, despite being almost insultingly simple, is the production default.",
        },
        {
          type: "table",
          headers: ["Query type", "Dense-only", "BM25-only", "Hybrid (RRF)"],
          rows: [
            [
              'Paraphrased how-to ("can\'t get in to my account")',
              "Strong",
              "Weak — no term overlap",
              "Strong",
            ],
            [
              'Exact error code ("ERR_CONN_5031 meaning")',
              "Weak — rare token blur",
              "Strong",
              "Strong",
            ],
            ["Internal project name / acronym", "Weak", "Strong", "Strong"],
            [
              "Conceptual question in the corpus's own vocabulary",
              "Strong",
              "Decent",
              "Strong",
            ],
          ],
        },
        {
          type: "keypoints",
          points: [
            "A vector DB buys ANN speed, metadata filters, and persistence; Qdrant local mode runs embedded — no server.",
            "Dense retrieval fails on exact IDs, error codes, and rare names; BM25 fails on paraphrase. Their failure sets barely overlap.",
            "Fuse *ranks*, not scores: RRF gives each doc the sum of 1/(k + rank) across retrievers.",
            "Store citation metadata in the payload so retrieval returns generator-ready evidence.",
            "Make every retrieval mode toggleable — the eval report demands per-mode numbers.",
          ],
        },
      ],
    },
    {
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
    },
    {
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
    },
  ],
  quiz: [
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
  ],
  lab: {
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
    # your own LLM-as-judge with model="claude-sonnet-4-5")
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
  },
  resources: [
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
  ],
};
