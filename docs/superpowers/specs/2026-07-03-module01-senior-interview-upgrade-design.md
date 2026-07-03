# Module 1 Senior-Interview Upgrade — Design

**Date:** 2026-07-03
**Goal:** Raise Module 1 ("LLM API Mastery") lesson quality to the bar of a Senior AI Agent Engineer interview loop. Approved direction: all four axes — interview drill sections, senior-level content gaps, more hands-on exercises, deeper "why" explanations.

## Approach

In-place enrichment of the six existing lessons (Approach A). No schema changes: drills reuse the existing `exercise` section type (`kind: "concept"`, click-to-reveal answers) under a `## Whiteboard drills` heading, so zero rendering work. All API facts verified against the claude-api reference skill (stop_reason taxonomy, SSE events, Batch API, cache TTLs, structured-output limits, current pricing).

## Per-lesson changes

1. **01 messages-are-the-only-state** — new "What the server actually does" paragraph (why statelessness is an architectural choice: prefill vs decode, no session affinity); spot-the-bug exercise (shared mutable history / lost turns); drills: resume-a-crashed-session design, cost math aloud, system-prompt placement across providers. Minutes 30 → 35.
2. **02 sampling-and-streaming** — full `stop_reason` taxonomy table (end_turn, max_tokens, tool_use, stop_sequence, pause_turn, refusal, model_context_window_exceeded); what SSE events look like on the wire (event list + raw frames); streaming + tool-call accumulation (`input_json_delta` fragments, accumulate until `content_block_stop`); drills: temperature mechanics, controlling knob-less models, TTFT. Minutes 25 → 35.
3. **03 tool-calling** — `is_error: true` recovery shown in code (currently keypoints-only); max-iteration guard + loop-abort in code; new "Designing tools seniors get asked about" section (result token economy, tool granularity/consolidation, prescriptive when-to-use descriptions); drills: whiteboard-the-loop with interviewer follow-up probes. Minutes 30 → 40.
4. **04 structured-outputs** — new "How constrained decoding actually works" section (grammar-compiled logit masking; why enums/required are enforceable but numeric ranges are not; schema-compilation latency + 24h cache); extra spot-the-bug (missing additionalProperties / unsupported constraint silently dropped); drills: mitigation ladder under pressure, tool-vs-output judgment calls. Minutes 20 → 30.
5. **05 errors-and-resilience** — Batch API economics section (50% discount, <1h typical / 24h max, unordered results keyed by custom_id — completes the 10K-invoices answer); cache mechanics upgrade (5-min vs 1-h TTL write premiums 1.25×/2×, break-even math, min cacheable prefix, invalidation tiers); new "Observability" section (per-call log fields: request id, model, latency, TTFT, tokens by cache class, stop_reason, cost; idempotency for side-effectful retries); drills: "bill is 10× budget" audit, design-a-retry-policy, batch-vs-realtime routing. Minutes 30 → 45.
6. **06 multimodal-inputs** — real image-token math (resolution-dependent: ~1.6K typical, up to ~4.8K at high res on current models; resize guidance); PDF limits (32 MB / page caps); drills: 10K-invoices pipeline design end-to-end (batch + document blocks + structured output + validation + cost estimate). Minutes 15 → 25.

## Quiz

Add 5 questions covering newly-taught material: Batch API economics, streaming tool-argument accumulation, is_error recovery loop behavior, per-call observability fields, cache TTL/write-premium break-even.

## Drill format

Each lesson ends (before `keypoints`) with:

- `heading`: "Whiteboard drills"
- 2–4 `exercise` sections, `kind: "concept"`, phrased as an interviewer would ask them; answers written at the senior bar and ending with the follow-up probe an interviewer would use next.

## Non-goals

Lab, resources, other modules, rendering components, schema changes.
