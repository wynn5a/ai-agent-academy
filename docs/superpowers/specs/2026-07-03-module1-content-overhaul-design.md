# Module 1 Content Overhaul — Design

**Date:** 2026-07-03
**Scope:** `content/modules/module01.ts`, plus one small schema/component addition (`lib/types.ts`, `components/Exercise.tsx`, `components/SectionRenderer.tsx`) that benefits all modules.
**Goal:** Bring Module 1 ("LLM API Mastery") up to mid-2026 API reality, fill topic gaps, add in-lesson interactive exercises, and deepen interview relevance — without changing the module's structure-as-data architecture.

## Motivation

Module 1 was written against early-2025 APIs. Since then:

- Frontier Claude models (Sonnet 5, Opus 4.7/4.8, Fable 5) **removed `temperature`/`top_p`/`top_k`** — sending them returns a 400. The replacement dials are adaptive thinking (`thinking: {type: "adaptive"}`) and `output_config: {effort: ...}`. Lesson 2 currently teaches sampling params as universal, which is now wrong for the models learners will actually use.
- Anthropic shipped **native structured outputs** (`output_config.format`, `client.messages.parse()`, `strict: true` tool use). Lesson 4 teaches the forced-tool-call trick as "the standard Anthropic pattern" — it's now the fallback, not the primary.
- New stop reasons exist (`refusal`, `model_context_window_exceeded`) that a production error taxonomy must cover.
- Model IDs in examples (`claude-sonnet-4-5`, `gpt-4o`) are one-to-two generations stale; OpenAI's primary API surface is now the Responses API.
- The module description promises "raw HTTP" but every example uses an SDK; extended thinking, multimodal input, and model selection are absent entirely.

## Non-goals

- No changes to other modules' content (the new `exercise` section type is available to them, but authoring their exercises is out of scope).
- No progress-tracking/grading for exercises — reveal-answer only.
- No lab rewrite — the Lab 01 design is sound; it gets model-ID updates and one new stretch goal.
- No changes to gates, quiz pass threshold, or routing.

## A. Freshness update (existing lessons 1–5 + quiz)

### Model IDs and API surfaces

- All Anthropic examples: `claude-sonnet-4-5` → `claude-sonnet-5`. Where "strongest model" is contextually relevant, mention `claude-opus-4-8`; `claude-haiku-4-5` appears in the model-selection section (B3).
- All OpenAI examples: update model IDs and show the **Responses API** as the current primary surface, with a note that Chat Completions remains widely deployed (and interview-relevant). Exact OpenAI model IDs and request shapes will be **verified via web research during implementation** — not written from memory.

### Lesson 2 — rewritten as "Controlling Generation: Sampling, Thinking & Streaming"

- Keep the sampling-theory content (distribution, temperature scaling, top_p truncation) — conceptually correct, provider-general, interview-relevant.
- Add the 2026 twist as a first-class section: frontier Claude models rejected sampling params (400); control is now **adaptive thinking** + **`output_config.effort`** (`low`→`max`). Explain what each does and when to use which effort tier.
- Reframe "agents want temperature 0–0.3" as provider-dependent guidance: true where sampling params exist; on param-less models you simply don't tune randomness — you tune effort.
- Keep the streaming half essentially as-is (still accurate); add one line that thinking blocks also stream (`thinking_delta`) and that summarized display is opt-in on the newest models.
- The `temperature` animation stays (the concept it illustrates is unchanged).

### Lesson 3 — Tool Calling End-to-End

Additions (existing content stays):

- **Thinking + tool loops:** thinking blocks that arrive alongside `tool_use` must be passed back verbatim with the assistant turn — same invariant as the tool_use block itself. One paragraph + one line in the code explanation.
- **`strict: true`** on tool definitions: guarantees `tool_use.input` validates against the schema (requires `additionalProperties: false` + `required`).
- **Parallel tool calls** promoted from a keypoint bullet to a short explained paragraph: multiple `tool_use` blocks in one assistant turn → execute all → return **all** `tool_result` blocks in a **single** user message (splitting them degrades future parallelism).

### Lesson 4 — Structured Outputs & JSON Schema

- The rigor table gains a fourth row / reordering: **native structured outputs** (`output_config: {format: {type: "json_schema", schema}}` on Anthropic; `client.messages.parse()` as the SDK convenience) become the top-rigor, recommended approach.
- The forced-tool-call example stays, retitled as the portable/legacy pattern ("works on any tool-calling model, and what structured outputs desugar to conceptually").
- Validation-and-repair section (Pydantic + feedback retry) stays unchanged — still best practice.
- Note the schema limitations of constrained decoding (no recursion, no numeric min/max — validate those client-side), since the current example uses `minimum`/`maximum` in a way native structured outputs would strip.

### Lesson 5 — Errors, Rate Limits & Cost Control

- Failure-taxonomy table gains rows: `stop_reason: "refusal"` (HTTP 200 — check stop_reason before reading content; not an HTTP error) and `model_context_window_exceeded` vs `max_tokens` (different fixes).
- Fix typo "a infinite loop" → "an infinite loop".
- Backoff, prompt-caching, and budget content verified still accurate; caching section notes minimum cacheable prefix is model-dependent (~1–4K tokens) and that reads are ~0.1×, writes ~1.25×.

### Quiz audit

