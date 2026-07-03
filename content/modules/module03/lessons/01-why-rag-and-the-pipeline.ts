import type { Lesson } from "@/lib/types";

export const lesson01: Lesson = {
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
};
