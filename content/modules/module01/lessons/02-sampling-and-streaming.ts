import type { Lesson } from "@/lib/types";

export const lesson02: Lesson = {
  slug: "sampling-and-streaming",
  title: "Controlling Generation: Sampling, Thinking & Streaming",
  minutes: 35,
  summary:
    "How a token actually gets picked — and how the dials changed. Classic sampling (temperature, top_p) still runs most of the industry, but 2026 frontier models replaced those knobs with adaptive thinking and an effort parameter. Streaming turns dead air into perceived speed.",
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
        "**temperature**: scales the logits before softmax. Near 0 → almost always the top token (near-deterministic, but not perfectly — GPU nondeterminism and ties remain). High → more diverse, more creative, more wrong. Ranges vary by provider (0–2 on OpenAI; 0–1 on Anthropic models that still accept it).",
        "**top_p (nucleus sampling)**: sample only from the smallest set of tokens whose cumulative probability ≥ p. `top_p=0.9` ignores the long tail entirely.",
        "**Adjust one, not both.** They interact multiplicatively and become impossible to reason about together. Pick temperature as your primary dial.",
        "**max_tokens** is a hard output cap, not a target — the model doesn't know it exists. Set it as a safety rail against runaway generation and check `stop_reason` for `max_tokens` to detect truncation.",
      ],
    },
    {
      type: "callout",
      kind: "tip",
      title: "Settings for agents",
      text: "Where sampling parameters exist, tool-calling agents want **low temperature (0–0.3)** — you're asking for precise JSON and correct arguments, not prose flair. But check your model first: on Anthropic's current frontier models there is no temperature to set at all (next section), and 'tuning randomness' stops being part of the job.",
    },
    {
      type: "heading",
      text: "The 2026 twist: frontier models removed the dials",
    },
    {
      type: "paragraph",
      text: "Anthropic's current frontier models (Claude Sonnet 5, Opus 4.7 and later) **no longer accept** `temperature`, `top_p`, or `top_k` — sending any of them returns a 400. The control surface moved up a level: instead of shaping the token distribution yourself, you tell the model how hard to work. Two parameters do that: **adaptive thinking** lets the model decide when and how much to reason before answering, and **effort** scales how much total work (thinking, tool calls, output) it spends.",
    },
    {
      type: "code",
      language: "python",
      title: "the modern dials: adaptive thinking + effort",
      code: `resp = client.messages.create(
    model="claude-sonnet-5",
    max_tokens=16000,
    thinking={"type": "adaptive"},        # model decides when/how much to reason
    output_config={"effort": "medium"},   # low | medium | high (some models add xhigh/max)
    messages=[{"role": "user", "content": "Plan the refactor step by step."}],
)

for block in resp.content:
    if block.type == "thinking":
        pass          # reasoning summary (visibility is opt-in via display settings)
    elif block.type == "text":
        print(block.text)`,
      explanation:
        "Responses can now contain **thinking blocks** alongside text. Two rules: thinking is billed as output tokens whether or not you display it, and in multi-turn conversations you resend thinking blocks **verbatim** like any other assistant content — the same own-the-array discipline from Lesson 1. Effort is the cost/quality lever: low for routine extraction, high for hard reasoning.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `resp = client.responses.create(
    model="gpt-5.5",
    reasoning={"effort": "medium"},   # low | medium | high | xhigh
    input=[{"role": "user", "content": "Plan the refactor step by step."}],
)
print(resp.output_text)   # reasoning happens internally; you get the answer`,
          explanation:
            "OpenAI's reasoning models likewise reject `temperature`; depth is a single top-level `reasoning={\"effort\": ...}` parameter rather than Anthropic's `thinking` + `output_config` pair, and the reasoning itself stays internal instead of arriving as content blocks.",
        },
      ],
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "You set `temperature=0.7` on a request to `claude-sonnet-5` because a blog post from 2024 said creative tasks want higher temperature. What happens, and what should you do instead?",
      answer:
        'The API rejects the request with a **400** — current frontier Claude models removed `temperature`/`top_p`/`top_k` entirely. For output-style control you now use prompting (describe the variety you want), and for how hard the model works you use `output_config: {"effort": ...}` with adaptive thinking. Older models (and most other providers) still accept sampling parameters — always check the model\'s docs rather than assuming the knobs are universal.',
    },
    {
      type: "heading",
      text: "Every response tells you why it stopped",
    },
    {
      type: "paragraph",
      text: "Every response carries a `stop_reason`, and production code **switches on it before reading content** — most silent agent failures trace back to code that assumed `end_turn`. Memorize the taxonomy; interviewers use it as a completeness check when you whiteboard a loop.",
    },
    {
      type: "table",
      headers: ["stop_reason", "Meaning", "What your code does"],
      rows: [
        [
          "`end_turn`",
          "Model finished naturally",
          "Read the content; the happy path",
        ],
        [
          "`max_tokens`",
          "Hit *your* output cap mid-thought",
          "Output is truncated — raise the cap, stream, or treat as incomplete. Never parse truncated JSON.",
        ],
        [
          "`tool_use`",
          "Model is requesting tools",
          "Execute them, append results, loop (Lesson 3)",
        ],
        [
          "`stop_sequence`",
          "Hit a custom stop string you configured",
          "Expected if you set one; check which via `stop_sequence`",
        ],
        [
          "`pause_turn`",
          "A server-side tool loop paused (long web search etc.)",
          "Append the assistant turn and re-send to resume — don't add a 'continue' message",
        ],
        [
          "`refusal`",
          "Model or safety layer declined (HTTP 200!)",
          "Don't loop or blind-retry; `stop_details` carries the category. Surface or route to a fallback.",
        ],
        [
          "`model_context_window_exceeded`",
          "Conversation no longer fits the window",
          "Not retryable as-is — truncate or summarize history first",
        ],
      ],
    },
    {
      type: "callout",
      kind: "warning",
      text: "The two everyone forgets: a **refusal is a 200**, so exception handling never sees it — only a `stop_reason` check does. And `max_tokens` truncation is silent — downstream JSON parsing fails mysteriously unless you check for it at the source. `stop_details` is populated only when `stop_reason` is `refusal`; it's `null` otherwise, so guard before reading it.",
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

# OpenAI (Responses API — the current primary surface)
stream = openai_client.responses.create(
    model="gpt-5.5", stream=True,
    input="Explain SSE in one paragraph.",
)
for event in stream:
    if event.type == "response.output_text.delta":
        print(event.delta, end="", flush=True)`,
      explanation:
        "On newer Claude models, thinking streams too (as thinking deltas) — surface it as a progress indicator or ignore it, but capture the final message either way.",
    },
    {
      type: "heading",
      text: "What SSE actually looks like on the wire",
    },
    {
      type: "paragraph",
      text: "Seniors get asked to describe the event protocol, not just call the helper. The response is a long-lived HTTP response with `Content-Type: text/event-stream`; each event is a typed frame. The lifecycle: one `message_start`, then for each content block a `content_block_start` → many `content_block_delta` → `content_block_stop`, then `message_delta` (carrying the final `stop_reason` and usage) and `message_stop`.",
    },
    {
      type: "code",
      language: "text",
      title: "raw SSE frames (abridged)",
      code: `event: message_start
data: {"type":"message_start","message":{"id":"msg_...","usage":{...}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":12}}

event: message_stop
data: {"type":"message_stop"}`,
      explanation:
        "Delta types vary by block: `text_delta` for text, `thinking_delta` for reasoning, and — the one that trips people up — `input_json_delta` for tool-call arguments.",
    },
    {
      type: "heading",
      text: "Streaming + tool calls: accumulating partial JSON",
    },
    {
      type: "paragraph",
      text: 'When a streamed response contains a tool call, the arguments arrive as **fragments of a JSON string** (`input_json_delta`), not as parseable objects. A fragment might be `{"ci` — parsing it throws. The rule: accumulate fragments per block index until `content_block_stop`, then parse once. This is a classic live-coding trap.',
    },
    {
      type: "code",
      language: "python",
      title: "accumulate input_json_delta until the block closes",
      code: `import json

tool_calls = {}   # block index -> {"name": ..., "id": ..., "buf": ...}

with client.messages.stream(model="claude-sonnet-5", max_tokens=1024,
                            tools=TOOLS, messages=messages) as stream:
    for event in stream:
        if event.type == "content_block_start" and \\
                event.content_block.type == "tool_use":
            tool_calls[event.index] = {"name": event.content_block.name,
                                       "id": event.content_block.id, "buf": ""}
        elif event.type == "content_block_delta":
            if event.delta.type == "input_json_delta":
                tool_calls[event.index]["buf"] += event.delta.partial_json
            elif event.delta.type == "text_delta":
                print(event.delta.text, end="", flush=True)
        elif event.type == "content_block_stop" and event.index in tool_calls:
            call = tool_calls[event.index]
            call["input"] = json.loads(call["buf"])   # NOW it's parseable

final = stream.get_final_message()   # or just use this — the SDK accumulated it`,
      explanation:
        "In practice you let the SDK do this (`get_final_message()` returns fully-formed `tool_use` blocks), but you must be able to explain the manual version: fragments keyed by block index, parse only at `content_block_stop`, and multiple tool calls can interleave as separate indices in one response.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `import json

buffers = {}   # item id -> accumulated argument fragments

stream = client.responses.create(model="gpt-5.5", input=input_items,
                                 tools=TOOLS, stream=True)
for event in stream:
    if event.type == "response.output_text.delta":
        print(event.delta, end="", flush=True)
    elif event.type == "response.function_call_arguments.delta":
        buffers[event.item_id] = buffers.get(event.item_id, "") + event.delta
    elif event.type == "response.function_call_arguments.done":
        args = json.loads(event.arguments)   # NOW it's parseable`,
          explanation:
            "Same trap, different event names: function-call arguments stream as string fragments in `response.function_call_arguments.delta` events keyed by item id — accumulate and parse only when the `.done` event (or the final response's completed item) arrives.",
        },
      ],
    },
    {
      type: "callout",
      kind: "insight",
      title: "Interview angle",
      text: 'Expect "what does temperature actually do?" (logit scaling before softmax — not \'creativity magic\') followed by "how do you control a model that doesn\'t expose it?" The strong answer covers both eras: distribution-shaping knobs where they exist, thinking/effort budgets on 2026 frontier models, and time-to-first-token as the streaming UX metric.',
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"Explain what temperature does — precisely, not 'it makes the model more creative.'\"",
      answer:
        "At each step the model produces logits over the vocabulary. Temperature **divides the logits before softmax**: T < 1 sharpens the distribution (probability mass concentrates on the top tokens), T > 1 flattens it (tail tokens become viable), T → 0 approaches argmax. It doesn't change what the model *knows* — it changes how the next token is *picked* from what the model already believes. Two senior add-ons: T=0 still isn't perfectly deterministic (GPU non-determinism, ties, batching effects), and temperature interacts multiplicatively with top_p, which is why you tune one, not both. **Follow-up probe:** \"so why did frontier models remove it?\" → the useful control turned out to be *how much work* the model does (thinking/effort), not the shape of the token distribution — and prompting steers style better than distribution-flattening does.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** Your agent's p50 total latency is 6s and users complain it feels slow. What metric do you actually optimize, and with what levers?",
      answer:
        '**Time-to-first-token (TTFT)**, not total latency — perceived speed is about when something starts appearing. Levers in order: (1) stream and render deltas immediately (flush, no buffering); (2) prompt caching — a cache hit skips prefill on the huge stable prefix, and prefill dominates TTFT for long prompts; (3) shrink the prompt (trim history, defer tool schemas); (4) a faster model tier for the first visible response; (5) UX tricks — show thinking-in-progress indicators when the model reasons before answering. Total latency still matters for pipeline stages nobody watches; TTFT matters where a human is staring at the screen. **Follow-up probe:** "streaming is on but TTFT is still 4s — why?" → long uncached prefill (check `cache_read_input_tokens`), or the model is thinking before emitting text.',
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** A PM asks for 'more creative, varied' marketing copy from a model that exposes no sampling parameters. What do you do?",
      answer:
        "Move the variety into the **prompt and the harness**: describe the variety you want ('propose 3 directions with distinct voices, avoid the phrasing of previous outputs'), inject variation deliberately (rotate style exemplars, seeds of context, persona instructions per request), or generate N candidates and pick/judge. On models that still expose temperature, you'd raise it — but say explicitly that prompt-level steering usually beats distribution-flattening even there, because temperature adds *randomness*, not *taste*. **Follow-up probe:** \"how do you evaluate that the outputs actually got more varied?\" → embedding-distance or n-gram overlap across samples, plus human preference evals — which is Module 5's territory, and saying so shows you know the map.",
    },
    {
      type: "keypoints",
      points: [
        "Sampling picks from a probability distribution; temperature scales it, top_p truncates it. Where both exist, tune one.",
        "2026 frontier Claude models removed sampling params (400 if sent) — control is adaptive thinking + `output_config.effort`.",
        "Switch on `stop_reason` before reading content: `end_turn`, `max_tokens`, `tool_use`, `pause_turn`, `refusal` (an HTTP 200!), `model_context_window_exceeded`.",
        "Streamed tool arguments arrive as `input_json_delta` fragments — accumulate per block index, parse only at `content_block_stop`.",
        "Streaming = SSE deltas; time-to-first-token is the UX metric that matters.",
        "Always capture the final usage/message object after a stream completes.",
      ],
    },
  ],
};
