# Verification report — Module 1, Lesson 2 (Sampling, Thinking & Streaming)
_Date: 2026-07-06 · Files: `content/modules/module01/lessons/02-sampling-and-streaming.ts`_

> Scope note: single-lesson review, as requested (pre-commit ship check). This
> file is also the skill's designated exemplar — the quality bar other content is
> rated against — so it is being held to that bar, not merely "is it fine."

## Verdict at a glance
| Standard | Verdict | One-line reason |
|---|---|---|
| 1. Factual accuracy | 🟡 Adequate | Core volatile claims verified against current docs; two fine-grained claims (Opus-vs-Sonnet thinking default; GPT-5.2-as-the-default-`none` example) are unverifiable/imprecise and should be double-checked before commit. |
| 2. Clarity & fluency | ✅ Strong | Derives from first principles (logits → softmax → sampling), every term defined on first use, ideas build cleanly. |
| 3. Comprehensive depth | ✅ Strong | Unhappy paths everywhere (truncation, refusal-as-200, `pause_turn`, context-window overflow, partial-JSON accumulation), senior nuances made explicit. |
| 4. Anthropic + OpenAI | ✅ Strong | Both sides on every provider-specific mechanic, and the *difference* is named, not just paralleled. |
| 5. Engaging interactivity | ✅ Strong | 4 exercises + 3 whiteboard drills + keypoints + punctuating callouts; reader is repeatedly asked to think. (Minor: all exercises are `kind: "concept"`.) |
| 6. Tables/diagrams/animations | ✅ Strong | 3 valid animations, 4 well-formed tables (incl. the SSE-vs-WebSocket comparison), captions match content, no ragged rows. |
| 7. Role alignment | ✅ Strong | Interview framing woven throughout; depth targets the senior bar; maps to what postings probe. |

**Overall: good to ship.** This is a genuinely strong lesson and reads like the exemplar it is — the fact-check found no code that won't run and no invented API surface. There are **no Blockers and no Majors.** The only thing I'd do before committing is a 2-minute sanity check on one factual claim where current sources actually conflict (the "when you omit `thinking`, Opus runs with none / Sonnet runs adaptive" line) and tighten one illustrative version number. Neither blocks the commit; both are cheap to fix.

## Findings (most severe first)

### [Minor] "Omit `thinking` → Opus runs with no thinking, Sonnet runs adaptive" — sources conflict, verify before commit
- **Where:** `content/modules/module01/lessons/02-sampling-and-streaming.ts:75` (and echoed in the Opus tier guidance)
- **Standard:** 1 (Factual accuracy)
- **Issue:** The lesson states, confidently and specifically, that omitting `thinking` makes **Sonnet 5 run adaptive automatically** while **Opus 4.7/4.8 run with no thinking at all**. Current secondary sources disagree with each other on the Opus default: one line of coverage says adaptive thinking on Opus 4.7 is *disabled by default and must be enabled explicitly* (supports the lesson); another says Fable 5 / Sonnet 5 / **Opus 4.7 and later "always use adaptive reasoning"** (contradicts the "no thinking at all" claim). This may be an API-vs-Claude-Code distinction, but I could not resolve it against a single primary API-reference statement.
- **Why it matters:** A learner who asserts "Opus does no thinking unless you turn it on" in an interview, if that's actually the Claude-Code default rather than the raw-API default, looks like they half-read the docs. The *pedagogical* point ("be explicit about `thinking` rather than relying on a per-tier default") is sound either way — it's the specific per-model default that's shaky.
- **Suggested fix:** Confirm against the current Anthropic extended-thinking / model-config docs whether the raw Messages API default for Opus 4.7/4.8 is truly "no thinking when omitted." If it can't be pinned precisely, soften to the instinct: "defaults differ by tier and can differ between the raw API and Claude Code — set `thinking: {\"type\": \"adaptive\"}` explicitly rather than relying on the default." That preserves the lesson's own "check the docs" register.

### [Minor] `GPT-5.2 defaulting to reasoning_effort: "none"` — the documented default-`none` release is GPT-5.1
- **Where:** `content/modules/module01/lessons/02-sampling-and-streaming.ts:79`
- **Standard:** 1 (Factual accuracy)
- **Issue:** The example claims GPT-5.2 defaults to `reasoning_effort: "none"` and thereby re-accepts `temperature`. Current docs attribute the "defaults to `none`" behavior to **GPT-5.1**; GPT-5.5 explicitly defaults to **`medium`**. So the specific version cited as the example isn't the one the docs single out, and the causal half ("effort `none` → `temperature` re-accepted") I could not confirm from a primary source. The claim is *hedged* ("e.g.", "some later releases", "check the docs"), which keeps it low-risk, but the example is imprecise.
- **Why it matters:** The lesson's point — "temperature acceptance is per-version, not per-family" — is correct and well-hedged. Using a version number the docs don't back for the flagship example slightly undercuts the otherwise-precise voice.
- **Suggested fix:** Swap the example to **GPT-5.1** (the documented default-`none` release), or generalize to "some GPT-5.x releases default reasoning effort low enough that `temperature` behaves like a non-reasoning model again." Keep the existing "check the docs" hedge.

