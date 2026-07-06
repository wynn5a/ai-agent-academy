Reviewed **Module 1, Lessons 3 (Tool Calling) and 4 (Structured Outputs)** — `content/modules/module01/lessons/03-tool-calling.ts` and `04-structured-outputs.ts` — with the deepest pass on your two priorities: factual accuracy and correct Anthropic/OpenAI coverage. Full report: `reviews/module01-lessons03-04-2026-07-06.md`.

**Mechanical floor:** clean. `checks.py` → 0 findings on both; `tsc --noEmit` → exit 0.

**Scorecard:** Accuracy 🟡 · Clarity ✅ · Depth ✅ · Anthropic+OpenAI 🟡 · Interactivity ✅ · Visuals 🟡 · Role alignment ✅

**Overall:** Both lessons are at/near the exemplar bar and ship-worthy after one accuracy fix. I fact-checked every volatile API claim against current provider docs — and the great majority verified exactly.

**Top findings (by severity):**

1. **[Major — accuracy + provider coverage] "The limits are the same" is now wrong for OpenAI.** `04-structured-outputs.ts:88` (reinforced at `:159–163`, `:168`, `:230`). The lesson teaches, universally, that constrained decoding can't enforce `minimum`/`maximum`/`minLength`/`maxLength` and that both providers share that limit. Verified **true for Anthropic** (its docs still list those as unsupported and the SDK strips them). But **OpenAI added those keywords to Structured Outputs in 2025** — it accepts and documents them, so it does *not* reject/strip them, and "the limits are the same" is contradicted. This is exactly the kind of stale fact that gets a candidate corrected in an interview. Fix is a rescope, not a teardown — the operational advice ("validate anyway") stays correct because OpenAI's enforcement still isn't guaranteed.

2. **[Minor — visuals] No diagram for constrained decoding.** `04:154–163`. Logit-masking is a per-step visual process the exemplar chose to animate elsewhere; here it's prose-only. A small mask-step animation would carry the one idea the lesson most wants learners to whiteboard. (Needs a new animation component, hence lower priority.)

3. **[Polish — role alignment] Lesson 4 has no hiring-signal callout of its own.** It has an "Interview angle" callout but no `career` one, though structured outputs is named by name in the hiring doc. Lesson 3's career callout already bundles it, so the signal isn't missing — optional to add.

**Notably clean:** Lesson 3 had zero accuracy issues — all its tool-calling API claims (Anthropic `input_schema`/`tool_use`/`tool_result`/`strict`, OpenAI flat tools/`function_call`/`call_id`/`function_call_output`, both model IDs) verified against current docs, and its "no `is_error` on `function_call_output`" catch is a genuinely sharp provider difference. Its career callout's ~280% Stanford-HAI figure matches the repo's research doc and uses the credible figure, not the flagged one. Provider coverage in both lessons is, in structure, exemplary — every block ships both variants and names the real difference.

Want me to apply the fix for finding #1 (rescope the OpenAI "limits are the same" claim and scope the universal mechanism statements to the Anthropic path, keeping the validate-anyway advice)? I can leave #2 and #3 to you, or do all three.
