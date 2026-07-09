import type { Lesson } from "@/lib/types";

export const lesson01: Lesson = {
  slug: "messages-are-the-only-state",
  title: "Messages Are the Only State",
  minutes: 35,
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
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `from openai import OpenAI

client = OpenAI()  # reads OPENAI_API_KEY

input_items = []  # <- this list IS the conversation. You own it.

def chat(user_text: str) -> str:
    input_items.append({"role": "user", "content": user_text})
    response = client.responses.create(
        model="gpt-5.5",
        instructions="You are a concise engineering assistant.",
        input=input_items,        # full history, every single time
    )
    reply = response.output_text
    input_items.append({"role": "assistant", "content": reply})
    return reply

print(chat("My name is Wenming."))
print(chat("What's my name?"))   # works ONLY because we resent turn 1`,
          explanation:
            "The system prompt is OpenAI's top-level `instructions` (vs Anthropic's `system`), and the Responses API *can* keep state server-side via `previous_response_id` — but owning the input list yourself is the portable habit every agent pattern builds on.",
        },
      ],
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
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `curl https://api.openai.com/v1/responses \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "gpt-5.5",
    "instructions": "You are a concise engineering assistant.",
    "input": [{"role": "user", "content": "My name is Wenming."}]
  }'`,
          explanation:
            "Auth is a standard `Authorization: Bearer` header (vs Anthropic's `x-api-key` + `anthropic-version`), the system prompt is `instructions`, and `max_output_tokens` is optional here where Anthropic's `max_tokens` is required.",
        },
      ],
    },
    {
      type: "heading",
      text: "What the server actually does with your POST",
    },
    {
      type: "paragraph",
      text: "When your request lands, the server tokenizes the entire prompt and runs **prefill** — one massively parallel pass over all input tokens that builds the model's internal working state (the KV cache). Then it **decodes** output tokens one at a time, each step conditioned on everything before it. When the response finishes, that working state is thrown away. This is why input and output tokens are priced differently — prefill parallelizes across the GPU while decoding is inherently serial — and it's why the next call starts from zero.",
    },
    {
      type: "paragraph",
      text: "Statelessness isn't laziness — it's an architectural choice that buys horizontal scale. Because no server holds your conversation, **any machine in the fleet can serve your next request**: no session affinity, no replicated conversation store, trivial failover. The cost is pushed onto you (resend everything), then partially refunded by **prompt caching** (Lesson 5), which keeps a processed prefix warm so identical prefixes skip prefill. A senior answer connects these dots out loud: stateless → resend → quadratic cost → caching as the mitigation.",
    },
    {
      type: "exercise",
      kind: "predict",
      prompt:
        "In the Python example above, comment out the second `messages.append` (the one that stores the assistant's reply). What does `chat(\"What's my name?\")` return now, and why?",
      answer:
        'The model won\'t know the name. Without appending the assistant turn, the second call sends `[user: "My name is Wenming.", user: "What\'s my name?"]` — the model never sees its own earlier reply, and more importantly your history is now missing a turn. Memory lives entirely in the list *you* maintain; the server contributes nothing.',
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
      provider: "claude",
      code: `# Exact pre-send count — free, no generation. Pass the SAME system,
# messages, and tools you'll actually send, or the count will be low.
count = client.messages.count_tokens(
    model="claude-sonnet-5",
    system="You are a concise engineering assistant.",
    messages=messages,
    # tools=tools,   # tool schemas are input tokens too — include them
)
if count.input_tokens > 150_000:        # gate before spending on a big call
    messages = compact(messages)        # trim/summarize (Module 4)

# Then log real usage on EVERY response — you can't manage what you can't see.
resp = client.messages.create(
    model="claude-sonnet-5", max_tokens=256, messages=messages,
)
u = resp.usage
log.info("tokens in=%d out=%d cache_read=%d cache_write=%d",
         u.input_tokens, u.output_tokens,
         u.cache_read_input_tokens, u.cache_creation_input_tokens)`,
      explanation:
        "Anthropic gives you an **exact** pre-send count for free via `count_tokens` — feed it the same `system`, `messages`, and `tools` you're about to send. Then log `usage` on every call (note the separate `cache_read`/`cache_write` fields — you'll tune those in Lesson 5) and aggregate per session/user/day. Cost bugs like resending a huge document every turn hide in unlogged usage.",
      variants: [
        {
          provider: "openai",
          language: "python",
          code: `# No count endpoint — estimate locally with tiktoken. Treat it as
# APPROXIMATE: encodings lag new models and per-message overhead varies.
import tiktoken

def count_tokens(messages, model="gpt-4.1") -> int:
    try:
        enc = tiktoken.encoding_for_model(model)
    except KeyError:
        enc = tiktoken.get_encoding("o200k_base")  # current default encoding
    # Each message carries framing overhead — don't just encode one string.
    n = sum(4 + len(enc.encode(m["content"])) for m in messages)
    return n + 2                        # priming tokens for the reply

if count_tokens(messages) > 100_000:    # gate before spending on a big call
    messages = compact(messages)        # trim/summarize (Module 4)

# The response usage block is the AUTHORITATIVE count — log it every call.
resp = client.chat.completions.create(
    model="gpt-4.1", max_tokens=256, messages=messages,
)
u = resp.usage
log.info("tokens in=%d out=%d", u.prompt_tokens, u.completion_tokens)`,
          explanation:
            "OpenAI has no count endpoint, so `tiktoken` is your only pre-send estimate — and it's only an estimate: encodings trail the newest models and the per-message framing overhead is version-specific, so leave headroom. The `usage` block on the response (`prompt_tokens`/`completion_tokens`) is the one authoritative number — log it on every call.",
        },
      ],
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
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        'To keep token costs down, a teammate adds naive history trimming. It works for a while, then some sessions start failing with a 400: `first message must use the "user" role`. Others quietly give worse answers. What are the two bugs?',
      code: `MAX_MSGS = 10

def chat(user_text: str) -> str:
    global messages
    messages.append({"role": "user", "content": user_text})
    messages = messages[-MAX_MSGS:]        # keep the context small
    resp = client.messages.create(
        model="claude-sonnet-5", max_tokens=1024, messages=messages,
    )
    reply = resp.content[0].text
    messages.append({"role": "assistant", "content": reply})
    return reply`,
      answer:
        "**Bug 1 (the 400)**: `messages[-10:]` slices at an arbitrary index. Whenever the slice happens to start on an *assistant* message, the history begins with the wrong role and the API rejects it — conversations must start with a `user` turn. **Bug 2 (the quality loss)**: blind truncation silently drops the earliest context — including the message where the user stated their name, goal, or constraints — so the model degrades with no error at all. | **The senior fix:** trim at **turn boundaries** (always start on a `user` message), keep any standing context in the `system` prompt (which rides outside the array), and prefer *summarizing* dropped turns over deleting them. In Lesson 3 a third rule appears: never split a `tool_use`/`tool_result` pair.",
    },
    {
      type: "callout",
      kind: "insight",
      title: "Interview angle",
      text: '"Why do you resend the whole conversation every turn, and what does that cost?" is a classic screener. Strong answer: the model is stateless; the messages array is the only context; therefore input cost grows quadratically with turns, and the mitigations are prompt caching, truncation, and summarization. Being able to do the token math above out loud is exactly the bar.',
    },
    {
      type: "callout",
      kind: "career",
      title: "Why this module is the screen",
      text: "AI Engineer is LinkedIn's #1 fastest-growing U.S. job title for 2026, and postings in the \"Agentic AI\" skill cluster grew roughly 280% year over year (~90K U.S. postings). The skills those postings name — Python, OpenAI/Anthropic tool calling, structured outputs — all sit on top of this lesson's stateless message loop, which is why interviewers screen it first: everything else in the role is built on it.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "paragraph",
      text: "Answer each out loud before revealing — in the real loop you'll be talking while writing. The answers below are pitched at the senior bar and end with the follow-up probe an interviewer would fire next.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** Your agent's process crashes mid-conversation and the user reconnects to a different server. Design session resume.",
      answer:
        '**Core:** Resume is a **client-side persistence** problem — the API is stateless, so there\'s nothing to restore provider-side. Persist the `messages` array (plus system prompt and tool set versions) to durable storage keyed by session id, written **atomically after every completed turn** — including assistant `tool_use` and thinking blocks *verbatim*, since they must be resent exactly. On reconnect: load, append the new user message, call the API. | **Two things to say unprompted:** (1) a resumed session pays full input re-processing unless the prompt cache is still warm — resuming an hour later means a cold cache write; (2) persist *before* executing side-effectful tools, or a crash between execution and persistence replays the side effect. | **Follow-up probe:** "what if the restored history no longer fits the context window?" → truncate at turn boundaries or summarize old turns before the first resumed call.',
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** A 50-turn support conversation averages ~300 tokens per turn, at $3/MTok input and $15/MTok output. Ballpark the session cost out loud — and name the single change that cuts it most.",
      answer:
        '**Core:** Cumulative input is triangular: 300 × (1+2+…+50) = 300 × 1,275 ≈ **380K input tokens ≈ $1.15**. Output is linear: 50 × 300 = 15K tokens ≈ **$0.22**. So input dominates ~5:1 — purely because history is resent — and it gets worse quadratically. | **Biggest single change:** **prompt caching** on the stable prefix (~90% off cache reads turns that $1.15 into roughly $0.15–0.30 depending on hit rate); after that, summarize or truncate old turns, and route to a cheaper model if quality allows. | **Follow-up probe:** "why quadratic and not linear?" → each turn re-processes all prior turns as input; summing 1..n is n(n+1)/2.',
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** Where does the system prompt actually live in the request, and what does that imply for caching and steering?",
      answer:
        '**Core:** Anthropic: a top-level `system` parameter outside the messages array. OpenAI: the first message with `role: "system"` (or `"developer"`). Either way it\'s serialized into the prompt **ahead of the conversation**, which has two consequences: (1) it\'s the highest-priority steering channel — instructions there outrank user text; (2) it\'s the front of the cached prefix, so it must be **byte-stable** — interpolating a timestamp or user name into it silently kills the cache for everything after it. Inject volatile context late in the messages list instead. | **Follow-up probe:** "a teammate puts `Current date: {now}` at the top of the system prompt — what do you see in the usage metrics?" → `cache_read_input_tokens: 0` on every call while paying the write premium repeatedly.',
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
};
