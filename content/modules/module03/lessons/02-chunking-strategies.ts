import type { Lesson } from "@/lib/types";

export const lesson02: Lesson = {
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
};
