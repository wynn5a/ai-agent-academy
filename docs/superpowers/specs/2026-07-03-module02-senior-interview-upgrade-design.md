# Module 2 Senior-Interview Upgrade — Design

**Date:** 2026-07-03
**Goal:** Same four-axis pass as Module 1 (drills, gaps, exercises, deeper why), applied to Module 2 "The Agent Loop". Executed under the user's standing approval ("do the same pass on module 2 … recommended options").

## Per-lesson changes

1. **01 the-loop** — fixed stale `claude-sonnet-4-5` → `claude-sonnet-5`; spot-the-bug on `content[0].text` (block-type extraction); "inner loop lives inside an outer conversation" section (per-turn budgets, inherited context); predict exercise on empty-search hallucination; interview-angle callout; drills (chatbot→agent migration, parallelism & dependency graphs). 25 → 35 min.
2. **02 react-and-planning** — predict exercise on removing `stop_sequences` (hallucinated observations / grounding); third lineage layer (interleaved adaptive thinking as the modern Thought); externalized todo-list plans; drills (wandering diagnosis, re-plan trigger design with damping). 25 → 35 min.
3. **03 workflows-vs-agents** — removed `temperature` from `ask()` (consistency with Module 1's no-sampling-params teaching) + block-type extraction; pattern-matching exercise (4 scenarios); drills (four-question agent-decision framework run on expense reports, composite support-automation design with human gates). 30 → 40 min.
4. **04 termination-and-budgets** — "tell the model about the budget" section (advisory awareness vs harness enforcement, native task budgets); spot-the-bug on mid-iteration bailout leaving dangling tool_use (400); drills (picking budget numbers from trace percentiles, interactive vs overnight-batch envelopes + fleet budgets). 25 → 35 min.
5. **05 failure-recovery-and-tracing** — compaction-vs-prompt-cache tension (amortization math) + predict exercise proving it via usage fields; traces-as-assets section (regression fixtures → evals, OTel/span sinks, PII note); drills (2 a.m. trace-driven postmortem, logs → gated eval loop). 25 → 35 min.

## Quiz

+6 questions (12 → 18): block-type extraction, compaction/cache invalidation, advisory-vs-enforced budgets, mid-iteration-exit legality, empty-result hallucination fix.

## Non-goals

Lab, resources, index outcomes, rendering, schema.