- Rewrite the sampling question (Q6) to match the rewritten Lesson 2 (concept of temperature/top_p + the fact that frontier Claude models removed them in favor of effort).
- Audit remaining 11 questions for drift; expected minor touch-ups only (e.g., Q5 "malformed JSON" stays valid).

## B. New topics

| # | Topic | Placement | Content |
|---|---|---|---|
| B1 | Raw HTTP | New section near the top of **Lesson 1** | One `curl` POST to `/v1/messages` mirroring the first Python example; the point: the SDK is a thin convenience over JSON-over-HTTP — headers (`x-api-key`, `anthropic-version`), body, response shape. |
| B2 | Extended thinking / effort | **Lesson 2** (part of the rewrite, see A) | Adaptive thinking, effort tiers, thinking-block handling, streaming interaction. |
| B3 | Model selection & pricing | New section in **Lesson 5** | Tier table (Haiku 4.5 / Sonnet 5 / Opus 4.8 with indicative $/MTok and context sizes, explicitly flagged as "check the pricing page — these change"), routing heuristics (cheap model for classification/routing, strong model for planning), and cascade/fallback as a cost pattern. |
| B4 | Multimodal input | **New Lesson 6**: "Beyond Text: Images, PDFs & Files" (~15 min) | Image content blocks (base64 + URL), PDF `document` blocks, when to use the Files API (reuse across requests), token cost of images, one worked extraction example ("pull the table out of this invoice PDF"). Ends with keypoints. No new animation (reuse none; text + code only). |

Module goes 5 → 6 lessons; all lesson counts in the UI derive from the data, so no other code changes.

## C. Interactive exercises (schema + component)

### Schema (`lib/types.ts`)

New `Section` union member:

```ts
| {
    type: "exercise";
    kind: "predict" | "spot-the-bug" | "concept";
    prompt: string;          // markdown-lite, the question
    code?: string;           // optional code the question refers to
    language?: string;       // for the code block
    answer: string;          // markdown-lite, revealed on click
  }
```

### Component

- New `components/Exercise.tsx`, a client component: renders a labeled card (kind badge: "Predict the output" / "Spot the bug" / "Check yourself"), the prompt, the optional code block (reusing `CodeBlock`), and a "Reveal answer" button. Answer expands with a Framer Motion height/opacity animation consistent with the existing motion language. Toggleable (reveal/hide). No persistence.
- One `case "exercise"` added to `components/SectionRenderer.tsx`.

### Authoring (Module 1 only, ~10 exercises)

Roughly two per lesson, e.g.:

- L1 predict: "comment out this append — what does turn 2 print?"
- L1 predict: token math for turn N cost.
- L2 concept: "you set temperature=0.7 on claude-sonnet-5 — what happens?"
- L3 spot-the-bug: tool loop that drops the assistant turn before appending results (400).
- L3 spot-the-bug: `tool_result` with mismatched `tool_use_id`.
- L4 concept: extraction task — tool call or structured output?
- L5 spot-the-bug: retry loop that retries a 400.
- L5 predict: cache hit/miss when a timestamp is interpolated into the system prompt.
- L6 concept: image via URL vs base64 vs Files API — which when?

## D. Depth & polish

- **Interview-angle callouts:** one per lesson using the existing `callout` type (`kind: "insight"`, `title: "Interview angle"`) — e.g. "Explain statelessness and the cost consequence" (L1), "Design a tool-calling loop on a whiteboard; what invariants must hold?" (L3).
- **Quiz additions:** 3–4 new questions covering adaptive thinking/effort, model selection, native structured outputs, and multimodal basics. Module quiz: 12 → ~15–16 questions.
- **Lab:** acceptance criteria unchanged; model references updated; new stretch goal: "Add a `--think` flag that enables adaptive thinking and prints the model's summarized reasoning before the answer."
- **Resources:** audit URLs (Anthropic docs now live at platform.claude.com — update `docs.claude.com` links); add one resource for the OpenAI Responses API migration docs.
- Update the module `description` and `outcomes` to reflect the new coverage (raw HTTP, thinking/effort, multimodal, model selection).

## Implementation order

1. Schema + component (C) — smallest, unblocks content authoring, verifiable in isolation.
2. Web research pass: verify current OpenAI model IDs/Responses API shapes; verify Anthropic doc URLs.
3. Lesson-by-lesson content edits (A + B), each leaving the file type-checking (`pnpm build` or `tsc`).
4. Quiz audit + additions, lab tweaks, resources, module description/outcomes (D).
5. Exercises authored last (C content), once surrounding lesson text is final.
6. Verify: `pnpm lint`, `pnpm build`, and a manual walkthrough of Module 1 in `pnpm dev`.

## Error handling / risks

- **Factual drift risk (OpenAI side):** mitigated by researching current docs during implementation instead of writing from memory; where uncertainty remains, prose says "check your provider's docs" rather than asserting specifics.
- **Type safety:** the new `Section` variant is additive; exhaustive `switch` in `SectionRenderer` gets one new case. Other modules are untouched and keep compiling.
- **Reading-time estimates:** `minutes` values updated for lessons that grew (L1 25→30, L2 20→25, L5 25→30, L6 new at 15).

## Testing

- `pnpm lint` and `pnpm build` must pass (TypeScript validates all content against the schema — this is the content "test suite").
- Manual: render every Module 1 lesson in dev, exercise reveal/hide works, quiz renders 15+ questions, Lesson 6 appears in the sidebar and module overview.
