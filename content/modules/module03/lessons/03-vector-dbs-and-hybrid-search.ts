import type { Lesson } from "@/lib/types";

export const lesson03: Lesson = {
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
};
