import type { QuizQuestion } from "@/lib/types";

export const quiz03: QuizQuestion[] = [
  {
    question:
      "Why is chunking called the highest-leverage decision in a RAG pipeline?",
    options: [
      "Because chunk size fixes the token budget each retrieved passage consumes, and prompt-budget arithmetic is what ultimately bounds how much evidence the generator can read",
      "Because smaller chunks always embed more crisply, so chunking reduces to minimizing size — once every vector captures a single idea, overlap, structure, and boundary placement stop mattering downstream",
      "Because chunks are the unit of embedding, retrieval, and grounding — if an answer is sliced across a boundary or buried in noise at index time, no reranker or fusion downstream can recover it",
      "Because the chunker decides which retrieval modes apply: fixed-size chunks can only be searched densely, while structural chunks are what makes BM25 and hybrid search possible",
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
      "Paraphrased questions and synonym-heavy queries, since BM25's IDF weighting captures what a rare word means while embeddings only match on surface token overlap",
      "Long multi-turn conversational questions and multi-hop comparisons, because a single query embedding can't span several sub-questions while BM25 scores each term independently",
      "Misspelled queries and non-English questions, because embedding models are trained per language while BM25's tokenization is language- and typo-agnostic",
    ],
    correct: 0,
    explanation:
      "Embedding models squash rare tokens toward noise, so 'ERR_CONN_5031' or an internal project name is a blur to them — while BM25's IDF weighting treats a rare exact term as gold. The reverse holds for paraphrase (option B), which is where dense wins and BM25's zero term overlap fails.",
  },
  {
    question:
      "How does Reciprocal Rank Fusion (RRF) combine BM25 and dense results, and why ranks instead of scores?",
    options: [
      "It min-max normalizes BM25 scores and cosine similarities onto [0, 1], then sorts by a tuned weighted average — normalization is what makes the two score distributions directly comparable across corpora",
      "Each document receives 1/(k + rank) from every ranking that contains it, summed and sorted; ranks are used because BM25 scores and cosine similarities live on incomparable, corpus-dependent scales",
      "It keeps only documents that appear in both top-k lists — the intersection filters out each retriever's false positives — and orders the survivors by their dense score",
      "It interleaves the two lists round-robin, one from BM25 then one from dense, so each retriever contributes equally regardless of how its scores are scaled",
    ],
    correct: 1,
    explanation:
      "BM25 scores are unbounded and corpus-dependent; cosine similarities cluster in a narrow band — any weighted score sum is an arbitrary hack that breaks when you swap models. Rank position is the only stable common currency, and the constant k (~60) damps the dominance of rank-1 results.",
  },
  {
    question:
      "Why are bi-encoders used for first-stage retrieval but cross-encoders for reranking?",
    options: [
      "Bi-encoders and cross-encoders are equally accurate; the split exists because vector databases can only index vector outputs, so the cross-encoder is relegated to the stage that doesn't need an index",
      "Bi-encoders attend over the query and document jointly, making them more accurate but too slow for the full corpus, so they're saved for the small reranking set while cross-encoders handle first-stage scale",
      "Cross-encoders must score all the candidates against each other in a single forward pass, and roughly fifty pairs is what fits in one context window alongside the query",
      "Bi-encoders encode query and document independently, so document vectors can be precomputed and searched at corpus scale; cross-encoders attend over each query–document pair jointly — more accurate, but requiring a fresh forward pass per pair, affordable only for a few dozen candidates",
    ],
    correct: 3,
    explanation:
      "The independence of bi-encoder encoding is exactly what enables precomputation and ANN search over millions of chunks — and exactly why it misses subtle relevance that requires reading query and document together. The two-stage design uses each where its cost structure fits: recall at scale, then joint-attention precision on the shortlist.",
  },
  {
    question: "Define precision@5, recall@5, and MRR.",
    options: [
      "Precision@5 = fraction of all relevant chunks that appear in the top 5; recall@5 = fraction of the top 5 retrieved chunks that are relevant; MRR = the mean rank position of the first relevant chunk across queries",
      "Precision@5 = fraction of the top 5 retrieved chunks that are relevant; recall@5 = fraction of all relevant chunks that appear in the top 5; MRR = mean over queries of 1/rank of the first relevant chunk",
      "All three are the same hit-rate at different cutoffs — precision over the top 5, recall over the whole ranking, MRR over the top 1 — so reporting more than one of them is redundant",
      "Precision@5 = fraction of 5 generated answers the judge marks correct; recall@5 = fraction of eval questions the system attempts to answer; MRR = the judge's mean relevance rating",
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
      "At the embedding model: recall@5 only counts nearest-neighbor hits, so a high score with wrong answers usually means the embeddings surface topically similar but factually wrong chunks — swap in a stronger embedding model and re-index before touching the prompt",
      "At chunking: wrong answers despite high recall mean the evidence is straddling chunk boundaries, so the model only ever sees fragments — add overlap and re-index first",
      "At the ANN index: HNSW's greedy walk is approximate, so high measured recall can coexist with stale or unreachable vectors — rebuild the index and diff it against brute force first",
    ],
    correct: 0,
    explanation:
      "High recall@5 means the relevant chunks are in the top 5 — retrieval did its job and the evidence is in the prompt. Wrong answers therefore implicate generation (unfaithfulness) or distracting junk (low precision). This diagnostic split — retrieval metrics vs. generation metrics — is exactly why you compute both.",
  },
  {
    question:
      "What's the difference between faithfulness and answer relevance, and how does LLM-as-judge measure faithfulness?",
    options: [
      "Faithfulness measures retrieval quality (did the right chunks arrive) while answer relevance measures generation quality; both are computed by counting citation markers against the passage list",
      "They're two views of one property — an answer can't be faithful without being relevant, and vice versa — so RAGAS folds them into a single groundedness score",
      "Faithfulness = every claim in the answer is supported by the retrieved context; answer relevance = the answer actually addresses the question. A judge model decomposes the answer into atomic claims and checks each for entailment by the context — faithfulness is the supported fraction",
      "Faithfulness = the answer string matches the eval set's gold answer; relevance = a 1–5 fluency rating; both use exact-match scoring, which is why neither needs a judge model",
    ],
    correct: 2,
    explanation:
      "The two are independent failure axes: a faithful non-answer ('the docs describe the config format' when asked for a specific value) scores high faithfulness, low relevance. Claim decomposition + entailment checking is the standard LLM-as-judge recipe RAGAS packages — implement it once by hand so you can explain and sanity-check the judge.",
  },
  {
    question: "How do you build a retrieval eval set cheaply but credibly?",
    options: [
      "Adapt a public QA benchmark like Natural Questions — professionally labeled data beats anything you can generate, and retrieval metrics transfer across corpora anyway",
      "Sample chunks, have an LLM draft a question each chunk answers (recording the source chunk as the relevance label), then human-verify every item and add some questions the corpus cannot answer",
      "Have the system draft the questions, run its own retrieval, and record whichever chunks come back as the relevance labels — the pipeline's retrievals are the best available proxy for ground truth at zero labeling cost",
      "Skip synthetic data entirely and wait for six months of production queries — questions users never actually asked can't measure anything real",
    ],
    correct: 1,
    explanation:
      "LLM-assisted generation makes 50+ items affordable; human verification keeps it credible (LLM questions can parrot the source's wording, inflating retrieval scores — cull those). Option C is circular: the system grading its own retrievals as ground truth measures nothing. Unanswerable questions test the refusal path.",
  },
  {
    question:
      "What is query decomposition, and when is single-shot RAG structurally unable to answer?",
    options: [
      "Splitting a long query into windows that fit the embedding model's sequence limit and averaging the window vectors; needed whenever a query runs past the encoder's ~512-token cap",
      "Resolving pronouns and ellipsis from chat history to turn a conversational fragment into a standalone search query; needed from the second turn of any multi-turn RAG chat",
      "Having an LLM expand the query into a hypothetical documentation-style answer passage and embedding that as the search probe, landing it nearer the document region of embedding space; needed whenever queries are short, vague, and information-poor rather than genuinely multi-part",
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
      "Agentic retrieval strictly dominates: because the model can always choose to run just one query, it's never worse than a fixed pipeline, and prompt caching makes the extra tool calls effectively free",
      "Fixed pipelines have the higher quality ceiling since every stage is tuned offline against the eval set; agentic retrieval mainly cuts cost by stopping early once results look good enough",
      "The trade-off is only latency: both are equally easy to evaluate offline, because either way you can replay a query and compare the retrieved chunks against the labeled relevant set",
    ],
    correct: 0,
    explanation:
      "A fixed pipeline is a pure function — same query, same stages, measurable offline, cheap. Agentic retrieval lets the model notice thin results and re-query, which rescues hard cases but makes every run a different trajectory: harder to cache, budget, and attribute failures. Sensible default: fixed pipeline first, agentic mode where the eval set proves the need.",
  },
  {
    question:
      "Your RAG system confidently answers questions the corpus can't support. Name three layered mitigations.",
    options: [
      "Retrieve more chunks so the evidence is less likely to be missing, raise k until recall@k saturates, and move to a larger generator model — hallucination is a capacity problem that more evidence and a stronger model reliably solve together",
      "Add a cross-encoder reranker so the best evidence rises to the top, widen chunk overlap so answers arrive intact, and embed headings so chunks are self-describing",
      "Prompt an explicit exact refusal string for insufficient context; abstain when retrieval/rerank scores fall below a threshold; measure faithfulness and citation accuracy in the eval loop, with unanswerable questions in the eval set",
      "Fine-tune the generator on the corpus so the facts live in its weights, decompose every incoming query, and lower temperature to zero for deterministic answers",
    ],
    correct: 2,
    explanation:
      "Layer 1 gives the model a sanctioned exit (and makes refusal machine-detectable); layer 2 stops weak evidence from reaching generation at all, since low-scoring context invites freelancing; layer 3 catches what slips through and tracks it over time. All three together — prompt, threshold, measurement — is the production answer.",
  },
  {
    question:
      "How does HyDE improve retrieval, and what does it actually embed?",
    options: [
      "It re-embeds the query with a larger, higher-dimensional embedding model whose vectors carry more nuance, so the unchanged question lands closer to relevant documents; what's embedded is still the query itself",
      "It has an LLM generate a hypothetical answer passage to the query, then embeds that passage as the search probe — because answer-shaped text lands nearer to real documents in embedding space than question-shaped text does",
      "It appends the top BM25 result's keywords to the query before embedding, anchoring the probe in the corpus's own vocabulary; what's embedded is the query plus retrieved terms",
      "It generates a hypothetical summary of every document at index time and embeds those instead of raw chunks, so at query time the plain question is matched against answer-shaped summaries sitting on the document side of the index",
    ],
    correct: 1,
    explanation:
      "Short questions and long documentation passages occupy different regions of embedding space. A plausible fake answer — even a factually wrong one — is *shaped* like the real passage you're hunting, so its vector lands in the right neighborhood. Cost: one extra LLM call per query, so let your eval set decide if it earns its keep.",
  },
  {
    question:
      '"Context windows are a million tokens — why not paste the whole corpus into every prompt instead of building RAG?" Which answer covers the senior objections?',
    options: [
      "Mostly habit and sunk cost: with prompt caching the corpus prefix is paid for once, so long context now matches RAG on price while beating it on recall — new systems should stuff the window first",
      "Cost (re-processing the corpus per query, and any corpus edit invalidates the cached prefix), degraded attention over huge mostly-irrelevant contexts, no per-user access control or citations, and corpora that outgrow any window — though a single small document that fits is legitimately better served without a pipeline",
      "Stuffed prompts overflow the KV cache, so providers silently truncate from the middle of the context and the model never actually sees most of the corpus",
      "Only latency: a million-token prompt takes minutes to prefill today, but once providers reach sub-second long-context inference there is no remaining reason to retrieve",
    ],
    correct: 1,
    explanation:
      "RAG decides *what deserves* the window; long context is how much fits once decided. The access-control point is the most-forgotten: retrieval-time filtering keeps user A's documents out of user B's prompt, which a stuffed context cannot do. And the concession matters — long context did kill RAG's low end.",
  },
  {
    question:
      "When should you fine-tune a model versus building RAG, for a product that must answer questions about internal documentation?",
    options: [
      "Fine-tune on the documentation first: facts stored in the weights answer with zero retrieval latency and no pipeline to maintain, and RAG is only worth bolting on as a fallback when training costs or corpus size make re-tuning per release impractical",
      "Both inject domain knowledge, so pick by operations: a team with GPU experience should tune while a team with search experience should build RAG — the outcomes converge either way",
      "Fine-tune for behavior (style, format, domain vocabulary); use RAG for knowledge — tuned-in facts are slow to update, impossible to cite, and make hallucination more fluent, while an index updates per docs release and yields checkable citations",
      "Always do both from day one: tuning bakes the facts into the weights and RAG double-checks them at query time, and that redundancy is what finally eliminates hallucination",
    ],
    correct: 2,
    explanation:
      "The clean division: how the model should *act* vs what it should *know*. Facts in weights can't be updated without retraining, carry no provenance, and a domain-tuned model hallucinates in fluent domain voice. They compose fine — but knowledge freshness, citations, and permissions all live on the RAG side.",
  },
  {
    question:
      "What problem do contextual retrieval and small-to-big (parent-document) retrieval both solve, and what's the shared principle?",
    options: [
      "They shrink the index: contextual retrieval collapses related chunks under one situating vector and small-to-big stores a single parent-level embedding per section — fewer vectors, less RAM, cheaper ANN search",
      "Chunks are read out of context and can't be both crisp to embed and rich enough to answer from — contextual retrieval prepends situating text before embedding, small-to-big embeds small units but hands the model their parent section; both decouple the retrieval representation from the generation payload",
      "Both make the reranker unnecessary — once chunks carry their own context, first-stage rankings are precise enough to feed the generator directly",
      "They fix dense retrieval's exact-identifier blind spot: the prepended blurbs and parent sections reintroduce the rare tokens and error codes that embedding models squash toward noise, which is why systems adopting them can drop BM25 and go dense-only",
    ],
    correct: 1,
    explanation:
      "What you match on and what the model reads no longer have to be the same bytes. Contextual retrieval pays one cheap offline LLM call per chunk (Batch API + caching make it ~free at scale) to make elliptical chunks self-describing; small-to-big gets precise vectors AND sufficient evidence. Both attack chunking's core tension instead of tuning around it.",
  },
  {
    question:
      "Your multi-tenant vector search returns almost nothing for small tenants, though their documents are indexed. What's the likely cause?",
    options: [
      "Small tenants' vectors form weakly linked islands in the shared HNSW graph, so the greedy walk descends toward regions dominated by large tenants and never visits them — raise the search-breadth parameter (ef)",
      "Post-filtering: the ANN search retrieves top-k over the whole corpus first, then applies the tenant filter — a tenant owning 1% of the corpus gets ~0 of the k results; the fix is pre-filtering (the filter constrains the graph walk) or, crudely, oversampling before filtering",
      "Their upserts land in small unmerged segments the query path skips until compaction runs, so recently imported tenants stay invisible — force a segment merge after each bulk import",
      "A global similarity-score cutoff: small tenants' narrower corpora produce lower best-match cosine scores that fall under a threshold tuned on the biggest tenants, so nearly all their hits are silently dropped — fix it with per-tenant thresholds or by normalizing scores per tenant before the cutoff",
    ],
    correct: 1,
    explanation:
      "The order of filter-vs-search is the whole bug. Pre-filtering makes the ANN walk only visit matching vectors (Qdrant's default); post-filtering discards most of k for selective filters. For hard isolation, per-tenant collections are the alternative — more operational sprawl, zero cross-tenant risk. Also remember filters must be enforced server-side; the tenant id never comes from the caller unverified.",
  },
  {
    question:
      "Before trusting an LLM judge's faithfulness scores, what validation does a senior engineer run?",
    options: [
      "None beyond spot checks — a pinned judge model run at temperature 0 is deterministic and self-consistent by construction, which is exactly the reliability property human raters lack",
      "Run the judge twice per item and keep only the verdicts where it agrees with itself — self-consistency filtering is far cheaper than hand-labeling and measures the same thing human agreement would",
      "Hand-label 30–50 answers, measure judge-vs-human agreement, and iterate on the judge prompt until agreement is high; de-bias by construction (different model family than the generator, claim-level scoring, order-randomized comparisons, pinned judge version); keep known-good/known-bad canaries in every run to catch judge drift",
      "Have the judge attach a confidence score to every verdict and discard the low-confidence ones — a judge that knows when it is unsure doesn't need external calibration against humans",
    ],
    correct: 2,
    explanation:
      "An unvalidated judge is a random-number generator with confidence. The known biases — position, self-preference, verbosity — are handled by construction, and calibration against human labels is what earns the dashboard its credibility. The judge is a model in production: it gets an eval too.",
  },
];
