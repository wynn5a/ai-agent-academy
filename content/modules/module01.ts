import type { Module } from "@/lib/types";

export const module01: Module = {
  id: 1,
  slug: "llm-api-mastery",
  title: "LLM API Mastery",
  weeks: "Weeks 1–2",
  phase: 1,
  phaseTitle: "Foundations from raw APIs",
  description:
    "No frameworks. Raw HTTP/SDK calls only. Everything an agent does reduces to these mechanics: the message array, tool calling, structured outputs, streaming, tokens, and robust error handling.",
  outcomes: [
    "Explain and implement the chat message format (system/user/assistant/tool roles) from memory",
    "Implement tool calling end-to-end: schema → model emits call → you execute → return result → model continues",
    "Produce validated structured outputs with JSON schema and recover from malformed JSON",
    "Stream responses token-by-token and explain why streaming matters for agent UX",
    "Count tokens, estimate cost per call, and reason about context-window budgets",
    "Handle rate limits, timeouts, and refusals with exponential backoff and graceful degradation",
  ],
  lessons: [
    {
      slug: "messages-are-the-only-state",
      title: "Messages Are the Only State",
      minutes: 30,
      summary:
        "The single most important fact in agent engineering: the model is stateless. A 'conversation' is you resending an ever-growing array. Every agent pattern you'll ever build follows from this.",
      sections: [
        {
          type: "paragraph",
          text: "When you chat with Claude or ChatGPT, it feels like the model remembers you. It doesn't. **Every single API call is a blank slate.** The provider's server receives your request, runs the model over the tokens you sent, returns a completion, and forgets you existed. What creates the illusion of memory is that *your* code resends the entire conversation history on every call.",
        },
        {
          type: "code",
          language: "python",
          title: "the entire illusion of conversation",
          code: `import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY

messages = []  # <- this list IS the conversation. You own it.

def chat(user_text: str) -> str:
    messages.append({"role": "user", "content": user_text})
    response = client.messages.create(
        model="claude-sonnet-5",
        max_tokens=1024,
        system="You are a concise engineering assistant.",
        messages=messages,        # full history, every single time
    )
    reply = response.content[0].text
    messages.append({"role": "assistant", "content": reply})
    return reply

print(chat("My name is Wenming."))
print(chat("What's my name?"))   # works ONLY because we resent turn 1`,
          explanation:
            "Comment out the second `messages.append` and the model instantly 'forgets' — because memory never lived on the server. The `system` prompt rides along outside the array in Anthropic's API; in OpenAI's it's the first message with `role: \"system\"` (or `\"developer\"` in newer APIs).",
        },
        {
          type: "heading",
          text: "It's just JSON over POST",
        },
        {
          type: "paragraph",
          text: "The SDK is a thin convenience wrapper. Strip it away and every call in this course is one HTTPS POST with an auth header and a JSON body. Seeing it raw once makes everything else less magical — and it's what you'd write from a language with no official SDK.",
        },
        {
          type: "code",
          language: "bash",
          title: "the same call, no SDK",
          code: `curl https://api.anthropic.com/v1/messages \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "claude-sonnet-5",
    "max_tokens": 1024,
    "system": "You are a concise engineering assistant.",
    "messages": [{"role": "user", "content": "My name is Wenming."}]
  }'`,
          explanation:
            "The response is JSON too: a list of content blocks, a `stop_reason`, and a `usage` object with token counts. Everything the SDK gives you — retries, types, streaming helpers — is built on this one endpoint.",
        },
        {
          type: "exercise",
          kind: "predict",
          prompt:
            "In the Python example above, comment out the second `messages.append` (the one that stores the assistant's reply). What does `chat(\"What's my name?\")` return now, and why?",
          answer:
            "The model won't know the name. Without appending the assistant turn, the second call sends `[user: \"My name is Wenming.\", user: \"What's my name?\"]` — the model never sees its own earlier reply, and more importantly your history is now missing a turn. Memory lives entirely in the list *you* maintain; the server contributes nothing.",
        },
        {
          type: "heading",
          text: "The roles",
        },
        {
          type: "table",
          headers: ["Role", "Who writes it", "What it's for"],
          rows: [
            [
              "`system`",
              "You (the developer)",
              "Standing instructions: persona, rules, tool guidance. Highest-priority steering.",
            ],
            [
              "`user`",
              "The human (or your code)",
              "The task, questions, tool results in OpenAI's flow.",
            ],
            [
              "`assistant`",
              "The model",
              "Text replies **and** tool-call requests. You resend these verbatim.",
            ],
            [
              "`tool` / `tool_result`",
              "You, after executing",
              'The output of a tool the model asked you to run. OpenAI: `role: "tool"`; Anthropic: a `tool_result` block inside a `user` message.',
            ],
          ],
        },
        {
          type: "callout",
          kind: "insight",
          text: "Because the model is stateless, **an 'agent' is just a program that keeps editing a message array in a loop**. Adding memory, compacting context, injecting retrieved documents, resuming a crashed session — all of it is list manipulation. Master the array and the rest of this curriculum is variations on a theme.",
        },
        {
          type: "heading",
          text: "Tokens: the currency of everything",
        },
        {
          type: "paragraph",
          text: "Models don't see characters — they see **tokens**, subword chunks (roughly 3–4 English characters, ~¾ of a word each). Every model has a **context window**: the maximum tokens of input + output it can handle in one call (hundreds of thousands of tokens on frontier models — check your model's docs, these numbers change). You pay per token, input and output priced separately, and output tokens typically cost several times more.",
        },
        {
          type: "animation",
          name: "context-window",
          caption:
            "A growing conversation eats the context window; compaction reclaims budget by summarizing old turns.",
        },
        {
          type: "paragraph",
          text: "Here's the trap that surprises everyone: because you resend history every turn, **cost grows quadratically with conversation length**. Turn 10 doesn't cost one turn's tokens — it re-processes turns 1–9 as input, plus its own. A 10-turn conversation averaging 500 tokens per turn means turn 10's call alone sends ~4,500 input tokens, and the whole session has processed ~25,000 cumulative input tokens.",
        },
        {
          type: "code",
          language: "python",
          title: "count before you send",
          code: `# Anthropic: exact count via the API (free, no generation)
count = client.messages.count_tokens(
    model="claude-sonnet-5",
    system="You are a concise engineering assistant.",
    messages=messages,
)
print(count.input_tokens)

# OpenAI: tiktoken locally (approximate — encodings lag the newest models)
import tiktoken
enc = tiktoken.get_encoding("o200k_base")
n = len(enc.encode("How many tokens is this sentence?"))

# Every response also reports usage — log it on EVERY call:
resp = client.messages.create(model="claude-sonnet-5",
                              max_tokens=256, messages=messages)
print(resp.usage.input_tokens, resp.usage.output_tokens)`,
          explanation:
            "Production agents log `usage` on every call and aggregate per session/user/day. You cannot manage what you don't measure — cost bugs (like accidentally resending a huge document every turn) hide in unlogged usage.",
        },
        {
          type: "exercise",
          kind: "predict",
          prompt:
            "A 20-turn conversation averages 400 tokens per turn. Roughly how many input tokens does the API call at turn 20 send, and roughly how many cumulative input tokens has the whole session processed?",
          answer:
            "Turn 20 resends turns 1–19 (~7,600 tokens) plus the new turn (~400) ≈ **8,000 input tokens** for that single call. Cumulatively the session has processed ~400 × (1+2+…+20) = 400 × 210 = **~84,000 input tokens** — that triangular sum is why cost grows quadratically with conversation length, and why prompt caching (Lesson 5) matters so much for agents.",
        },
        {
          type: "callout",
          kind: "insight",
          title: "Interview angle",
          text: "\"Why do you resend the whole conversation every turn, and what does that cost?\" is a classic screener. Strong answer: the model is stateless; the messages array is the only context; therefore input cost grows quadratically with turns, and the mitigations are prompt caching, truncation, and summarization. Being able to do the token math above out loud is exactly the bar.",
        },
        {
          type: "keypoints",
          points: [
            "The model is **stateless**; conversation = resending the array. Your code owns all state.",
            "Roles: `system` (rules), `user` (task + tool results), `assistant` (replies + tool calls).",
            "Cost grows **quadratically** with turns because history is re-sent as input every call.",
            "Log `usage` from every response; count tokens before sending big payloads.",
            "When history exceeds the window: truncate oldest turns, or summarize them (Module 4 goes deep).",
          ],
        },
      ],
    },
    {
      slug: "sampling-and-streaming",
      title: "Sampling Parameters & Streaming",
      minutes: 20,
      summary:
        "Temperature and top_p control the randomness of token selection — get them wrong and your agent is either erratic or uselessly rigid. Streaming turns dead air into perceived speed.",
      sections: [
        {
          type: "paragraph",
          text: "At each step of generation, the model produces a probability distribution over its entire vocabulary for the next token. **Sampling parameters shape how a token gets picked from that distribution.**",
        },
        {
          type: "animation",
          name: "temperature",
          caption:
            "Low temperature sharpens the distribution toward the top token; high temperature flattens it, letting unlikely tokens through.",
        },
        {
          type: "list",
          items: [
            "**temperature** (0–1 Anthropic, 0–2 OpenAI): scales the logits before softmax. Near 0 → almost always the top token (near-deterministic, but not perfectly — GPU nondeterminism and ties remain). High → more diverse, more creative, more wrong.",
            "**top_p (nucleus sampling)**: sample only from the smallest set of tokens whose cumulative probability ≥ p. `top_p=0.9` ignores the long tail entirely.",
            "**Adjust one, not both.** They interact multiplicatively and become impossible to reason about together. Pick temperature as your primary dial.",
            "**max_tokens** is a hard output cap, not a target — the model doesn't know it exists. Set it as a safety rail against runaway generation and check `stop_reason` for `max_tokens` to detect truncation.",
          ],
        },
        {
          type: "callout",
          kind: "tip",
          title: "Settings for agents",
          text: "Tool-calling agents want **temperature 0–0.3**. You're asking for precise JSON and correct function arguments, not prose flair — determinism aids debugging and eval stability too. Reserve higher temperatures for brainstorming/creative subtasks, and set it per-call, not globally.",
        },
        {
          type: "heading",
          text: "Streaming",
        },
        {
          type: "paragraph",
          text: "Without streaming you wait for the full completion before showing anything — for a long answer that's many seconds of dead air. With `stream=True` the API returns **server-sent events (SSE)**, delivering tokens as they're generated. Time-to-first-token becomes your perceived latency, which is often 10× better than time-to-full-response.",
        },
        {
          type: "animation",
          name: "token-stream",
          caption:
            "SSE delivers deltas as the model generates; the client renders incrementally.",
        },
        {
          type: "code",
          language: "python",
          title: "streaming with both SDKs",
          code: `# Anthropic
with client.messages.stream(
    model="claude-sonnet-5", max_tokens=1024,
    messages=[{"role": "user", "content": "Explain SSE in one paragraph."}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
final = stream.get_final_message()          # full message + usage

# OpenAI
resp = openai_client.chat.completions.create(
    model="gpt-4o", stream=True,
    messages=[{"role": "user", "content": "Explain SSE in one paragraph."}],
)
for chunk in resp:
    delta = chunk.choices[0].delta.content
    if delta:
        print(delta, end="", flush=True)`,
          explanation:
            "Streaming complicates tool calling slightly: tool-call arguments arrive as partial JSON fragments you must accumulate until the block completes. The SDKs' helper events (`content_block_stop`, accumulated snapshots) handle this — use them rather than parsing fragments yourself.",
        },
        {
          type: "keypoints",
          points: [
            "Sampling picks from a probability distribution; temperature scales it, top_p truncates it. Tune one.",
            "Agents doing tool calls: temperature 0–0.3.",
            "`max_tokens` is a guardrail; detect truncation via `stop_reason`.",
            "Streaming = SSE deltas; time-to-first-token is the UX metric that matters.",
            "Always capture the final usage/message object after a stream completes.",
          ],
        },
      ],
    },
    {
      slug: "tool-calling",
      title: "Tool Calling End-to-End",
      minutes: 30,
      summary:
        "The mechanism that turns a text generator into something that can act. Crucial mental model: the model never executes anything — it emits structured JSON, and your code does the work.",
      sections: [
        {
          type: "callout",
          kind: "insight",
          text: "**Tool calling is just structured output plus a convention.** The model generates JSON that matches a schema you provided; you run the corresponding function; you append the result to the messages; the model continues. The model has no network access, no filesystem, no side effects — *you* are its hands.",
        },
        {
          type: "animation",
          name: "tool-calling",
          caption:
            "One complete tool-use round trip: schemas in, tool_use out, tool_result in, final answer out.",
        },
        {
          type: "heading",
          text: "The four-step dance",
        },
        {
          type: "list",
          ordered: true,
          items: [
            "**You send** messages plus `tools`: each tool has a `name`, `description`, and a JSON-schema `input_schema` for its parameters.",
            '**Model decides** it needs a tool: the response contains a `tool_use` block (Anthropic) / `tool_calls` array (OpenAI) with the tool name, generated arguments, and a unique `id`. `stop_reason` is `"tool_use"`.',
            "**You execute** the actual function with those arguments, then append (a) the assistant message verbatim, and (b) a `tool_result` referencing the same `id`, with the output as a string.",
            '**Model continues** — it may answer, or request another tool. Loop until `stop_reason` is `"end_turn"`.',
          ],
        },
        {
          type: "code",
          language: "python",
          title: "complete working tool loop (Anthropic, raw SDK)",
          code: `import json
import anthropic

client = anthropic.Anthropic()

TOOLS = [{
    "name": "get_weather",
    "description": (
        "Get current weather for a city. Use whenever the user asks about "
        "weather, temperature, or outdoor conditions. Returns Celsius."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "city": {"type": "string", "description": "City name, e.g. 'Tokyo'"},
        },
        "required": ["city"],
    },
}]

def get_weather(city: str) -> str:
    return json.dumps({"city": city, "temp_c": 21, "sky": "clear"})  # stub

messages = [{"role": "user", "content": "Should I bike to work in Tokyo today?"}]

while True:
    resp = client.messages.create(
        model="claude-sonnet-5", max_tokens=1024,
        tools=TOOLS, messages=messages,
    )
    if resp.stop_reason != "tool_use":
        print(resp.content[0].text)
        break

    # 1) append the assistant turn EXACTLY as returned
    messages.append({"role": "assistant", "content": resp.content})

    # 2) run every requested tool, append results
    results = []
    for block in resp.content:
        if block.type == "tool_use":
            output = get_weather(**block.input)      # your code acts
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,             # must match!
                "content": output,
            })
    messages.append({"role": "user", "content": results})`,
          explanation:
            "Two invariants trip everyone up: the assistant message containing `tool_use` must be resent **verbatim**, and every `tool_result` must reference a real `tool_use_id` from the immediately preceding assistant turn. Return a result for a tool that was never called (or drop one that was) and the API rejects the request with a 400 — the strict pairing is how the model keeps causality straight.",
        },
        {
          type: "heading",
          text: "OpenAI's shape, for comparison",
        },
        {
          type: "code",
          language: "python",
          title: "same dance, different field names",
          code: `resp = openai_client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    tools=[{
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather for a city.",
            "parameters": {          # 'parameters', not 'input_schema'
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        },
    }],
)
msg = resp.choices[0].message
if msg.tool_calls:
    messages.append(msg)             # assistant turn, verbatim
    for tc in msg.tool_calls:
        args = json.loads(tc.function.arguments)   # arrives as a STRING
        messages.append({
            "role": "tool",                        # dedicated role
            "tool_call_id": tc.id,
            "content": get_weather(**args),
        })`,
          explanation:
            "Key differences: OpenAI nests schemas under `function.parameters`, arguments arrive as a **JSON string** you must parse (and which can be malformed — validate!), and results use a dedicated `tool` role rather than a block inside a user message. The concepts are identical; only the plumbing differs.",
        },
        {
          type: "callout",
          kind: "warning",
          title: "Tool descriptions are prompts",
          text: 'The model chooses tools by reading their names and descriptions — nothing else. A bad description (`"weather tool"`) yields wrong tool choices and garbage arguments. A good one says what the tool does, **when to use it**, what it returns, and its units/limits. Anthropic\'s own guidance: extremely detailed descriptions are the single highest-leverage factor in tool-use quality.',
        },
        {
          type: "keypoints",
          points: [
            "The model **requests**; your code **executes**. All side effects are yours.",
            'Loop on `stop_reason == "tool_use"`; resend assistant turns verbatim; match `tool_use_id` exactly.',
            "Multiple tool calls can arrive in one turn — answer all of them.",
            "Tool errors go back as `tool_result` content (with `is_error: true` on Anthropic) so the model can recover.",
            "Invest in tool descriptions like you invest in prompts — they are prompts.",
          ],
        },
      ],
    },
    {
      slug: "structured-outputs",
      title: "Structured Outputs & JSON Schema",
      minutes: 20,
      summary:
        "When you need data, not prose: forcing model output to conform to a schema, and what to do when it doesn't.",
      sections: [
        {
          type: "paragraph",
          text: "Half of real-world LLM use isn't chat — it's **extraction and classification**: pull fields from an email, route a ticket, score a document. Downstream code needs types, not vibes. There are three levels of rigor for getting JSON out of a model.",
        },
        {
          type: "table",
          headers: ["Approach", "How", "Guarantee"],
          rows: [
            [
              "Prompt & pray",
              '"Respond only with JSON…"',
              "None. Fine for prototypes only.",
            ],
            [
              "JSON mode",
              '`response_format: {type: "json_object"}` (OpenAI)',
              "Syntactically valid JSON — but **any** shape.",
            ],
            [
              "Schema-enforced",
              "OpenAI structured outputs (`json_schema`, `strict: true`); or a forced tool call whose `input_schema` is your output schema",
              "Conforms to your schema via constrained decoding.",
            ],
          ],
        },
        {
          type: "code",
          language: "python",
          title: "the tool-call trick for guaranteed structure (Anthropic)",
          code: `# Define your desired OUTPUT as a tool schema, then force the model to "call" it.
resp = client.messages.create(
    model="claude-sonnet-5", max_tokens=1024,
    tools=[{
        "name": "record_ticket",
        "description": "Record the classified support ticket.",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {"type": "string",
                             "enum": ["billing", "bug", "feature_request", "other"]},
                "severity": {"type": "integer", "minimum": 1, "maximum": 5},
                "summary":  {"type": "string"},
            },
            "required": ["category", "severity", "summary"],
        },
    }],
    tool_choice={"type": "tool", "name": "record_ticket"},   # MUST call it
    messages=[{"role": "user", "content": f"Classify this ticket: {ticket_text}"}],
)
data = next(b for b in resp.content if b.type == "tool_use").input
# data is a dict matching the schema — no parsing prose`,
          explanation:
            "`tool_choice` forces the call, so the 'tool' is really just an output mold. This is the standard Anthropic pattern for structured extraction. On OpenAI, prefer native structured outputs with `strict: true`, which constrains decoding to the schema.",
        },
        {
          type: "heading",
          text: "Validate anyway — and repair",
        },
        {
          type: "code",
          language: "python",
          title: "validate with Pydantic, repair with a feedback retry",
          code: `from pydantic import BaseModel, ValidationError, conint

class Ticket(BaseModel):
    category: str
    severity: conint(ge=1, le=5)
    summary: str

def extract(text: str, max_retries: int = 2) -> Ticket:
    prompt = f"Classify this ticket: {text}"
    for attempt in range(max_retries + 1):
        raw = call_model(prompt)            # your API call
        try:
            return Ticket.model_validate(raw)
        except ValidationError as e:
            # feed the error BACK to the model — it usually self-corrects
            prompt = (f"Classify this ticket: {text}\\n"
                      f"Your previous output failed validation:\\n{e}\\n"
                      f"Return corrected JSON only.")
    raise RuntimeError("extraction failed after retries")`,
          explanation:
            "Order of mitigations for malformed output: (1) validate and **retry with the error message included** — cheapest fix, works most of the time; (2) tighten the schema/prompt (enums, `strict` mode, lower temperature); (3) fall back to a stronger model or a deterministic parser. Never silently `json.loads` and hope.",
        },
        {
          type: "callout",
          kind: "tip",
          text: "Tool calling vs. structured output — when to use which? **Tool = the model needs information or effects mid-task** (search, DB query), possibly several times. **Structured output = you need the final answer in a shape** (classification, extraction). If there's no action to perform, don't dress extraction up as an agent loop — force one schema'd output and be done.",
        },
        {
          type: "keypoints",
          points: [
            "JSON mode guarantees syntax; schema enforcement (strict structured outputs / forced tool call) guarantees shape.",
            "Constrain aggressively: enums, min/max, `required` — every constraint removes a failure mode.",
            "Validate with Pydantic/Zod even when 'guaranteed'; retry with the validation error fed back.",
            "Extraction ≠ agent. No action needed → one forced structured call.",
          ],
        },
      ],
    },
    {
      slug: "errors-and-resilience",
      title: "Errors, Rate Limits & Cost Control",
      minutes: 25,
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
              "**Don't retry** — fix the request. Retrying a 400 is a infinite loop.",
            ],
            ["`401 / 403`", "Auth problem", "Don't retry; alert loudly"],
            [
              "Timeout / connection error",
              "Network or a very long generation",
              "Retry with backoff; set explicit client timeouts",
            ],
            [
              "Refusal / empty content",
              "Model declined the task",
              "Detect (check `stop_reason`/content), rephrase or escalate to a human — don't loop blindly",
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
          text: "Agents resend a large, mostly-identical prefix every turn: system prompt, tool schemas, early conversation. **Prompt caching** lets the provider reuse the processed prefix — cached input tokens cost a fraction of fresh ones (Anthropic: cache reads are ~90% cheaper; writes cost a small premium) and process faster. For a 20-turn agent session whose prefix dominates, caching routinely cuts input cost by 70–90%.",
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
          type: "keypoints",
          points: [
            "Retry 429/5xx/timeouts with exponential backoff + jitter; **never** retry 400s.",
            "RPM and TPM are separate rate-limit buckets — big prompts can throttle you at low request rates.",
            "Prompt caching: stable prefix first, cache breakpoint after it — up to ~90% cheaper input.",
            "Log usage on every call; enforce a per-session dollar budget in the loop itself.",
            "Detect refusals and truncation via `stop_reason` — silent failures poison everything downstream.",
          ],
        },
      ],
    },
  ],
  quiz: [
    {
      question:
        "Why must you resend the full message history on every API call?",
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
        "What do temperature and top_p do, and what suits a tool-calling agent?",
      options: [
        "Temperature scales the token probability distribution, top_p truncates it to a probability mass; agents want temperature ~0–0.3, adjusting one parameter, not both",
        "Temperature controls response length, top_p controls politeness; agents want both maxed",
        "Both control randomness identically; set them equal for stability",
        "Temperature only matters for images; top_p only for code",
      ],
      correct: 0,
      explanation:
        "Temperature rescales logits (flatter vs. sharper distribution); top_p samples from the smallest set of tokens with cumulative probability ≥ p. For precise JSON and argument generation, keep temperature low and leave top_p alone.",
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
  ],
  lab: {
    title: "Tool-Calling CLI Assistant",
    objective:
      "Build a CLI assistant from scratch — raw SDK only, no frameworks — that answers questions using three tools: calculator, get_current_time, and read_file. This is the atom every later lab is built from. Starter code lives in labs/lab01-agent-loop/.",
    sections: [
      {
        type: "heading",
        text: "What you're building",
      },
      {
        type: "paragraph",
        text: 'A terminal REPL: the user types a question, your loop calls the model with three tool schemas, executes whatever the model requests, feeds results back, and prints the final answer — plus a running token/cost report. It must survive multi-step questions like *"what\'s 3 more than the number in numbers.txt?"* (read_file → calculator → answer).',
      },
      {
        type: "animation",
        name: "agent-loop",
        caption: "Your lab in one picture: loop until stop_reason is end_turn.",
      },
      {
        type: "heading",
        text: "Suggested structure",
      },
      {
        type: "code",
        language: "python",
        title: "skeleton (fill in the TODOs)",
        code: `# tools.py — implementations + schemas
def calculator(expression: str) -> str:
    # SAFELY evaluate arithmetic. No eval() on raw input —
    # use ast.literal_eval-style parsing or a tiny recursive parser.
    ...

def get_current_time(timezone: str = "UTC") -> str: ...
def read_file(path: str) -> str:
    # constrain to the working directory; return a clear error string
    # (not an exception) when the file doesn't exist
    ...

# agent.py — the loop
def run_turn(messages, budget):
    while True:
        resp = call_with_retries(lambda: client.messages.create(
            model=MODEL, max_tokens=1024, tools=SCHEMAS, messages=messages))
        budget.add(resp.usage)                 # track every call
        if resp.stop_reason != "tool_use":
            return resp
        messages.append({"role": "assistant", "content": resp.content})
        messages.append({"role": "user", "content": execute_all(resp.content)})`,
        explanation:
          "Design decisions that matter: tool errors are **returned as strings** (with `is_error: true`) so the model can recover; the calculator must not `eval()` arbitrary input; the loop needs a max-iteration guard so a confused model can't spin forever.",
      },
    ],
    acceptanceCriteria: [
      "Raw SDK only (anthropic or openai package) — no LangChain or agent frameworks",
      'Multi-turn tool use works: a question requiring two sequential tool calls succeeds ("what\'s 3 more than the number in numbers.txt?")',
      "Tool errors (file not found, division by zero) are returned to the model, which recovers gracefully — the loop never crashes",
      "Prints total tokens + estimated cost per session (rates pulled into one constant you can update)",
      "Retries API errors with exponential backoff + jitter (max 3 attempts), never retries 400s",
      "test_agent.py passes",
    ],
    stretchGoals: [
      "Stream the final answer token-by-token while still handling tool-use turns",
      "Add prompt caching with a cache breakpoint after the system prompt + tools, and log cache-read savings",
      "Practical test: re-implement the minimal one-tool loop from memory in under 30 minutes",
    ],
  },
  resources: [
    {
      title: "Anthropic — Tool use docs",
      url: "https://docs.claude.com/en/docs/build-with-claude/tool-use",
      description:
        "The canonical reference for the message shapes used in Lab 01.",
      kind: "docs",
    },
    {
      title: "OpenAI — Function calling & structured outputs",
      url: "https://platform.openai.com/docs/guides/function-calling",
      description:
        "Compare the two vendors' shapes — interviews ask about both.",
      kind: "docs",
    },
    {
      title: "Anthropic Cookbook",
      url: "https://github.com/anthropics/anthropic-cookbook",
      description:
        "Runnable notebooks for every pattern in this module. Run the tool-use ones.",
      kind: "repo",
    },
    {
      title: "Prompt Engineering Guide",
      url: "https://www.promptingguide.ai/",
      description:
        "Reference for prompting techniques; skim the basics, bookmark the rest.",
      kind: "guide",
    },
    {
      title: "OpenAI Cookbook",
      url: "https://cookbook.openai.com/",
      description:
        "The other vendor's runnable examples — structured outputs, function calling, streaming.",
      kind: "repo",
    },
    {
      title: "Chip Huyen — AI Engineering (book)",
      url: "https://huyenchip.com/books/",
      description:
        "The best book-length treatment of this whole curriculum; chapters 1–2 pair with this module.",
      kind: "book",
    },
  ],
};
