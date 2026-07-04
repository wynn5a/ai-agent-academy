import type { Lesson } from "@/lib/types";

export const lesson02: Lesson = {
  slug: "chunking-strategies",
  title: "Chunking: The Highest-Leverage Decision",
  minutes: 35,
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
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "A teammate wants maximum boundary safety and calls `fixed_size_chunks(text, size=200, overlap=200)`. The ingestion job pins a CPU at 100% and never finishes. What happened — and what's the guard the function is missing?",
      answer:
        "With `overlap >= size`, the window never advances: `start = end - overlap` steps back to (or before) where it started, so the loop re-emits the same window forever — an infinite loop that also silently degrades near the boundary values (overlap = 190 'works' while emitting 20× duplicate content). The missing guard is an invariant check at the top: `if overlap >= size: raise ValueError(\"overlap must be < size\")` — or clamp with a warning. The general lesson interviewers like: chunkers are *data pipelines* — they need input validation, progress assertions (each iteration must advance `start`), and a unit test on the degenerate inputs (empty text, one word, text shorter than `size`), because they run unattended over thousands of documents where one pathological file wedges the whole ingest.",
    },
    {
      type: "heading",
      text: "Two upgrades seniors are expected to know",
    },
    {
      type: "paragraph",
      text: "**Contextual retrieval** attacks the core weakness of chunks: they're read out of context. A chunk saying \"set this flag to true and restart the service\" embeds — and reads — poorly because nothing says *which* flag or service. The `heading + text` trick above is the free version; the full version has an LLM write a 1–2 sentence situating blurb per chunk at index time (\"This passage is from the Acme Gateway operations guide, section on retry configuration...\"), prepended before embedding and indexing. It costs one cheap LLM call per chunk **once, offline** — the good side of the cost asymmetry, since the index is built once and queried forever — and it substantially cuts retrieval failures on corpora where chunks are elliptical. Batch API + prompt caching (the document rides in the cached prefix while each chunk varies) make it cheap at scale — Module 1's cost levers composing.",
    },
    {
      type: "paragraph",
      text: "**Small-to-big (parent-document) retrieval** resolves the size tension by refusing to choose: **embed small, return big**. Index sentence- or paragraph-sized units for crisp matching, but store a pointer from each to its parent section; at query time, match on the small unit, then hand the *parent* to the generator. You get precise vectors *and* sufficient evidence context. Costs to name: a two-level store, dedup when several small units share a parent, and a larger generation prompt. The umbrella idea behind both techniques — and the phrase worth saying in an interview — is **decoupling the retrieval representation from the generation payload**: what you match on and what the model reads no longer have to be the same bytes.",
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
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** Your corpus is heterogeneous: 2,000 one-paragraph FAQs, 300 long narrative runbooks, and an API reference where each endpoint is a table-heavy half page. Design the chunking — and defend treating them differently.",
      answer:
        "One chunker for all three is the trap; the defense is that **the natural retrieval unit differs per document type**. FAQs: one Q&A pair per chunk, no overlap — the author already chunked them; splitting or merging only hurts. API reference: one endpoint per chunk, structural split on the endpoint headings, keep tables intact (never let a size cap bisect a parameter table — a half-table is noise), and lean on hybrid search since queries here are exact-token-heavy (`POST /v2/orders`). Runbooks: structural on headings + size-cap with overlap, plus small-to-big — narrative answers need surrounding context. Tag every chunk with its `source_type` and chunker version so you can (a) filter at query time, (b) report per-type retrieval metrics — because a single blended precision@5 will hide that one type is broken. **Follow-up probe:** \"one number: your FAQ precision is great, runbook recall is terrible — first suspect?\" → runbook chunks too large or answers straddling boundaries; read twenty raw runbook chunks and check where the eval set's expected chunks got cut.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"Retrieval quality is disappointing. How do you determine whether chunking — as opposed to embedding, retrieval mode, or ranking — is the culprit?\" Give the procedure, not a guess.",
      answer:
        "(1) **Read twenty raw chunks** sampled from the index — mid-sentence cuts, orphaned table halves, and boilerplate are visible to the naked eye in minutes; this is always step one because it needs no tooling. (2) **Autopsy the eval failures**: for each miss, look up where the expected evidence lives — if the answer text is *split across two chunks* or *buried in a 600-word chunk about three topics*, chunking is convicted; if it sits intact in one clean chunk that simply ranked #30, the problem is retrieval/ranking instead. (3) **A/B the chunker**: re-index the same corpus with one changed variable (size, overlap, structural vs fixed), re-run the eval — the metrics delta attributes the blame quantitatively. The trap being probed: recall@5 alone can't distinguish 'evidence not indexed intactly' from 'evidence indexed but ranked low' — only the failure autopsy separates them, which is why the eval set stores *which chunks* are relevant, not just expected answers. **Follow-up probe:** \"the answer straddles two chunks and both rank ~10 — cheapest fix?\" → more overlap or small-to-big with a shared parent; a reranker can't merge fragments.",
    },
    {
      type: "keypoints",
      points: [
        "Chunks serve three masters at once: embedding quality, retrieval unit, and grounding evidence.",
        "Small chunks embed crisply but lose context; large chunks blur; overlap heals boundary cuts.",
        "Structural chunking (headings/paragraphs + size cap) beats naive fixed-size on formatted docs.",
        "Contextual retrieval: an LLM-written situating blurb per chunk, paid once offline (Batch API + caching), read on every query.",
        "Small-to-big: embed small units, hand the model their parent — decouple the retrieval representation from the generation payload.",
        "Heterogeneous corpora need per-type chunkers and per-type metrics — a blended score hides the broken type.",
        "Store `doc_id`, heading path, and position with every chunk — citations depend on it.",
        "Chunking mistakes are unrecoverable downstream; choose by measured retrieval metrics, not vibes.",
      ],
    },
  ],
};