### [Minor] Effort/`reasoning_effort` value lists don't quite match the cited models
- **Where:** `:89` (`# low | medium | high | xhigh | max` on a `claude-sonnet-5` call) and `:106` (`# minimal | low | medium | high | xhigh` on a `gpt-5.5` call)
- **Standard:** 1 (Factual accuracy) / 4 (provider precision)
- **Issue:** Two small mismatches between a code comment and the model on that line:
  - Anthropic: `xhigh` is documented as **Opus-4.7-exclusive**; listing `xhigh` in the comment on a **Sonnet 5** call is slightly off (Sonnet's ladder is low/medium/high/max). The naming of the top of the ladder also varies by model version across sources (e.g. some Opus 4.8 coverage uses "ultra"), so this is genuinely fuzzy, not clearly wrong.
  - OpenAI: the comment lists `minimal` for **gpt-5.5**, but gpt-5.5's documented effort values are **none/low/medium/high/xhigh** — `minimal` was the GPT-5.0-era term, renamed/replaced by `none` in 5.1+. The lesson's prose at `:79` correctly says "`minimal`/`none`", so this is just the one comment lagging.
- **Why it matters:** These are the kind of details a sharp interviewer or a copy-pasting learner will trip on. Low impact, but this lesson's whole value proposition is that it gets these exactly right.
- **Suggested fix:** On `:89`, either drop `xhigh` from the Sonnet-5 comment or add "(xhigh is Opus-4.7 only)"; on `:106`, change `minimal` → `none` to match gpt-5.5. Optional: a half-line noting the effort ladder is calibrated per model so the same name isn't the same amount of work across models.

### [Minor] `gpt-5.5` / `claude-sonnet-5` model IDs — verified, but pin the churn risk
- **Where:** `:86`, `:106`, `:340`, `:352`, `:440`, `:467`
- **Standard:** 1 (Factual accuracy)
- **Issue:** Not a defect — `gpt-5.5` is a real API model (released Apr 2026; snapshot `gpt-5.5-2026-04-23`), and `claude-sonnet-5` is used consistently. Flagging only because bare aliases like these are the single most churn-prone thing in the lesson; they'll need a revisit at the next model turn.
- **Why it matters:** Purely maintenance. No action needed for this commit.
- **Suggested fix:** None now. Consider a repo-wide convention note that model aliases in code samples are expected to drift.

### [Polish] Exercise variety and a missing `career`/"Hiring signal" callout
- **Where:** exercises at `:116, :492, :500, :508`; callouts throughout
- **Standard:** 5 (Interactivity) / 7 (Role alignment)
- **Issue:** All four exercises are `kind: "concept"`. The content is full of code with classic traps (parse-as-you-go streaming, one global buffer vs per-index) that would make an ideal **spot-the-bug** exercise. Separately, interview relevance is delivered via `insight` callouts and drills but never via the `career`/"Hiring signal" callout kind, which exists precisely for "this is what interviewers screen for" moments (e.g. the `stop_reason`-completeness point).
- **Why it matters:** Both are upside, not defects — the lesson already engages the reader well and is already interview-aware. A spot-the-bug on the streaming JSON accumulator would test the exact skill the section teaches, and a `career` callout would make the hiring signal explicit rather than implicit.
- **Suggested fix:** Optional. Consider converting one drill to `kind: "spot-the-bug"` over a broken (parse-every-delta) accumulator, and adding one `career` callout on the "switch on the stop field before reading content — interviewers use this as a completeness check" point.

## Fact-check log
| Claim | Location | Status | Source |
|---|---|---|---|
| Opus 4.7/4.8 reject `temperature`/`top_p`/`top_k` → 400 | `:71` | **verified** | platform.claude.com migration guide; multiple Bedrock/adapter bug reports on Opus 4.7 & 4.8 |
| `budget_tokens` fixed-thinking shape removed → 400; only `{"type":"adaptive"}` | `:71` | **verified** | Anthropic extended-thinking / effort docs; Opus 4.7 breaking-changes coverage |
| `output_config.effort`: low\|medium\|high\|xhigh\|max, default `"high"` | `:75, :89` | **verified** | platform.claude.com/docs "Effort" page (five levels; API default high) |
| Opus rejects `temperature` even at its **default** value | `:71, :121` | **unverifiable** | Opus "must not send it at all" is documented; "even the default 400s" not cleanly confirmed vs. the "temperature may only be 1 with thinking" nuance |
| Sonnet 5 accepts omitted/default `temperature`, 400s only on non-default | `:71, :119, :121` | **unverifiable** | No primary source found stating the exact Sonnet-5 leniency split; direction (Sonnet more lenient than Opus) is plausible |
| Omit `thinking` → Sonnet 5 adaptive auto / Opus 4.7-4.8 no thinking | `:75` | **unverifiable (sources conflict)** | One source: adaptive off-by-default on Opus 4.7; another: Opus 4.7+ "always use adaptive reasoning" — see Finding 1 |
| OpenAI o1/o3/o4-mini/GPT-5 reject temperature/top_p/presence_penalty/frequency_penalty when reasoning active | `:79` | **verified** | Azure OpenAI reasoning-models doc (unsupported-param list); OpenAI community + SDK issues |
| Error string "Unsupported value: 'temperature' does not support … Only the default (1) value is supported." | `:79` | **verified** | OpenAI community reports quote this exact template |
| `reasoning_effort`/`reasoning:{effort}`; values minimal/none…high/xhigh, version-dependent | `:79, :106` | **verified** | OpenAI docs: gpt-5 minimal/low/medium/high; 5.1+ adds none; 5.4+ adds xhigh |
| GPT-5.2 defaults `reasoning_effort:"none"` (re-accepting temperature) | `:79` | **partially / unverifiable** | Documented default-`none` release is GPT-5.1; gpt-5.5 defaults `medium`; 5.2-specific + temperature-reintroduction not confirmed — see Finding 2 |
| `gpt-5.5` exists in the API | `:106` etc. | **verified** | openai.com "Introducing GPT-5.5"; API since 2026-04-24, snapshot `gpt-5.5-2026-04-23` |
| `stop_reason` enum incl. `pause_turn`, `refusal` (HTTP 200), `model_context_window_exceeded`; `stop_details` only on refusal | `:139-181, :520` | **verified** | platform.claude.com "Stop reasons and fallback"; refusal-as-200 + stop_details-on-Opus-4.7+ documented |
| Anthropic SSE lifecycle + delta types (`text_delta`/`thinking_delta`/`input_json_delta`) | `:372-399` | **verified** | Anthropic Messages streaming docs (stable event surface) |
| OpenAI Responses streaming: `response.output_text.delta`, `.function_call_arguments.delta`/`.done` | `:357, :472-475` | **verified** | OpenAI Responses streaming reference; exact event shapes match |
| `response.reasoning_summary_text.delta` streams reasoning summaries | `:362` | **verified (lower confidence)** | Part of the documented Responses reasoning event family; search didn't surface the exact schema page |

## Mechanical pass
- `checks.py`: **0 findings.** Profile — paragraph 15, heading 9, code 6, table 4, animation 3, exercise 4, list 1, callout 5 (insight 2 / tip 1 / warning 2), keypoints 1, tab-group 1. Providers: claude-tagged 4, openai-tagged 4, variant-blocks 3 (every provider-specific code block carries the other provider's variant). Animations `token-selection`, `temperature`, `token-stream` all valid names; no ragged tables; no malformed links; no out-of-range quiz indices (n/a here).
- `pnpm exec tsc --noEmit`: **exit 0** (clean; schema validates against `lib/types.ts`).

## Strengths worth keeping
- **First-principles derivation** (logit → softmax → sampling) before any knob is named — `:20-33`. The `exp()`-amplifies-gaps note (`:32`) is exactly the intuition interviewers want.
- **The "difference is named" provider treatment.** The tab-group at `:132` doesn't just parallel code — it teaches that OpenAI has no `stop_reason`, that Chat Completions and Responses disagree with each other, and that the Responses API has no tool-call status. That contrast is the interview payload.
- **Unhappy-path saturation:** refusal-as-200, silent `max_tokens` truncation, `pause_turn` resume discipline, reasoning tokens eating the whole budget before any visible text (`:238-240`), and the per-index partial-JSON accumulation trap (`:407-458`) with a wrong-vs-right code contrast.
- **The SSE section** (`:272-333`): the "why not WebSocket / not plain HTTP" reasoning + comparison table + the HTTP/2 concurrency nuance is senior-grade and rarely taught this precisely.
- **Correct, current hedging instinct** — the lesson repeatedly pushes "check the model's current docs" on exactly the parameters that rot. That instinct is why the fuzzy findings above are Minor, not Blockers.
