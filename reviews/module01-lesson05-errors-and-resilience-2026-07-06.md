# Verification report — Module 1, Lesson 5 (Errors, Rate Limits & Cost Control)
_Date: 2026-07-06 · File: `content/modules/module01/lessons/05-errors-and-resilience.ts`_

## Verdict at a glance
| Standard | Verdict | One-line reason |
|---|---|---|
| 1. Factual accuracy | 🟠 Needs work | One code Blocker (retry example retries 401/403); everything else verified current and correct |
| 2. Clarity & fluency | ✅ Strong | Clean taxonomy → mechanism → economics → levers → observability arc, no forward references |
| 3. Comprehensive depth | ✅ Strong | Real numbers (break-even math, batch limits), failure modes, idempotency, a full cost-audit drill |
| 4. Anthropic + OpenAI | 🟡 Adequate | 3 solid variant blocks; the model-pricing table is Anthropic-only with no OpenAI-side equivalent |
| 5. Engaging interactivity | ✅ Strong | 5 exercises (incl. a spot-the-bug that ironically catches the sibling code bug), 2 callouts, keypoints |
| 6. Tables/diagrams/animations | 🟡 Adequate | Two well-formed, load-bearing tables; no animation — reasonable given no fitting `AnimationName` exists |
| 7. Role alignment | ✅ Strong | Cost/observability/rate-limiting content maps directly to hiring-research doc's named senior signals |

**Overall:** Strong lesson, close to the module's exemplar bar on depth and interactivity — but the "canonical implementation" retry code has a real bug that contradicts the table three rows above it and the lesson's own spot-the-bug exercise. Fix that one code block (and its OpenAI variant) before shipping; everything else is solid to ship as-is.

## Findings (most severe first)

### [Blocker — FIXED] The "canonical" retry code retries on 401/403, contradicting the table above it and the lesson's own exercise
- **Outcome:** Fixed. `RETRYABLE` now lists the specific transient classes (`RateLimitError`, `OverloadedError`/`InternalServerError`, `APIConnectionError`, `APITimeoutError`) instead of the generic `APIStatusError` base class, and `AuthenticationError`/`PermissionDeniedError` are explicitly re-raised alongside `BadRequestError`. Mirrored on the OpenAI variant. `tsc --noEmit` and the mechanical checker both pass after the edit.
- **Where:** `05-errors-and-resilience.ts:55-104` (title: "backoff with jitter — the canonical implementation")
- **Standard:** 1. Factual accuracy / internal consistency
- **Issue:** `RETRYABLE = (anthropic.RateLimitError, anthropic.APIStatusError, anthropic.APIConnectionError, anthropic.APITimeoutError)`. `APIStatusError` is the Anthropic SDK's base class for *every* HTTP status exception (400, 401, 403, 404, 409, 413, 422, 429, 500, 503, 504, 529 all subclass it). The code only special-cases `BadRequestError` (400) with a bare re-raise; `AuthenticationError` (401), `PermissionDeniedError` (403), `NotFoundError` (404), etc. all fall through into `except RETRYABLE` and get retried with backoff. This directly contradicts the failure-taxonomy table 40 lines above (`401 / 403` → "Don't retry; alert loudly") and the lesson's own spot-the-bug exercise a few hundred lines later, whose answer explicitly says "re-raise 400/401/403 immediately." The identical bug is duplicated in the OpenAI variant (`openai.APIStatusError` has the same base-class relationship to `AuthenticationError`/`PermissionDeniedError`, confirmed against the OpenAI Python SDK's own documented hierarchy).
- **Why it matters:** This is the block a learner is most likely to copy-paste — it's titled "canonical" and is the first code example in the lesson. Ironically, the lesson's later spot-the-bug exercise trains the reader to spot exactly this class of mistake ("it retries every `APIError`"), which makes the earlier code look like an oversight rather than an intentional teaching moment. A senior interviewer who traced through this code during a walkthrough would flag it immediately, which undercuts the lesson's credibility on the exact skill it's trying to teach.
- **Suggested fix:** Narrow `RETRYABLE` to the actual transient classes: `(anthropic.RateLimitError, anthropic.OverloadedError, anthropic.InternalServerError, anthropic.APIConnectionError, anthropic.APITimeoutError)` (mirror with `openai.RateLimitError, openai.InternalServerError, openai.APIConnectionError, openai.APITimeoutError` on the OpenAI side) — dropping the generic `APIStatusError` catch-all entirely, or additionally excluding `AuthenticationError`/`PermissionDeniedError`/`NotFoundError` before the `RETRYABLE` branch if a broader catch is intended.

