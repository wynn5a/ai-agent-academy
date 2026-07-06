import type { Lesson } from "@/lib/types";

export const lesson05: Lesson = {
  slug: "errors-and-resilience",
  title: "Errors, Rate Limits & Cost Control",
  minutes: 45,
  summary:
    "An agent lives or dies on the unhappy path. Rate limits, timeouts, overloaded servers, refusals, context overflows — production behavior is defined by how you handle these.",
  sections: [
    {
      type: "heading",
      text: "The failure taxonomy",
    },
    {
      type: "table",
      headers: ["Error", "Meaning", "Correct response"],
      rows: [
        [
          "`429 rate_limit`",
          "Too many requests/tokens per minute (RPM and TPM are separate buckets)",
          "Exponential backoff **with jitter**; honor `retry-after` header if present",
        ],
        [
          "`529 / 503 overloaded`",
          "Provider-side congestion",
          "Same backoff; consider a fallback model",
        ],
        [
          "`400 invalid_request`",
          "Your bug: malformed messages, bad tool pairing, context overflow",
          "**Don't retry** — fix the request. Retrying a 400 is an infinite loop.",
        ],
        ["`401 / 403`", "Auth problem", "Don't retry; alert loudly"],
        [
          "Timeout / connection error",
          "Network or a very long generation",
          "Retry with backoff; set explicit client timeouts",
        ],
        [
          '`stop_reason: "refusal"`',
          "HTTP **200**, but the model (or a safety layer) declined; `content` may be empty and `stop_details` carries a category",
          "Check `stop_reason` before reading `content[0]`; surface to the user or route to a fallback model — don't loop blindly",
        ],
        [
          "`model_context_window_exceeded`",
          "The conversation no longer fits the context window (distinct from `max_tokens`, your output cap)",
          "Not retryable as-is — truncate or summarize history (Module 4) and resend",
        ],
      ],
    },
    {
      type: "code",
      language: "python",
      title: "backoff with jitter — the canonical implementation",
      code: `import random, time
import anthropic

RETRYABLE = (anthropic.RateLimitError, anthropic.OverloadedError,
             anthropic.InternalServerError, anthropic.APIConnectionError,
             anthropic.APITimeoutError)

def call_with_retries(fn, max_retries: int = 3, base: float = 1.0):
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except (anthropic.BadRequestError, anthropic.AuthenticationError,
                 anthropic.PermissionDeniedError):
            raise                       # 400/401/403 = your bug or creds. Never retry.
        except RETRYABLE as e:
            if attempt == max_retries:
                raise
            # exponential: 1s, 2s, 4s… + full jitter to avoid thundering herd
            delay = base * (2 ** attempt) * (0.5 + random.random())
            print(f"retryable error ({type(e).__name__}), "
                  f"sleeping {delay:.1f}s (attempt {attempt + 1})")
            time.sleep(delay)`,
      explanation:
        "Jitter matters: if 50 workers all fail at once and all retry after exactly 2 seconds, you've synchronized a second stampede. Randomizing the delay decorrelates them. The official SDKs have built-in retries — but agents need their own layer with logging, budgets, and per-tool policies.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `import random, time
import openai

RETRYABLE = (openai.RateLimitError, openai.InternalServerError,
             openai.APIConnectionError, openai.APITimeoutError)

def call_with_retries(fn, max_retries: int = 3, base: float = 1.0):
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except (openai.BadRequestError, openai.AuthenticationError,
                 openai.PermissionDeniedError):
            raise                       # 400/401/403 = your bug or creds. Never retry.
        except RETRYABLE as e:
            if attempt == max_retries:
                raise
            # exponential: 1s, 2s, 4s… + full jitter to avoid thundering herd
            delay = base * (2 ** attempt) * (0.5 + random.random())
            print(f"retryable error ({type(e).__name__}), "
                  f"sleeping {delay:.1f}s (attempt {attempt + 1})")
            time.sleep(delay)`,
          explanation:
            "The OpenAI SDK exposes the same typed hierarchy (`RateLimitError`, `APIStatusError` with `.status_code`, `APIConnectionError`) and also auto-retries transient errors — your layer exists for the logging, budgets, and policy the SDK can't know about.",
        },
      ],
    },
    {
      type: "heading",
      text: "Prompt caching — the agent cost lever",
    },
    {
      type: "paragraph",
      text: "Agents resend a large, mostly-identical prefix every turn: system prompt, tool schemas, early conversation. **Prompt caching** lets the provider reuse the processed prefix — cached input tokens cost a fraction of fresh ones (Anthropic: cache reads are ~90% cheaper; writes cost a small premium) and process faster. For a 20-turn agent session whose prefix dominates, caching routinely cuts input cost by 70–90%. Two mechanics worth memorizing: caching keys on an exact prefix match, and there's a **minimum cacheable prefix** (roughly 1K–4K tokens depending on model) — short prompts silently don't cache at all, with no error.",
    },
    {
      type: "code",
      language: "python",
      title: "cache breakpoint after the stable prefix (Anthropic)",
      code: `resp = client.messages.create(
    model="claude-sonnet-5", max_tokens=1024,
    system=[{
        "type": "text",
        "text": LONG_SYSTEM_PROMPT,          # stable across turns
        "cache_control": {"type": "ephemeral"},   # <- cache up to here
    }],
    tools=TOOLS,                             # stable too — order matters
    messages=messages,
)
print(resp.usage.cache_read_input_tokens,    # cheap
      resp.usage.cache_creation_input_tokens)  # small premium, first call`,
      explanation:
        "Caching keys on an **exact prefix match** — reorder your tools or edit one system-prompt character and the cache misses. Structure requests as: stable stuff first (system, tools), volatile stuff last (messages). OpenAI applies prefix caching automatically on long prompts.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `# OpenAI has no cache_control — prefix caching is automatic on long prompts.
# Your job is the same discipline anyway: stable prefix first, volatile last.
resp = client.responses.create(
    model="gpt-5.5",
    instructions=LONG_SYSTEM_PROMPT,     # stable across turns
    tools=TOOLS,                         # stable too — order matters
    input=input_items,                   # volatile — goes last
)
print(resp.usage.input_tokens_details.cached_tokens)  # served from cache`,
          explanation:
            "OpenAI applies prefix caching automatically with no breakpoints to place — verify it's actually working via `usage.input_tokens_details.cached_tokens`, the counterpart of Anthropic's `cache_read_input_tokens`.",
        },
      ],
    },
    {
      type: "paragraph",
      text: "The economics have three numbers worth knowing cold. **Reads cost ~0.1×** base input. **Writes cost a premium**: ~1.25× for the default 5-minute TTL, ~2× for the optional 1-hour TTL. So the 5-minute cache breaks even on the **second** request (1.25 + 0.1 < 2×), while the 1-hour cache needs about three (2 + 0.1 + 0.1 < 3×) — reach for the long TTL only when traffic is bursty with gaps longer than 5 minutes; steady traffic keeps the short cache warm for free, because every read refreshes it. Two more mechanics: you get at most **4 cache breakpoints** per request, and invalidation is tiered — editing a *message* leaves the tools+system cache intact, but changing the **tool list or the model** invalidates everything, because tools render at position zero.",
    },
    {
      type: "callout",
      kind: "warning",
      title: "Cost discipline from day one",
      text: "Every serious agent tracks: tokens in/out per call, cumulative per session, and estimated dollars (pull current per-MTok prices from your provider's pricing page — they change; don't hardcode from memory). Set a **hard budget per session** and stop the loop when it's exceeded. A bug that loops tool calls at 3 a.m. should exhaust a $2 budget, not your credit card.",
    },
    {
      type: "heading",
      text: "Choosing the model: the biggest cost lever of all",
    },
    {
      type: "paragraph",
      text: "Backoff and caching shave percentages; **model choice changes cost by an order of magnitude**. Providers ship tiers with roughly 5–25× price spreads between the smallest and largest, and most production systems route: a cheap fast model for classification, routing, and extraction; a mid-tier workhorse for the agent loop; the flagship only for planning and the hardest reasoning.",
    },
    {
      type: "table",
      headers: [
        "Tier",
        "Anthropic (mid-2026)",
        "Rough $/MTok in / out",
        "Reach for it when",
      ],
      rows: [
        [
          "Small & fast",
          "`claude-haiku-4-5`",
          "~$1 / $5",
          "Classification, routing, extraction at scale, guardrail checks",
        ],
        [
          "Workhorse",
          "`claude-sonnet-5`",
          "~$3 / $15",
          "The default for agents and tool loops — near-flagship quality at a fraction of the price",
        ],
        [
          "Flagship",
          "`claude-opus-4-8`",
          "~$5 / $25",
          "Planning, hard multi-step reasoning, long-horizon autonomous work",
        ],
      ],
    },
    {
      type: "paragraph",
      text: "Every provider has an equivalent ladder (OpenAI's mini/full split around `gpt-5.5`, etc.), and prices change — **pull current numbers from the pricing page, never from memory or a course**. Two routing patterns to know: **static routing** (each pipeline stage is assigned a tier at design time) and the **cascade** (try the cheap model, escalate to the expensive one only when confidence is low or validation fails). Both show up constantly in system-design interviews.",
    },
    {
      type: "heading",
      text: "The Batch API: 50% off anything that can wait",
    },
    {
      type: "paragraph",
      text: "The third cost lever, and the one most candidates forget exists: if a workload doesn't need an answer *now*, don't send it through the real-time endpoint at all. The **Batch API** takes up to ~100K requests in one submission, processes them asynchronously (most batches finish within an hour; 24 hours is the ceiling), and charges **50% of standard price on all tokens** — stacking with prompt caching and cheap-tier routing. Nightly classification runs, backfills, eval suites, document-extraction pipelines: all batch-shaped.",
    },
    {
      type: "code",
      language: "python",
      title: "batch: create → poll → collect by custom_id",
      code: `batch = client.messages.batches.create(requests=[
    {"custom_id": f"ticket-{t.id}",
     "params": {"model": "claude-haiku-4-5", "max_tokens": 256,
                "messages": [{"role": "user",
                              "content": f"Classify: {t.text}"}]}}
    for t in tickets
])

while True:
    b = client.messages.batches.retrieve(batch.id)
    if b.processing_status == "ended":
        break
    time.sleep(60)

results = {}
for r in client.messages.batches.results(batch.id):
    if r.result.type == "succeeded":
        results[r.custom_id] = r.result.message
    else:
        log_failure(r.custom_id, r.result)   # errored | canceled | expired`,
      explanation:
        "Two rules that show up as bugs: **results arrive in arbitrary order** — always key by `custom_id`, never by position — and each result has its own success/failure status, so per-item error handling still applies. The senior framing: split every workload into a latency-sensitive path (real-time, streaming, caching) and a throughput path (batch, cheap tier) — most systems that blow their budget are running batch-shaped work through the real-time lane.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `import json

# OpenAI batching is file-shaped: one JSONL line per request
lines = [json.dumps({
    "custom_id": f"ticket-{t.id}",
    "method": "POST", "url": "/v1/responses",
    "body": {"model": "gpt-5.4-mini", "max_output_tokens": 256,
             "input": [{"role": "user", "content": f"Classify: {t.text}"}]},
}) for t in tickets]

batch_file = client.files.create(
    file=("tickets.jsonl", "\\n".join(lines).encode()), purpose="batch")
batch = client.batches.create(input_file_id=batch_file.id,
                              endpoint="/v1/responses",
                              completion_window="24h")

while True:
    b = client.batches.retrieve(batch.id)
    if b.status == "completed":
        break
    time.sleep(60)

results = {}
for line in client.files.content(b.output_file_id).text.splitlines():
    r = json.loads(line)
    results[r["custom_id"]] = r["response"]   # failures land in error_file_id`,
          explanation:
            "OpenAI's Batch API is file-based — upload a JSONL of requests, poll the batch, download an output file — but the economics (50% off, ≤24h window) and the key-by-`custom_id` rule are identical.",
        },
      ],
    },
    {
      type: "heading",
      text: "Observability: the log line that answers every incident",
    },
    {
      type: "paragraph",
      text: "When the bill spikes or quality drops, the difference between a 10-minute diagnosis and a lost week is whether you logged the right fields **per API call** from day one. The canonical structured log line for an LLM call:",
    },
    {
      type: "list",
      items: [
        "**Identity**: your request/session/user ids, plus the provider's request id (from the response headers — it's what support asks for).",
        "**What ran**: model, prompt/template version, tool names requested.",
        "**Tokens by class**: `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` — the split matters; total input alone can't tell you the cache stopped working.",
        "**Outcome**: `stop_reason`, error type if any, retry count.",
        "**Latency**: total and time-to-first-token.",
        "**Money**: computed cost from a rates table you can update.",
      ],
    },
    {
      type: "paragraph",
      text: "Then aggregate and **alert on the derivatives**: cache hit-rate dropping (a deploy broke the prefix), refusal or `max_tokens` rates spiking (prompt or cap regression), cost-per-session drifting up (history bloat), p95 iterations-per-turn climbing (the model is struggling with a tool). One more production discipline while you're here: **retries plus side effects require idempotency**. A timeout doesn't tell you whether the provider processed the request; and your tool executor's retries can re-run a `charge_customer` call. Idempotency keys on every side-effectful downstream call — derived from the `tool_use_id` — make retries safe.",
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "This retry wrapper 'handles everything.' It ran all night and burned $40 without a single successful call. What's the bug?",
      code: `def call_with_retries(fn, max_retries=8):
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except anthropic.APIError:
            time.sleep(2 ** attempt)
    raise RuntimeError("gave up")`,
      answer:
        "It retries **every** `APIError` — including `BadRequestError` (400). A malformed request (bad tool pairing, context overflow) fails identically all 9 attempts, every loop iteration, forever: pure wasted spend that also hides the real bug. Retry only transient classes (429, 5xx/529, timeouts, connection errors), re-raise 400/401/403 immediately, and add jitter so parallel workers don't stampede in sync.",
    },
    {
      type: "exercise",
      kind: "predict",
      prompt:
        'An agent sends a 5,000-token system prompt with `cache_control` on it, but the prompt template starts with `f"Current time: {datetime.now()}. You are..."`. What do `cache_read_input_tokens` show across turns, and what\'s the fix?',
      answer:
        "**Zero reads, every turn.** Caching is an exact prefix match — the timestamp changes every request, so the prefix never matches and you pay the cache-*write* premium repeatedly while reading nothing. Fix: keep the system prompt byte-stable and inject volatile context (time, user state) later in the message list, after the cache breakpoint. Structure requests stable-first, volatile-last.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Your agent\'s API bill is 10× budget. Walk me through the audit" — the full senior version, with the checks in order and what each one finds.',
      answer:
        "(1) **Get visibility**: per-call usage logs split by cache class; if they don't exist, add them first — everything else is guessing. (2) **Find the anomaly shape**: cost per *session* vs cost per *call* vs call *count* — each points somewhere different (history bloat vs payload bug vs a retry/loop storm). (3) **Check the classics**: a document or image accidentally resent every turn; `cache_read_input_tokens: 0` because a timestamp landed in the system prompt; a retry wrapper hammering 400s; an agent loop without an iteration cap. (4) **Apply levers biggest-first**: route stages to cheaper tiers (order-of-magnitude), move async work to the Batch API (2×), fix caching (up to ~10× on input), trim/summarize history, then hard per-session budgets so it can't recur silently. Name the expected magnitude of each lever — that's what distinguishes an audit from a list. **Follow-up probe:** \"cost is fine but p95 latency doubled — same audit?\" → same logs, different fields: TTFT vs total, iterations per turn, cache hit rate.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** Design the retry policy for a production agent product — not just the backoff loop, the whole policy.",
      answer:
        'Start by **classifying**: retryable (429, 500/529, timeouts, connection errors — with exponential backoff + full jitter, honoring `retry-after`) vs never-retry (400/401/403 — fail fast, alert) vs not-an-error-but-not-retryable (`refusal`, `model_context_window_exceeded` — handle semantically). Then the policy layer: a **retry budget** per request (3–4 attempts) *and* per session (so a bad hour doesn\'t 10× costs), **circuit breaker** when provider error rate crosses a threshold (stop hammering, fail fast, page someone), **fallback model/provider** for sustained 529s, and **idempotency keys** anywhere a retry could double a side effect. Distinguish the three retry layers explicitly: HTTP-level (SDK), tool-executor-level, and semantic-level (feed a validation error back to the model) — one incident review where all three retried the same failure is how you learn this. **Follow-up probe:** "why jitter?" → 50 workers backing off in sync just schedule a second stampede; randomization decorrelates them.',
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** One million support tickets arrive as a nightly dump; ~2% escalate and need a drafted reply by morning. Architect the pipeline and estimate the cost order-of-magnitude.",
      answer:
        'Two stages, both async, so **everything goes through the Batch API at 50% off**. Stage 1: classify 1M tickets on the small tier (say ~500 tokens in / 50 out each → ~500M input tokens; at ~$1/MTok in, ~$5/MTok out, halved by batch ≈ **$250 + $125 ≈ $400/night**). Stage 2: draft replies for the ~20K escalations on the workhorse tier (~2K in / 500 out each → 40M in / 10M out; at $3/$15 halved ≈ **$60 + $75 ≈ $135**). Total ≈ $500–600/night — and say out loud that classification dominates, so any prompt token you shave there is worth 1M× nightly. Add: structured outputs with an enum for the classifier, validation + a small retry pass for failures, `custom_id` keyed to ticket ids, a completion check before the morning SLA with a real-time fallback lane for stragglers. **Follow-up probe:** "the dump becomes a stream — what changes?" → real-time endpoint for classification (still cheap tier), caching the classifier prompt prefix, and the cascade pattern for borderline cases.',
    },
    {
      type: "callout",
      kind: "insight",
      title: "Interview angle",
      text: "Cost questions separate seniors from juniors, and the levers have magnitudes worth citing: model routing (~5–25×), Batch API (2× on anything async), prompt caching (up to ~10× on input), history management, then budget caps as the backstop. Being able to *rank* them — and knowing which applies to which workload shape — is the bar.",
    },
    {
      type: "keypoints",
      points: [
        "Retry 429/5xx/timeouts with exponential backoff + jitter; **never** retry 400s.",
        "RPM and TPM are separate rate-limit buckets — big prompts can throttle you at low request rates.",
        "Prompt caching: stable prefix first, cache breakpoint after it — reads ~0.1×, writes ~1.25× (5m TTL) or ~2× (1h TTL); breaks even by request two.",
        "Batch API: 50% off all tokens for anything async (≤24h turnaround); results are unordered — key by custom_id.",
        "Log per call: ids, model, tokens by cache class, stop_reason, latency/TTFT, cost — then alert on the derivatives (cache hit rate, refusal rate, cost per session).",
        "Retries + side effects need idempotency keys — a timeout doesn't tell you the request wasn't processed.",
        "Detect refusals and truncation via `stop_reason` — silent failures poison everything downstream.",
        "Cost levers ranked: model routing (~5–25×) > Batch API (2×) > caching (~10× input) > history trimming > hard budget caps as backstop.",
      ],
    },
  ],
};
