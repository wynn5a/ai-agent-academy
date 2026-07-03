import type { Lesson } from "@/lib/types";

export const lesson01: Lesson = {
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
      text: '"Why do you resend the whole conversation every turn, and what does that cost?" is a classic screener. Strong answer: the model is stateless; the messages array is the only context; therefore input cost grows quadratically with turns, and the mitigations are prompt caching, truncation, and summarization. Being able to do the token math above out loud is exactly the bar.',
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
