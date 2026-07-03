import type { QuizQuestion } from "@/lib/types";

export const quiz01: QuizQuestion[] = [
  {
    question: "Why must you resend the full message history on every API call?",
    options: [
      "The API bills per message, so resending is a billing requirement",
      "The model is stateless — the server keeps no conversation state between calls, so the messages array is the only context it sees",
      "It's an optional optimization that improves response quality",
      "The SDK requires it, but the raw HTTP API keeps server-side sessions",
    ],
    correct: 1,
    explanation:
      "Each API call is independent; the model sees exactly the tokens you send and nothing else. All conversation state lives in your code. (Provider-side session features are just doing this same resending for you.)",
  },
  {
    question:
      'In one tool-call round trip with the Anthropic API, what is the correct message sequence after the model returns `stop_reason: "tool_use"`?',
    options: [
      "Append a user message containing the tool output as plain text, then call again",
      "Replace the assistant's tool_use message with the result and call again",
      "Append the assistant message verbatim (with its tool_use block), then a user message containing a tool_result block whose tool_use_id matches, then call again",
      "Call the API again with tool_choice set to the same tool so it can read the result",
    ],
    correct: 2,
    explanation:
      "The pairing is strict: assistant tool_use (resent verbatim) → user tool_result with matching tool_use_id. Break the pairing and the API returns a 400.",
  },
  {
    question:
      "A 10-turn conversation averages 500 tokens per turn. Roughly how many input tokens does the API call at turn 10 consume, and why?",
    options: [
      "~500 — each call only sends the new turn",
      "~4,500–5,000 — turn 10 resends turns 1–9 plus the new message as input",
      "~25,000 — the call is billed for the whole session cumulatively",
      "~1,000 — the API automatically summarizes older turns",
    ],
    correct: 1,
    explanation:
      "Turn 10 sends all prior turns (~9 × 500 = 4,500) plus the new one. The ~25,000 figure is the *cumulative* input across all ten calls — which is why cost grows quadratically with conversation length.",
  },
  {
    question:
      "What is the difference between tool calling and structured output, and when should you use a JSON-schema output instead of a tool?",
    options: [
      "They're unrelated features; tools execute code server-side while structured output runs locally",
      "Tool calling is for when the model needs information or effects mid-task; schema-enforced output is for when you just need the final answer in a fixed shape — use the latter for pure extraction/classification",
      "Structured output is deprecated; tools should always be used",
      "Tool calling guarantees valid JSON while structured output does not",
    ],
    correct: 1,
    explanation:
      "Mechanically they're the same thing (constrained JSON generation), but the use cases differ: tools mean 'I need you to do something for me mid-task'; structured output means 'give me the answer in this shape.' No action needed → force one structured output and skip the loop.",
  },
  {
    question:
      "The model returns malformed JSON for a tool call. What's the right first mitigation?",
    options: [
      "Immediately switch to a larger model",
      "Silently fix the JSON with a regex and continue",
      "Retry the call, feeding the validation error back to the model so it can self-correct",
      "Crash — malformed JSON means the API is broken",
    ],
    correct: 2,
    explanation:
      "Feedback-retry is the cheapest, most effective first step — models usually self-correct given the error. Then: tighten the schema (enums, strict mode, lower temperature); finally, fall back to a stronger model. Silent regex 'fixes' hide real failures.",
  },
  {
    question:
      "What does temperature actually do, and what happens if you send temperature=0.7 to a mid-2026 frontier Claude model like claude-sonnet-5?",
    options: [
      "It scales the token probability distribution before sampling; on current frontier Claude models the parameter was removed entirely, so the request is rejected with a 400 — control moved to adaptive thinking and the effort parameter",
      "It controls response length; the request succeeds but responses get longer",
      "It re-ranks the training data; the request succeeds with more creative output",
      "Nothing — temperature is accepted identically by every model and provider",
    ],
    correct: 0,
    explanation:
      "Temperature rescales logits before softmax (flatter vs. sharper distribution). Frontier Claude models (Sonnet 5, Opus 4.7+) removed temperature/top_p/top_k — sending them returns a 400 — and expose adaptive thinking plus output_config.effort instead. Sampling params still exist on most other providers and older models, so know both regimes.",
  },
  {
    question:
      "How do API rate limits typically work, and what's a correct backoff implementation?",
    options: [
      "One global requests-per-day quota; wait until midnight when exceeded",
      "Separate RPM (requests) and TPM (tokens) buckets; on 429, retry with exponentially growing delays plus random jitter, honoring any retry-after header",
      "Rate limits only apply to free tiers; production keys are unlimited",
      "On 429, retry immediately in a tight loop until it succeeds",
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
      "The provider caches your final answers so identical questions are free",
      "The processed stable prefix (system prompt, tool schemas, early history) is reused across calls at a large discount — huge for agents, which resend a mostly-identical prefix every turn",
      "The SDK stores responses on disk to avoid duplicate calls",
      "Caching only works for streaming responses",
    ],
    correct: 1,
    explanation:
      "Caching keys on an exact prefix match, so structure requests stable-first, volatile-last. Multi-turn agent sessions with big system prompts and tool schemas see input costs drop by 70–90%.",
  },
  {
    question:
      "Why should tool descriptions be written as carefully as prompts?",
    options: [
      "They're checked by the API for grammar and rejected if unclear",
      "The model selects tools and generates arguments based solely on names, descriptions, and schemas — a vague description directly causes wrong tool choices and bad arguments",
      "Longer descriptions reduce token costs",
      "Descriptions are only shown to end users, so it's a UX concern",
    ],
    correct: 1,
    explanation:
      "Tool descriptions ARE prompt text. 'weather tool' vs. 'Get current weather for a city. Use whenever the user asks about weather or outdoor conditions. Returns Celsius.' — the second reliably produces correct selection and arguments.",
  },
  {
    question:
      "What happens if you send a tool_result whose tool_use_id doesn't match a tool call from the immediately preceding assistant message?",
    options: [
      "The model silently ignores the extra result",
      "The API rejects the request with a 400 — results must pair exactly with requested calls so the model's causal record stays consistent",
      "The result is queued and applied on the next matching call",
      "The API accepts it but bills double",
    ],
    correct: 1,
    explanation:
      "The strict pairing is validation logic protecting the conversation's causal structure: every result must answer a real request. Unmatched, missing, or duplicated results are malformed history — a 400, not a model behavior.",
  },
  {
    question:
      "Your streaming agent shows nothing for 8 seconds, then dumps the full answer. What's the most likely bug?",
    options: [
      "Temperature is set too high",
      "You're iterating the stream but buffering output (or not flushing), or you set stream=False and print after completion — either way you've discarded streaming's time-to-first-token advantage",
      "The context window is full",
      "max_tokens is set too low",
    ],
    correct: 1,
    explanation:
      "Streaming's entire value is rendering deltas as they arrive (print with flush, or push SSE to your UI). Buffering until the end recreates non-streaming latency with extra code.",
  },
  {
    question:
      "What are adaptive thinking and the effort parameter on current frontier models?",
    options: [
      "Thinking makes responses stream faster; effort sets the number of retries",
      "Adaptive thinking lets the model decide when and how much to reason before answering (emitting billed thinking blocks); effort scales how much total work — reasoning, tool use, output — the model spends on the task",
      "Both are prompt-engineering techniques with no API surface",
      "They control GPU allocation on the provider's side",
    ],
    correct: 1,
    explanation:
      "The control surface moved up a level: instead of shaping token randomness with temperature, you budget the model's work. Thinking blocks are billed output tokens and must be resent verbatim in multi-turn conversations, like any assistant content.",
  },
  {
    question:
      "Your pipeline classifies one million support tickets per day and drafts personalized responses for the ~2% that escalate. What's the cost-sane model strategy?",
    options: [
      "Use the flagship model for everything — quality is all that matters",
      "Use the cheapest model for everything and accept the quality loss on escalations",
      "Route: a small fast model (e.g. Haiku-tier) for the million classifications, a stronger model only for the ~20K escalation drafts — order-of-magnitude savings with no quality loss where it matters",
      "Fine-tune a custom model first; routing is premature optimization",
    ],
    correct: 2,
    explanation:
      "Model routing is the single biggest cost lever — bigger than caching or backoff tuning. Tier price spreads are ~5–25×, and classification at scale is exactly what small models are for. The cascade variant (cheap first, escalate on low confidence) is the follow-up pattern interviewers probe.",
  },
  {
    question:
      "What is the most reliable way to get schema-conforming JSON from a current Anthropic model?",
    options: [
      'Prompt "respond only with valid JSON" and parse the reply',
      "JSON mode, which guarantees the exact schema",
      "Native structured outputs — pass your JSON schema via output_config.format (or use the SDK's parse() helper) so decoding is constrained to the schema; validate client-side for constraints like numeric ranges that constrained decoding can't enforce",
      "Ask for XML instead, which models produce more reliably",
    ],
    correct: 2,
    explanation:
      "Prompting gives no guarantee and JSON mode only guarantees syntax, not shape. Constrained decoding guarantees structure — but not numeric min/max or string lengths, which is why you still validate with Pydantic/Zod and retry with the error fed back. The forced-tool-call trick remains the portable fallback on models without native support.",
  },
  {
    question:
      "Your agent consults the same 300-page PDF manual on every session. What's the right way to send it, and what else do you need for it to be economical?",
    options: [
      "Re-upload it as base64 every call — simplest is best",
      "Upload once via the Files API and reference the file_id in each request, and put the stable prefix behind a prompt-cache breakpoint — the Files API stops re-uploading, caching stops re-processing the tokens at full price",
      "Paste the manual's text into the system prompt once; the server remembers it",
      "Split it into 300 single-page requests to stay under rate limits",
    ],
    correct: 1,
    explanation:
      "Two separate costs: upload bandwidth (solved by file_id references) and input-token processing, which recurs every call regardless (solved by prompt caching at ~0.1× for cache reads). 'The server remembers it' contradicts Lesson 1 — the API is stateless.",
  },
  {
    question:
      "A nightly job classifies 800K documents; results are needed by 8 a.m. What's the right API surface, and what do you gain?",
    options: [
      "The real-time endpoint with maximum parallelism — batching is only for small jobs",
      "The Batch API: submit asynchronously, get 50% off all token costs, results typically within an hour (24h max) — retrieved in arbitrary order and matched by custom_id",
      "The streaming endpoint, since streaming is always cheaper",
      "The Files API, which processes documents server-side overnight",
    ],
    correct: 1,
    explanation:
      "Anything that can wait belongs on the Batch API: half price on every token, stacking with cheap-tier routing and caching. The two operational rules: results are unordered (key by custom_id, never position) and each item carries its own succeeded/errored status.",
  },
  {
    question:
      "While streaming a response, your code calls json.loads() on each tool-argument delta as it arrives, and crashes. What's actually on the wire, and what's the fix?",
    options: [
      "Complete JSON objects per event — the crash must be a network bug",
      "input_json_delta events carrying fragments of a JSON string (e.g. '{\"ci') — accumulate fragments per block index and parse only when content_block_stop arrives (or let the SDK's final-message helper do it)",
      "Base64-encoded arguments that need decoding first",
      "The arguments arrive only after the stream ends, in a separate HTTP response",
    ],
    correct: 1,
    explanation:
      "Streamed tool arguments arrive as partial JSON string fragments — individually unparseable by design. Buffer per block index until the block closes, then parse once. Multiple parallel tool calls interleave as separate indices.",
  },
  {
    question:
      "Inside the agent loop, a tool raises an exception (file not found). What does production-grade code do?",
    options: [
      "Let the exception propagate — the session should fail loudly",
      "Silently drop that tool_use block and answer the others",
      "Catch it and return a tool_result with the error text and is_error: true, so the model can read the failure and adapt — while a max-iteration guard prevents infinite retry loops",
      "Immediately re-call the model without any tool_result so it can try again",
    ],
    correct: 2,
    explanation:
      "A tool failure is information for the model, not an exception for your process. Dropping the block malforms history (400 — every tool_use needs a matching tool_result), and crashing wastes the session. Return the error as content; pair it with loop guards so a stuck model can't retry forever.",
  },
  {
    question:
      "Which set of fields belongs in the per-call structured log line of a production LLM service?",
    options: [
      "Just the total cost per day — anything more is noise",
      "The full prompt and completion text of every call, and nothing else",
      "Request/session ids (yours and the provider's), model, tokens split by cache class (input, output, cache_read, cache_creation), stop_reason, latency + TTFT, retry count, and computed cost",
      "Only error codes — successful calls don't need logging",
    ],
    correct: 2,
    explanation:
      "The split by cache class is the detail that matters: total input tokens alone can't reveal that a deploy broke your cache prefix. With these fields you can alert on derivatives — cache hit-rate drops, refusal spikes, cost-per-session drift — which is how incidents get caught before the invoice does.",
  },
  {
    question:
      "Your traffic is bursty: a flurry of requests every 20 minutes, silence in between. Default 5-minute-TTL caching shows writes but almost no reads. What's the calculus for switching to the 1-hour TTL?",
    options: [
      "Never switch — the 1-hour cache is deprecated",
      "Switch blindly — longer TTL is always cheaper",
      "The 1-hour TTL doubles the write premium (~2× vs ~1.25×), so it needs roughly 3+ reads per write to pay off — worth it exactly when gaps exceed 5 minutes so the short cache keeps expiring before it's read, as here",
      "Instead of caching, resend the prompt twice so the provider learns it",
    ],
    correct: 2,
    explanation:
      "Cache reads cost ~0.1× regardless of TTL; the TTL choice is about the write premium. Steady traffic keeps the 5-minute cache warm for free (reads refresh it), so the long TTL only wins when idle gaps outlast the short TTL — the bursty pattern described. Break-even: 5m TTL pays off on the 2nd request, 1h TTL needs about three.",
  },
];
