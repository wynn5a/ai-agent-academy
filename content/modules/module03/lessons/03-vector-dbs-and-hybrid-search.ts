import type { Lesson } from "@/lib/types";

export const lesson03: Lesson = {
  slug: "vector-dbs-and-hybrid-search",
  title: "Vector DBs & Hybrid Search (BM25 + Dense + RRF)",
  minutes: 40,
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
      text: "What 'approximate' actually means: HNSW in one whiteboard sketch",
    },
    {
      type: "paragraph",
      text: "\"How does the vector index actually work?\" is a standard senior probe, and the answer to sketch is **HNSW** (hierarchical navigable small world), the index behind most vector DBs. Every vector is a node in a graph, linked to a handful of near neighbors; graphs are stacked in layers like a skip list — sparse express layers on top, the dense full graph at the bottom. A query greedily walks from an entry point: at each layer, hop to whichever neighbor is closest to the query until no neighbor improves, then descend. Result: **logarithmic-ish search instead of comparing against every vector** — that's the entire point of a vector DB versus the numpy matrix.",
    },
    {
      type: "paragraph",
      text: "Three consequences worth saying unprompted. (1) **It's approximate** — greedy walks can miss the true nearest neighbor; recall is a *tunable*, not a given: search-breadth parameters (how many candidates the walk keeps, `ef` in HNSW terms) trade latency for recall, and accepting ~95–99% recall is what buys the speed. So your retrieval stack has *two* recall knobs — the ANN's internal recall and your top-k — and a mysteriously missing chunk is sometimes just an ANN miss: verify by comparing against exact brute-force on a sample. (2) **RAM is the cost center** — the graph plus vectors traditionally live in memory; at scale you pay in GB (quantization and disk-backed indexes are the mitigations, trading a little recall for a lot of memory). (3) **Deletes and updates are second-class** — graphs degrade as nodes churn, so heavy-churn corpora need periodic re-indexing or segment merging; ask any vector DB how it handles deletes before trusting it with a living corpus.",
    },
    {
      type: "callout",
      kind: "warning",
      title: "Filtering: before, not after",
      text: "Metadata filters ('only tenant-42 docs') interact badly with naive ANN: **post-filtering** retrieves top-k *then* filters, so a k=10 query where the tenant owns 1% of the corpus returns ~0 usable results. You need **pre-filtering** (the filter constrains the graph walk itself — Qdrant's default behavior) or oversampling as a crude fallback (retrieve 10×k, filter, keep k — fragile when the filter is highly selective). This is *the* trap question about multi-tenant vector search: 'why does search return nothing for small tenants?' Also mention the clean alternative for hard isolation: one collection per tenant, trading operational sprawl for zero cross-tenant risk and per-tenant re-indexing.",
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
      type: "exercise",
      kind: "predict",
      prompt:
        "Query: `\"what does ERR_CONN_5031 mean\"`. The corpus has exactly one chunk documenting that error code. Predict where that chunk ranks in (a) dense-only, (b) BM25-only, and (c) the RRF fusion — and what the fused list looks like overall.",
      answer:
        "(a) **Dense**: poorly — often rank 20–50 or absent. The embedding model has never meaningfully seen `ERR_CONN_5031`; the token contributes near-noise, so the query vector lands among generic connection-error prose. (b) **BM25**: rank ~1 — the code appears in one document, so its IDF is enormous; one exact match dominates the score. (c) **RRF**: the chunk fuses to the top — it earns ~1/(60+1) from BM25's rank-1 alone, more than chunks ranked mid-list in *both* retrievers earn combined. The rest of the fused list interleaves dense's semantically-related chunks (retry configuration, connection troubleshooting) — which is exactly what you want as supporting context. The senior observation: fusion isn't averaging two mediocre lists, it's **union-with-insurance** — each retriever's confident hits survive the other's blindness, which is why hybrid's win shows up most on the query types where one mode fails outright.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"Walk me through what happens inside the vector DB between 'here's a query vector' and 'here are 10 ids' — and where it can silently lose the right answer.\"",
      answer:
        "Sketch HNSW: nodes = vectors with links to near neighbors, layered like a skip list; the query enters at a sparse top layer, greedily hops toward the query at each layer, descends, and at the bottom collects the best candidates seen (breadth controlled by the search parameter). Sub-linear because it visits a tiny fraction of nodes. Then the two silent-loss points: (1) **the greedy walk is approximate** — a true nearest neighbor in an unexplored graph region never gets visited; recall is tunable via search breadth at a latency price, and you validate it by diffing ANN results against brute-force on a sample (vector DBs report this as index recall); (2) **filters** — post-filtering after the walk starves selective filters (the multi-tenant trap), so the filter must constrain the walk (pre-filtering) or you oversample. Close with operations: RAM proportional to vectors + graph, deletes degrade the graph until re-index/merge. **Follow-up probe:** \"when would you *not* use ANN?\" → small corpora (≤ ~100K vectors): brute-force cosine is milliseconds, exact, zero index maintenance — the numpy matrix was never wrong, just unscalable.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** Design retrieval for a B2B product: 50M chunks across 2,000 tenants, hard isolation required, p95 search under 200ms, corpus updated continuously. Walk the design.",
      answer:
        "**Isolation first, because it shapes everything**: tenant id as a mandatory pre-filter enforced *server-side* (never trust the caller to add it), or — for the paranoid tier / largest tenants — dedicated collections; mention that per-tenant collections also localize re-indexing and noisy-neighbor load, at the cost of 2,000 collections to operate. **Scale**: 50M vectors × ~400 dims ≈ tens of GB with the graph — fits a beefy node, but plan sharding by tenant hash before you need it; quantization (int8/binary) cuts memory ~4–30× for a small recall tax you *measure* on the eval set, not assume. **Latency**: ANN search is single-digit ms — the 200ms budget is actually spent on embedding the query (small local model or cached frequent queries) and any reranker; put the reranker on the shortlist only (Lesson 4) and it fits. **Churn**: continuous updates mean delete/upsert pressure — segment-merging DBs handle it, but schedule compaction and monitor per-tenant recall drift over time, because a degraded graph fails *silently* (recall sags, no errors). **The eval hook**: per-tenant canary queries with known-relevant chunks, run hourly — your only early warning. **Follow-up probe:** \"a big tenant complains search 'misses obvious docs' after a bulk re-import\" → deletes/upserts degraded the graph or the import skipped embedding normalization — check index recall vs brute force on that tenant first.",
    },
    {
      type: "keypoints",
      points: [
        "A vector DB buys ANN speed, metadata filters, and persistence; Qdrant local mode runs embedded — no server.",
        "Dense retrieval fails on exact IDs, error codes, and rare names; BM25 fails on paraphrase. Their failure sets barely overlap.",
        "Fuse *ranks*, not scores: RRF gives each doc the sum of 1/(k + rank) across retrievers.",
        "ANN (HNSW) = greedy walks over a layered neighbor graph: sub-linear, approximate, RAM-hungry, delete-averse. Recall is a knob you tune and verify against brute force.",
        "Filter *before* the walk (pre-filtering), never after — post-filtering starves selective filters; multi-tenant isolation is enforced server-side.",
        "Store citation metadata in the payload so retrieval returns generator-ready evidence.",
        "Make every retrieval mode toggleable — the eval report demands per-mode numbers.",
      ],
    },
  ],
};
