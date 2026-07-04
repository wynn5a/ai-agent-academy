# Module 4 Senior-Interview Upgrade — Design

**Date:** 2026-07-04
**Goal:** Same four-axis pass as Modules 1–3 (drills, gaps, exercises, deeper why) applied to Module 4 "Memory & Context Engineering", under the user's standing approval.

## Per-lesson changes

1. **01 context-window-as-budget** — model/extraction fixes (`claude-sonnet-4-5` → `claude-sonnet-5`, `temperature=0` removed, `content[0].text` → block-type extraction); "Context rot" section (attention dilution, lost-in-the-middle, effective vs advertised context window); "Provider-native context management catches up" (compaction/context-editing as beta API features, when to hand-roll vs adopt); predict exercise (1M-window "just send everything" scenario — cost/latency/rot); drills ("why a budget policy with 1M tokens", "what do you cut first and why"). 25 → 35 min.
2. **02 compaction-and-summarization** — model/extraction fixes; "Compaction fights your prompt cache" (cross-references Module 2 Lesson 5's cache-invalidation mechanics and amortization inequality rather than re-teaching); "What the summary can drop" table (tool-call outcomes, exploration, chit-chat, resolved errors); "Provider-native compaction" (beta compaction API, black-box implication for behavioral testing); spot-the-bug (boundary-shift loop deleted → orphaned tool_result → 400, mirroring the lesson's own code); drills (threshold-lowering instinct vs cache tax, proving compaction didn't break the agent). 25 → 35 min.
3. **03 memory-taxonomy-and-stores** — model/temperature fix; "A worked example: memory taxonomy for a coding agent" (concrete narrative walk-through with staleness profile per type, beyond the abstract table); spot-the-bug (removing forced `tool_choice` from the extractor → `StopIteration` in production); drills ("convince me RAG-over-transcripts is wrong" under a minute, mapping the taxonomy onto a customer-support agent). 25 → 35 min.
4. **04 write-path-and-read-path** — model/extraction fixes; "Delete is the lifecycle's third verb" callout (supersede vs GDPR-style hard delete, cascading erasure); spot-the-bug (concurrent-session race condition in `write_fact`'s check-then-act dedupe); "Two ways to trigger the write: explicit tool vs background job" (agency+visibility vs coverage trade-off, citing the client-side memory-tool pattern); "Two read-path shapes: injection vs retrieval-as-a-tool" (scale/certainty trade-off); drills (explicit-tool-vs-pipeline defense, read-path scaling from 200 to 200K facts). 30 → 40 min.
5. **05 memory-security** — model/extraction fixes; "PII, retention, and the data you shouldn't have kept" (screening at extraction, TTL-bounded retention, real erasure vs supersede-and-retain); "Per-user isolation: the pre-filter/post-filter trap, again" (explicit cross-reference to Module 3's vector-DB filtering trap, applied to `all_active()`/`recall()`, with the corrected query-layer code); spot-the-bug (multi-tenant `MemoryStore` where isolation is assumed from embedding distance instead of enforced in SQL); drills ("isn't fencing + write-path gates enough?", cross-tenant-leak incident response). 25 → 35 min.

## Quiz

+5 questions (12 → 17): context rot / effective vs advertised window, compaction-vs-prompt-cache amortization tension, explicit-memory-tool vs background-extraction trade-off, injection-vs-retrieval-as-a-tool read-path trade-off, per-user isolation / pre-vs-post-filter analog applied to a memory store.

## Consistency

`claude-sonnet-4-5` → `claude-sonnet-5` everywhere (incl. `lab.ts`'s agent loop snippet); removed all `temperature` params from Anthropic code examples; `resp.content[0].text` → `next(b.text for b in resp.content if b.type == "text")` block-type extraction throughout.

## Non-goals

Lab structure, resources, index outcomes, rendering, schema.
