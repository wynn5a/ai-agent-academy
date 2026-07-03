import type { Lesson } from "@/lib/types";

export const lesson05: Lesson = {
  slug: "errors-and-resilience",
  title: "Errors, Rate Limits & Cost Control",
  minutes: 30,
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

RETRYABLE = (anthropic.RateLimitError, anthropic.APIStatusError,
             anthropic.APIConnectionError, anthropic.APITimeoutError)

def call_with_retries(fn, max_retries: int = 3, base: float = 1.0):
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except anthropic.BadRequestError:
            raise                       # 400 = your bug. Never retry.
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
      type: "callout",
      kind: "insight",
      title: "Interview angle",
      text: "Cost questions separate seniors from juniors: \"your agent's API bill is 10× budget — walk me through the audit.\" Order of attack: log `usage` per call (you can't fix what you can't see) → check for accidental payload resends → prompt caching on the stable prefix → route stages to cheaper tiers → cap sessions with hard budgets. Model routing is usually the biggest single win.",
    },
    {
      type: "keypoints",
      points: [
        "Retry 429/5xx/timeouts with exponential backoff + jitter; **never** retry 400s.",
        "RPM and TPM are separate rate-limit buckets — big prompts can throttle you at low request rates.",
        "Prompt caching: stable prefix first, cache breakpoint after it — up to ~90% cheaper input.",
        "Log usage on every call; enforce a per-session dollar budget in the loop itself.",
        "Detect refusals and truncation via `stop_reason` — silent failures poison everything downstream.",
        "Model routing (cheap tier for routine stages, flagship only where it matters) is the biggest cost lever — bigger than caching.",
      ],
    },
  ],
};
