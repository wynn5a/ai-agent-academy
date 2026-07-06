# Verification Report — Module 1, Lesson 02: Sampling & Streaming

**File:** `content/modules/module01/lessons/02-sampling-and-streaming.ts`
**Verdict:** Ship it. No blocking issues. One optional polish note.

## Method

- Read the full lesson and validated every `Section` against `lib/types.ts`.
- Cross-checked all Anthropic API claims against the authoritative Claude API reference (2026 model surface: Opus 4.7/4.8, Sonnet 5, adaptive thinking, `output_config.effort`, `stop_reason`/`stop_details`, streaming SSE frames).
- Verified the three referenced animations (`token-selection`, `temperature`, `token-stream`) exist and are dispatched in `components/animations/ConceptAnimation.tsx`.
- Ran `npx tsc --noEmit` — exit 0, clean.

## Factual accuracy — Anthropic claims (all correct)

These are the load-bearing, easily-wrong claims. Each checks out against the authoritative reference:

- **L71** Opus 4.7/4.8 reject `temperature`/`top_p`/`top_k` (400 on any inclusion, even the default). ✓
- **L71** Sonnet 5 is more lenient: omit-or-default accepted, only a *non-default* value 400s. ✓ (This is a precise, correct distinction that most write-ups get wrong.)
- **L71** `thinking: {"type":"enabled","budget_tokens":N}` now 400s; adaptive is the only on-state. ✓
- **L75** `effort` lives in `output_config`, defaults to `"high"`, range `low`→`max` (code comment: `low|medium|high|xhigh|max`). ✓
- **L75** Omitting `thinking`: Sonnet 5 runs adaptive automatically; Opus 4.7/4.8 run with no thinking. ✓ (Exact match to the reference.)
- **L95/L99** Thinking blocks default to `display="omitted"` (empty text); `"summarized"` for a readable summary; thinking billed as output tokens regardless; resend verbatim in multi-turn. ✓
- **stop_reason table (L138–176)** `end_turn`, `max_tokens`, `tool_use`, `stop_sequence`, `pause_turn`, `refusal`, `model_context_window_exceeded` — all valid. ✓
- **L181** Refusal is HTTP 200; `stop_details` populated only on `refusal`, `null` otherwise — guard before reading. ✓ (Exact match.)
- **Softmax/temperature (L30–47)** Formula correct; `e² ≈ 7.39` correct; "temperature divides logits before softmax" correct; T=0 not perfectly deterministic (GPU nondeterminism/ties) correct. ✓
- **SSE frames (L378–399)** `message_start` → `content_block_start`/`delta`/`stop` → `message_delta` (carries `stop_reason`+usage) → `message_stop`; delta types `text_delta`/`thinking_delta`/`input_json_delta`. ✓ Matches the reference SSE format exactly.
- **Streaming SDK (L338–345)** `client.messages.stream(...)`, `stream.text_stream`, `stream.get_final_message()`. ✓
- **Tool-call accumulation (L436–458)** `input_json_delta` keyed by block `index`, parse only at `content_block_stop`, `event.delta.partial_json`. ✓

## Factual accuracy — OpenAI claims (accurate; one soft area)

- Chat Completions `finish_reason` (`stop`/`length`/`tool_calls`/`content_filter`/`function_call`) and Responses API `status` (`completed`/`incomplete`+`incomplete_details.reason`/`in_progress`/`failed`), plus the "no dedicated tool-call status — scan `output` for `function_call`" nuance — all accurate. ✓
- Responses API streaming (`response.output_text.delta`, `response.function_call_arguments.delta`/`.done`, keyed by `item_id`) — accurate. ✓
- **Soft area (L79, L111):** the version-drift examples — GPT-5.2 defaulting to `reasoning_effort: "none"` reintroducing `temperature`, and effort values up to `"xhigh"`/`"none"` — are forward-looking and not independently verifiable. They are, however, explicitly framed as "treat this as a per-version question you check in the docs, not a permanent rule," so they teach the right instinct rather than asserting brittle fact. Acceptable as written for a 2026-framed lesson; no change required. Optionally soften phrasing if you want to future-proof, but it's not a defect.

## Schema / structure / build

- All section types, `provider`/`variants`, `tab-group` panels, callout kinds (`tip`/`warning`/`insight`), and exercise kind (`concept`) are valid per `lib/types.ts`. ✓
- All three animation names resolve in the dispatch table. ✓
- `tsc --noEmit` clean. ✓

## Quality-standard scan (Academy's seven bars)

- **Depth:** Excellent — logits → softmax → sampling knobs → 2026 dials → stop reasons → streaming → SSE-vs-WebSocket → tool-call JSON accumulation.
- **Dual-provider:** Strong — Anthropic + OpenAI covered via code `variants` and a `tab-group` for stop reasons.
- **Interactivity:** 4 concept exercises incl. 3 "whiteboard drills." ✓
- **Tables/diagrams/animations:** Transport comparison table, two stop-reason tables, three animations. ✓
- **Role alignment:** Repeated interview framing ("interviewers use this as a completeness check," "Interview angle" callout, drills). ✓
- **Clarity/fluency:** High. Prose is tight and precise.

## Recommendation

Good to ship as-is. The only judgment call is the speculative OpenAI version-drift detail (L79/L111), which is appropriately hedged — leave it or lightly soften, your call. Everything factual on the Anthropic side is correct and unusually precise.
