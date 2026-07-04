# Module 3 Senior-Interview Upgrade — Design

**Date:** 2026-07-04
**Goal:** Same four-axis pass as Modules 1–2 (drills, gaps, exercises, deeper why) applied to Module 3 "RAG", under the user's standing approval.

## Per-lesson changes

1. **01 why-rag** — "RAG vs. the alternatives" section (long-context stuffing: cost/attention/access-control/scale, plus the honest concession; fine-tuning: behavior vs knowledge); symptom→stage exercise; drills ("convince me RAG isn't dead", steering a fine-tune-the-docs proposal). Model/extraction consistency fixes. 25 → 35 min.
2. **02 chunking** — spot-the-bug (overlap ≥ size infinite loop + pipeline-hygiene lesson); "two upgrades seniors know": contextual retrieval (offline LLM blurbs, Batch+caching economics) and small-to-big (decouple retrieval representation from generation payload); drills (heterogeneous corpus design, convicting-chunking procedure). 25 → 35 min.
3. **03 vector-dbs** — HNSW mechanism sketch (layered graph, greedy walk, tunable recall) + consequences (approximate, RAM, delete-averse); pre- vs post-filtering trap (multi-tenant); ERR_CONN predict exercise (fusion as union-with-insurance); drills (inside-the-index walk, 50M-chunk multi-tenant design). 30 → 40 min.
4. **04 rerank/rewriting** — model/temperature fixes; "after the rerank" (k tuning, lost-in-the-middle ordering, score-threshold abstention); technique-matching exercise incl. the do-nothing option; drills (multi-turn chat degradation → contextualized rewriting, 800ms latency-budget allocation with stage ballparks). 25 → 35 min.
5. **05 grounded gen & eval** — model/temperature/extraction fixes; citation range validation in code (invalid citations as free unfaithfulness signal); judge-bias specifics (position, self-preference, verbosity, rubric drift) + calibration ritual; spot-the-bug (LLM-drafted unverified eval set → lexical leakage, P@5=0.94 mirage); drills (metric-gated debugging tree, "convince me to believe your judge"). 30 → 40 min.

## Quiz

+5 questions (12 → 17): RAG vs long context, RAG vs fine-tuning, contextual retrieval/small-to-big principle, pre- vs post-filtering, judge validation.

## Consistency

`claude-sonnet-4-5` → `claude-sonnet-5` everywhere (incl. lab.ts comment); removed `temperature` params; `content[0].text` → block-type extraction.

## Non-goals

Lab structure, resources, index outcomes, rendering, schema.
