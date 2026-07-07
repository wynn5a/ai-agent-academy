import type { QuizQuestion } from "@/lib/types";

export const quiz01: QuizQuestion[] = [
  {
    question: "Why must you resend the full message history on every API call?",
    options: [
      "The provider meters usage per conversation, so the full history must be attached for each call's billing to be computed correctly",
      "The model is stateless — the server keeps no conversation state between calls, so the messages array is the only context it sees",
      "It's an optional optimization that improves answer quality by giving the model more context to read",
      "Only the SDK requires it as a client-side convenience; the raw HTTP API keeps server-side sessions keyed by your API key, so hand-rolled requests can send just the newest message",
    ],
    correct: 1,
    explanation:
      "Each API call is independent; the model sees exactly the tokens you send and nothing else. All conversation state lives in your code. (Provider-side session features are just doing this same resending for you.)",
  },
  {
    question:
      'In one tool-call round trip with the Anthropic API, what is the correct message sequence after the model returns `stop_reason: "tool_use"`?',
    options: [
      "Append one user message that pastes the tool's raw output as plain text — the model reads natural language fine, so no special block type or id bookkeeping is needed before calling again",
      "Remove the assistant's tool_use message from the history and put the result in its place — the model gets confused if it sees its own function-call syntax echoed back on the next turn",
      "Append the assistant message verbatim (with its tool_use block), then a user message containing a tool_result block whose tool_use_id matches, then call again",
      "Call the API again with tool_choice pinned to the same tool so the model re-invokes it and reads the result from its own prior context",
    ],
    correct: 2,
    explanation:
      "The pairing is strict: assistant tool_use (resent verbatim) → user tool_result with matching tool_use_id. Break the pairing and the API returns a 400.",
  },
  {
    question:
      "A 10-turn conversation averages 500 tokens per turn. Roughly how many input tokens does the API call at turn 10 consume, and why?",
    options: [
      "~500 — the API already holds turns 1–9 server-side, so each call sends and pays for only the newest message",
      "~4,500–5,000 — turn 10 resends turns 1–9 plus the new message as input",
      "~25,000 — the whole session is one billing unit, so turn 10's call is metered against the cumulative input of every call made so far",
      "~1,000 — the API automatically summarizes older turns into a compact digest, so you pay only for the summary plus the new message",
    ],
    correct: 1,
    explanation:
      "Turn 10 sends all prior turns (~9 × 500 = 4,500) plus the new one. The ~25,000 figure is the *cumulative* input across all ten calls — which is why cost grows quadratically with conversation length.",
  },
  {
    question:
      "What is the difference between tool calling and structured output, and when should you use a JSON-schema output instead of a tool?",
    options: [
      "They're unrelated subsystems: tool calling executes your function on the provider's servers and returns the output to the model, while structured output is a client-side SDK feature that reshapes text after generation",
      "Tool calling is for when the model needs information or effects mid-task; schema-enforced output is for when you just need the final answer in a fixed shape — use the latter for pure extraction/classification",
      "Structured output is deprecated on current models — the forced-tool-call trick replaced it, so tools should always be used",
      "Tool calling guarantees valid JSON because arguments are schema-constrained, while structured output is only best-effort prompting — so tools are the safer choice even for pure extraction",
    ],
    correct: 1,
    explanation:
      "Mechanically they're the same thing (constrained JSON generation), but the use cases differ: tools mean 'I need you to do something for me mid-task'; structured output means 'give me the answer in this shape.' No action needed → force one structured output and skip the loop.",
  },
  {
    question:
      "The model returns malformed JSON for a tool call. What's the right first mitigation?",
    options: [
      "Escalate to a stronger model right away — malformed JSON means this model is below the task's capability floor, and no amount of retrying fixes capability",
      "Repair the JSON in code with a regex or a lenient parser and continue — the pipeline keeps moving and the model never needs to know its output was fixed",
      "Retry the call, feeding the validation error back to the model so it can self-correct",
      "Lower max_tokens so the model produces shorter, simpler JSON that has fewer chances to contain a syntax error",
    ],
    correct: 2,
    explanation:
      "Feedback-retry is the cheapest, most effective first step — models usually self-correct given the error. Then: tighten the schema (enums, strict mode, lower temperature); finally, fall back to a stronger model. Silent regex 'fixes' hide real failures.",
  },
  {
    question:
      "What does temperature actually do, and what happens if you send temperature=0.7 to a mid-2026 frontier Claude model like claude-sonnet-5?",
    options: [
      "It scales the token probability distribution before sampling; claude-sonnet-5 accepts temperature only at its default value (or omitted), so the non-default 0.7 is rejected with a 400 — control moved to adaptive thinking and the effort parameter",
      "It controls how long and detailed responses are; the request succeeds on any Claude model, with 0.7 producing moderately longer, more elaborate answers",
      "It scales the token probability distribution before sampling, and since 0.7 sits inside Anthropic's documented 0–1 range the request succeeds — only out-of-range values, or sending temperature and top_p together, would trigger a 400",
      "Nothing model-specific happens — temperature is accepted identically by every model and provider, so the request succeeds with slightly more varied wording",
    ],
    correct: 0,
    explanation:
      "Temperature rescales logits before softmax (flatter vs. sharper distribution). Frontier Claude models retired the sampling dials — Opus 4.7/4.8 reject temperature/top_p/top_k outright, while Sonnet 5 rejects any non-default value — and expose adaptive thinking plus output_config.effort instead. Sampling params still exist on most other providers and older models, so know both regimes.",
  },
  {
    question:
      "How do API rate limits typically work, and what's a correct backoff implementation?",
    options: [
      "A single global requests-per-day quota shared across all models; once exceeded, every request fails until the quota resets at midnight UTC, so the only correct handling is to pause until then",
      "Separate RPM (requests) and TPM (tokens) buckets; on 429, retry with exponentially growing delays plus random jitter, honoring any retry-after header",
      "Rate limits apply only to free and trial tiers; paid production keys are provisioned as effectively unlimited",
      "On 429, retry immediately in a tight loop — the limiter is first-come-first-served, so re-requesting the instant you're rejected gets you back into the queue fastest",
    ],
    correct: 1,
    explanation:
      "RPM and TPM are independent — large prompts can exhaust TPM at a tiny request rate. Exponential backoff spreads retries out; jitter decorrelates simultaneous clients so they don't stampede in sync.",
  },
  {
    question: "Which error should you NEVER automatically retry?",
    options: [
      "429 rate limit",
      "529 overloaded",
      "Connection timeout",
      "400 invalid_request",
    ],
    correct: 3,
    explanation:
      "A 400 means the request itself is malformed (bad tool pairing, context overflow, schema errors). It will fail identically every time — retrying just burns money and hides your bug. 429/5xx/timeouts are transient and retryable.",
  },
  {
    question:
      "What is prompt caching and when does it cut agent costs dramatically?",
    options: [
      "The provider caches final answers, so an identical or semantically similar question asked later returns the stored completion for free — like a CDN sitting in front of the model",
      "The processed stable prefix (system prompt, tool schemas, early history) is reused across calls at a large discount — huge for agents, which resend a mostly-identical prefix every turn",
      "The SDK memoizes responses on local disk keyed by a hash of the request, so repeated identical calls never hit the network or bill tokens",
      "It only pays off when the *end* of the request repeats — caching matches on the suffix, so the guidance is to put volatile content first and the stable system prompt last, the reverse of normal prompt order",
    ],
    correct: 1,
    explanation:
      "Caching keys on an exact prefix match, so structure requests stable-first, volatile-last. Multi-turn agent sessions with big system prompts and tool schemas see input costs drop by 70–90%.",
  },
  {
    question:
      "Why should tool descriptions be written as carefully as prompts?",
    options: [
      "The API lints tool definitions server-side and rejects the request with a 400 when a description is too short or ambiguous, so careful wording is about passing schema validation, not steering the model",
      "The model selects tools and generates arguments based solely on names, descriptions, and schemas — a vague description directly causes wrong tool choices and bad arguments",
      "Descriptions matter only when a tool is first introduced — the model remembers your tools across the session, so after turn one the wording no longer affects behavior",
      "Descriptions are surfaced only to end users in the client UI, so wording is a product-copy concern rather than a model-behavior one",
    ],
    correct: 1,
    explanation:
      "Tool descriptions ARE prompt text. 'weather tool' vs. 'Get current weather for a city. Use whenever the user asks about weather or outdoor conditions. Returns Celsius.' — the second reliably produces correct selection and arguments.",
  },
  {
    question:
      "What happens if you send a tool_result whose tool_use_id doesn't match a tool call from the immediately preceding assistant message?",
    options: [
      "The model treats it as extra context and ignores the mismatch — additional information never hurts, and the API forwards whatever blocks you send",
      "The API rejects the request with a 400 — results must pair exactly with requested calls so the model's causal record stays consistent",
      "The API holds the orphaned result in a server-side queue and attaches it to the next call whose tool_use_id matches, so ordering mistakes self-heal",
      "The request succeeds, but the model treats the mismatched result as untrusted user text, quietly degrading answer quality",
    ],
    correct: 1,
    explanation:
      "The strict pairing is validation logic protecting the conversation's causal structure: every result must answer a real request. Unmatched, missing, or duplicated results are malformed history — a 400, not a model behavior.",
  },
  {
    question:
      "Your streaming agent shows nothing for 8 seconds, then dumps the full answer. What's the most likely bug?",
    options: [
      "Nothing is wrong — server-sent events are buffered by the provider until generation completes, so streaming only changes the wire format of the final payload, and a silent gap followed by the full answer is exactly how it's supposed to look",
      "You're iterating the stream but buffering output (or not flushing), or you set stream=False and print after completion — either way you've discarded streaming's time-to-first-token advantage",
      "The prompt is close to the context-window limit, and under context pressure the API finishes generating internally before it starts emitting deltas",
      "max_tokens is set too low, so the server holds the stream until it can verify the response fits",
    ],
    correct: 1,
    explanation:
      "Streaming's entire value is rendering deltas as they arrive (print with flush, or push SSE to your UI). Buffering until the end recreates non-streaming latency with extra code.",
  },
  {
    question:
      "What are adaptive thinking and the effort parameter on current frontier models?",
    options: [
      "Thinking is a latency feature: the model streams a draft answer while still computing, so responses arrive faster; effort configures how many automatic retries the SDK performs before surfacing a transient error to your code",
      "Adaptive thinking lets the model decide when and how much to reason before answering (emitting billed thinking blocks); effort scales how much total work — reasoning, tool use, output — the model spends on the task",
      "Both are prompt-engineering conventions — writing 'think step by step' and 'try harder' in the system prompt — with no actual API fields or billing consequences",
      "They let you reserve provider-side capacity: thinking pins your request to a larger GPU cluster and effort sets its scheduling priority",
    ],
    correct: 1,
    explanation:
      "The control surface moved up a level: instead of shaping token randomness with temperature, you budget the model's work. Thinking blocks are billed output tokens and must be resent verbatim in multi-turn conversations, like any assistant content.",
  },
  {
    question:
      "Your pipeline classifies one million support tickets per day and drafts personalized responses for the ~2% that escalate. What's the cost-sane model strategy?",
    options: [
      "Use the flagship model for everything — classification errors compound downstream, and one mis-routed angry customer costs more than the day's entire token bill, so the premium tier's price difference is negligible at contract scale",
      "Use the cheapest model for everything and accept the quality loss on the escalation drafts — 2% of traffic can't justify maintaining a second model integration",
      "Route: a small fast model (e.g. Haiku-tier) for the million classifications, a stronger model only for the ~20K escalation drafts — order-of-magnitude savings with no quality loss where it matters",
      "Fine-tune a small custom classifier before anything else — routing between hosted models is premature optimization until you've distilled the task",
    ],
    correct: 2,
    explanation:
      "Model routing is the single biggest cost lever — bigger than caching or backoff tuning. Tier price spreads are ~5–25×, and classification at scale is exactly what small models are for. The cascade variant (cheap first, escalate on low confidence) is the follow-up pattern interviewers probe.",
  },
  {
    question:
      "What is the most reliable way to get schema-conforming JSON from a current Anthropic model?",
    options: [
      'Prompt "respond only with valid JSON matching this schema" and add two few-shot examples — current models follow format instructions reliably enough that mechanical enforcement adds nothing',
      "JSON mode, which guarantees both syntactic validity and full conformance to your schema — including numeric ranges — so no client-side validation is needed",
      "Native structured outputs — pass your JSON schema via output_config.format (or use the SDK's parse() helper) so decoding is constrained to the schema; validate client-side for constraints like numeric ranges that constrained decoding can't enforce",
      "Ask for XML tags instead — models emit XML more reliably than JSON, and converting it afterward sidesteps schema enforcement entirely",
    ],
    correct: 2,
    explanation:
      "Prompting gives no guarantee and JSON mode only guarantees syntax, not shape. Constrained decoding guarantees structure — but not numeric min/max or string lengths, which is why you still validate with Pydantic/Zod and retry with the error fed back. The forced-tool-call trick remains the portable fallback on models without native support.",
  },
  {
    question:
      "Your agent consults the same 300-page PDF manual on every session. What's the right way to send it, and what else do you need for it to be economical?",
    options: [
      "Re-upload it as base64 on every call — the provider deduplicates identical payloads server-side, so repeated uploads cost nothing beyond the first",
      "Upload once via the Files API and reference the file_id in each request, and put the stable prefix behind a prompt-cache breakpoint — the Files API stops re-uploading, caching stops re-processing the tokens at full price",
      "Paste the manual's text into the system prompt on the first call only — once the session is established the server remembers the document, so later calls can send just the user's question",
      "Split it into 300 single-page requests fanned out in parallel — smaller prompts stay under TPM limits and are cheaper per token",
    ],
    correct: 1,
    explanation:
      "Two separate costs: upload bandwidth (solved by file_id references) and input-token processing, which recurs every call regardless (solved by prompt caching at ~0.1× for cache reads). 'The server remembers it' contradicts Lesson 1 — the API is stateless.",
  },
  {
    question:
      "A nightly job classifies 800K documents; results are needed by 8 a.m. What's the right API surface, and what do you gain?",
    options: [
      "The standard synchronous endpoint with maximum client-side parallelism — the batch discount only applies to small jobs, and 800K requests can't fit in a single submission anyway",
      "The Batch API: submit asynchronously, get 50% off all token costs, results typically within an hour (24h max) — retrieved in arbitrary order and matched by custom_id",
      "The streaming endpoint — streamed tokens are billed at a lower rate, so long-running jobs should always stream",
      "The Files API: upload all 800K documents once and the provider classifies them server-side overnight, returning an annotated results file by morning with no per-document calls or token charges",
    ],
    correct: 1,
    explanation:
      "Anything that can wait belongs on the Batch API: half price on every token, stacking with cheap-tier routing and caching. The two operational rules: results are unordered (key by custom_id, never position) and each item carries its own succeeded/errored status.",
  },
  {
    question:
      "While streaming a response, your code calls json.loads() on each tool-argument delta as it arrives, and crashes. What's actually on the wire, and what's the fix?",
    options: [
      "Each content_block_delta event carries a complete, independently parseable JSON object for that tool call — so the crash must come from a truncated network read, not your parsing strategy",
      "input_json_delta events carrying fragments of a JSON string (e.g. '{\"ci') — accumulate fragments per block index and parse only when content_block_stop arrives (or let the SDK's final-message helper do it)",
      "The arguments arrive base64-encoded to survive SSE framing — decode each delta before calling json.loads() and the crash disappears",
      "Tool arguments aren't streamed at all — they arrive complete in the final message_stop event, so the fix is to ignore deltas and read the finished message",
    ],
    correct: 1,
    explanation:
      "Streamed tool arguments arrive as partial JSON string fragments — individually unparseable by design. Buffer per block index until the block closes, then parse once. Multiple parallel tool calls interleave as separate indices.",
  },
  {
    question:
      "Inside the agent loop, a tool raises an exception (file not found). What does production-grade code do?",
    options: [
      "Let the exception propagate and fail the session loudly — the orchestrator should restart from a clean history rather than let the model reason over a corrupted state",
      "Drop that tool_use block from the history and return tool_results only for the calls that succeeded — a failed call is noise, and the model produces better answers when its context contains only clean, successful results, just as you'd filter logs before showing them to a human",
      "Catch it and return a tool_result with the error text and is_error: true, so the model can read the failure and adapt — while a max-iteration guard prevents infinite retry loops",
      "Return no tool_result and immediately re-call the model — seeing its own tool_use still unanswered tells it the call failed, and it will retry with corrected arguments",
    ],
    correct: 2,
    explanation:
      "A tool failure is information for the model, not an exception for your process. Dropping the block malforms history (400 — every tool_use needs a matching tool_result), and crashing wastes the session. Return the error as content; pair it with loop guards so a stuck model can't retry forever.",
  },
  {
    question:
      "Which set of fields belongs in the per-call structured log line of a production LLM service?",
    options: [
      "Aggregate daily rollups only — total cost, request count, and average latency — because logging every call at production volume would overwhelm the pipeline, and anything per-call can be reconstructed later from the provider's monthly invoice",
      "The full prompt and completion text of every call — with the raw text preserved you can recompute tokens, cost, and latency offline, so structured fields are redundant",
      "Request/session ids (yours and the provider's), model, tokens split by cache class (input, output, cache_read, cache_creation), stop_reason, latency + TTFT, retry count, and computed cost",
      "Only error codes and stack traces — successful calls are the happy path, and logging them adds noise and storage cost without diagnostic value",
    ],
    correct: 2,
    explanation:
      "The split by cache class is the detail that matters: total input tokens alone can't reveal that a deploy broke your cache prefix. With these fields you can alert on derivatives — cache hit-rate drops, refusal spikes, cost-per-session drift — which is how incidents get caught before the invoice does.",
  },
  {
    question:
      "Your traffic is bursty: a flurry of requests every 20 minutes, silence in between. Default 5-minute-TTL caching shows writes but almost no reads. What's the calculus for switching to the 1-hour TTL?",
    options: [
      "Don't switch — the TTL only controls when a write expires, and since cache reads cost ~0.1× on either tier the two options always cost the same in practice; the doubled write premium is a rounding error",
      "Always take the 1-hour TTL — a longer window can only increase hit rate, and since reads are the discounted part, more hits means strictly lower cost with no downside to weigh",
      "The 1-hour TTL doubles the write premium (~2× vs ~1.25×), so it needs roughly 3+ reads per write to pay off — worth it exactly when gaps exceed 5 minutes so the short cache keeps expiring before it's read, as here",
      "Move the cache breakpoint later in the prompt so more tokens sit inside it — breakpoint placement, not TTL, determines whether bursty traffic gets read hits",
    ],
    correct: 2,
    explanation:
      "Cache reads cost ~0.1× regardless of TTL; the TTL choice is about the write premium. Steady traffic keeps the 5-minute cache warm for free (reads refresh it), so the long TTL only wins when idle gaps outlast the short TTL — the bursty pattern described. Break-even: 5m TTL pays off on the 2nd request, 1h TTL needs about three.",
  },
];