## Fact-check log
| Claim | Location | Status | Source |
|---|---|---|---|
| Anthropic error codes: 400 `invalid_request_error`, 401 `authentication_error`, 403 `permission_error`, 429 `rate_limit_error`, 504 `timeout_error`, 529 `overloaded_error` | table, `:16-49` | verified | [Anthropic API errors](https://platform.claude.com/docs/en/api/errors) |
| OpenAI can return 503 for provider-side overload | table, `:24-27` | verified | [OpenAI community reports of 503 "model currently overloaded"](https://community.openai.com/t/status-code-503-that-model-is-currently-overloaded-with-other-requests/31433) |
| SDK exception names: `anthropic.RateLimitError`, `BadRequestError`, `APIStatusError`, `APIConnectionError`, `APITimeoutError` all exist | code, `:58-59, 65-67` | verified | [anthropic-sdk-python `_exceptions.py`](https://github.com/anthropics/anthropic-sdk-python/blob/main/src/anthropic/_exceptions.py) |
| `APIStatusError` is the shared base class for 401/403/404/etc., not just 5xx | code, `:58-67` | contradicted (see Blocker above) | same source — confirms the bug rather than the claim |
| Anthropic + OpenAI official SDKs have built-in automatic retries for transient errors | explanation, `:76` | verified | Anthropic SDK `_base_client.py` `_should_retry` (retries 429/5xx by default, max_retries=2); OpenAI SDK docs confirm the same default behavior |
| Prompt caching: reads ~0.1× base input; 5-min TTL writes ~1.25×; 1-hour TTL writes ~2× | paragraph, `:152` | verified | [Claude prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) |
| Minimum cacheable prefix ~1K–4K tokens depending on model | paragraph, `:112` | verified | Same docs — Sonnet 5/Opus 4.8: 1,024 tokens; Haiku 4.5: 4,096 tokens |
| Max 4 cache breakpoints per request | paragraph, `:152` | verified | Same docs |
| Changing the tool list invalidates the entire cache (tools render at position zero) | paragraph, `:152` | verified | Same docs — tool definition changes invalidate the full cache per the invalidation table |
| Break-even math: 5-min cache breaks even on 2nd request (1.25+0.1<2); 1-hour needs ~3 (2+0.1+0.1<3) | paragraph, `:152` | verified (arithmetic, using confirmed multipliers) | derived from the pricing figures above |
| `claude-haiku-4-5` ≈ $1/$5 per MTok, `claude-sonnet-5` ≈ $3/$15, `claude-opus-4-8` ≈ $5/$25 | table, `:169-196` | verified for standard pricing, with one nuance | [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) — Sonnet 5 is at *introductory* pricing of $2/$10 through Aug 31, 2026 (i.e., through the date this lesson is dated); $3/$15 is the standard price that takes effect after. The lesson states the post-intro number as current. Low-severity given the table is already labeled "Rough" and the very next paragraph tells readers to "pull current numbers from the pricing page, never from memory or a course" — not worth a separate finding, but noted here for the record. |
| Batch API: ≤~100K requests per batch, most finish within an hour, 24h ceiling, 50% off all tokens, stacks with caching | paragraph + code, `:207-268` | verified | Multiple sources corroborate 100K request cap, 24h SLA, 50% discount stacking with cache discounts |
| OpenAI Batch API is file/JSONL-based, `completion_window: "24h"`, results keyed by `custom_id`, failures via `error_file_id` | code, `:239-266` | verified | Standard, well-documented OpenAI Batch API shape |
| `gpt-5.5` and `gpt-5.4-mini` are real, current OpenAI model names | code, `:139, 245` | verified | OpenAI developer docs list both as current models |
| `stop_reason: "refusal"` is an HTTP 200; `model_context_window_exceeded` is distinct from `max_tokens` | table, `:40-48` | verified | Consistent with Lesson 2's `stop_reason` table (`02-sampling-and-streaming.ts:141-176`), no cross-lesson contradiction |
| "(Module 4)" cross-reference for context-window truncation/summarization | paragraph, `:47` | verified | `content/modules/module04/lessons/01-context-window-as-budget.ts` and `02-compaction-and-summarization.ts` cover exactly this |

## Mechanical pass
`checks.py`: clean — no invalid animation names, malformed links, or ragged tables. Profile: 7 paragraphs, 6 headings, 3 code blocks (all with OpenAI variants), 2 tables, 5 exercises, 1 list, 2 callouts, 1 keypoints block. `pnpm exec tsc --noEmit`: clean, no type errors.

## Strengths worth keeping
- The economics paragraphs (`:112, :152`) do real arithmetic on the break-even points rather than asserting "caching saves money" — exactly the kind of quantified reasoning that separates this from a blog post.
- The three whiteboard drills (cost-audit, retry-policy design, batch pipeline architecture with actual token/cost estimates) are genuinely senior-level and each has a natural interviewer follow-up probe baked into the answer — matches the exemplar's format precisely.
- The observability list (`:279-288`) — tokens split by cache class, alerting on *derivatives* rather than raw numbers, idempotency via `tool_use_id` — is the kind of production detail that's easy to skip and isn't skipped here.
- The spot-the-bug exercise (`:294-307`) teaches precisely the failure mode the lesson's own "canonical" code commits — good pedagogy in isolation, but see the Blocker above for why this needs reconciling.
