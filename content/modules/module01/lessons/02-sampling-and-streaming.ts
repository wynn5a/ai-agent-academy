import type { Lesson } from "@/lib/types";

export const lesson02: Lesson = {
  slug: "sampling-and-streaming",
  title: "Controlling Generation: Sampling, Thinking & Streaming",
  minutes: 38,
  summary:
    "How a token actually gets picked, step by step — logits, softmax, and the sampling parameters that shape the draw — and how the dials changed. Classic sampling (temperature, top_p) still runs most of the industry, but 2026 frontier models replaced those knobs with adaptive thinking and an effort parameter. Streaming turns dead air into perceived speed.",
  sections: [
    {
      type: "paragraph",
      text: "At each step of generation, the model produces a probability distribution over its entire vocabulary for the next token. **Sampling parameters shape how a token gets picked from that distribution.** Before the knobs make sense, walk the pipeline that runs at every single step.",
    },
    {
      type: "heading",
      text: "Step by step: how one token gets picked",
    },
    {
      type: "paragraph",
      text: "The model's last layer doesn't output a token, and it doesn't output a probability either. It outputs one raw, unbounded real number per vocabulary token — a **logit**. `4.2` for `\"Paris\"`, `-0.6` for `\"France\"`. Logits can be negative, they don't sum to anything meaningful, and a logit of `4.2` on its own tells you nothing except that it's bigger than the others. They're a ranking, not a distribution — yet.",
    },
    {
      type: "paragraph",
      text: "**Softmax** is the function that turns that vector of logits into an actual probability distribution: exponentiate every logit (which makes everything positive), then divide each by the sum of all the exponentials, so every value lands between 0 and 1 and the whole vocabulary sums to exactly 100%.",
    },
    {
      type: "code",
      language: "text",
      title: "the softmax formula",
      code: `P(token_i) = exp(logit_i) / Σⱼ exp(logit_j)`,
      explanation:
        "exp() amplifies gaps — a logit 2 higher than another becomes ~7.4× more probable (e² ≈ 7.39) after softmax. That's why the output distribution is often much more sharply peaked than the raw logits looked.",
    },
    {
      type: "animation",
      name: "token-selection",
      caption:
        "The full pipeline for one token: logits → scale by temperature → softmax → sample → append — then the whole model runs again for the next position.",
    },
    {
      type: "heading",
      text: "The knobs: temperature and top_p",
    },
    {
      type: "list",
      items: [
        "**temperature**: scales the logits before softmax (divides them, technically — the animation above uses T=0.7). Near 0 → almost always the top token (near-deterministic, but not perfectly — GPU nondeterminism and ties remain). High → more diverse, more creative, more wrong. Ranges vary by provider (0–2 on OpenAI; 0–1 on Anthropic models that still accept it).",
        "**top_p (nucleus sampling)**: sample only from the smallest set of tokens whose cumulative probability ≥ p. `top_p=0.9` ignores the long tail entirely.",
        "**Adjust one, not both.** They interact multiplicatively and become impossible to reason about together. Pick temperature as your primary dial.",
        "**max_tokens** is a hard output cap, not a target — the model doesn't know it exists. Set it as a safety rail against runaway generation and check `stop_reason` for `max_tokens` to detect truncation.",
      ],
    },
    {
      type: "animation",
      name: "temperature",
      caption:
        "Low temperature sharpens the distribution toward the top token; high temperature flattens it, letting unlikely tokens through.",
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
      text: "Anthropic's Claude Opus 4.7 and 4.8 reject `temperature`, `top_p`, and `top_k` outright — including any one of them in a request returns a 400, even the model's own default value. Claude Sonnet 5 is a notch more lenient: omitting the parameter, or passing its default, is accepted; only a **non-default** value 400s. All three also drop the old fixed-budget shape — `thinking: {\"type\": \"enabled\", \"budget_tokens\": N}` now 400s — leaving a single on-state: `thinking: {\"type\": \"adaptive\"}`.",
    },
    {
      type: "paragraph",
      text: 'The control surface moved up a level: instead of shaping the token distribution yourself, you tell the model how hard to work. **Adaptive thinking** lets the model decide when and how much to reason before answering; **effort** — set inside `output_config`, defaulting to `"high"` — scales how much total work (thinking, tool calls, output) it spends, from `low` up to `max`. One default worth knowing: leave `thinking` out of the request entirely and Sonnet 5 runs adaptive automatically, while Opus 4.7/4.8 run with **no thinking at all** — set `thinking: {"type": "adaptive"}` explicitly if you want reasoning on the Opus tier.',
    },
    {
      type: "paragraph",
      text: "OpenAI's reasoning models followed the same path from their own starting point. `o1`, `o3`, `o4-mini`, and the GPT-5 series reject `temperature`, `top_p`, `presence_penalty`, `frequency_penalty`, and a few other sampling-adjacent fields once reasoning is active — the API error is explicit: *\"Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported.\"* In their place, `reasoning_effort` (Chat Completions) or `reasoning: {\"effort\": ...}` (Responses API) controls how much internal reasoning happens, with values from `\"minimal\"`/`\"none\"` up to `\"high\"`/`\"xhigh\"` depending on model version. Unlike Anthropic's blanket removal, OpenAI's rule isn't fixed per model family — some later GPT-5.x point releases (e.g. GPT-5.2 defaulting to `reasoning_effort: \"none\"`) reintroduced `temperature` support once reasoning is explicitly dialed down, so treat 'does this model accept temperature' as a **per-version** question you check in the docs, not a permanent per-family rule.",
    },
    {
      type: "code",
      language: "python",
      title: "the modern dials: adaptive thinking + effort",
      code: `resp = client.messages.create(
    model="claude-sonnet-5",
    max_tokens=16000,
    thinking={"type": "adaptive"},        # model decides when/how much to reason
    output_config={"effort": "medium"},   # low | medium | high | xhigh | max (default: "high")
    messages=[{"role": "user", "content": "Plan the refactor step by step."}],
)

for block in resp.content:
    if block.type == "thinking":
        pass          # empty by default (display="omitted") — pass display="summarized" for a readable summary
    elif block.type == "text":
        print(block.text)`,
      explanation:
        "Responses can now contain **thinking blocks** alongside text. Two rules: thinking is billed as output tokens whether or not you display it, and in multi-turn conversations you resend thinking blocks **verbatim** like any other assistant content — the same own-the-array discipline from Lesson 1. Effort is the cost/quality lever: `low` for routine extraction, `high` (the default) for most work, `xhigh`/`max` for the hardest agentic tasks.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `resp = client.responses.create(
    model="gpt-5.5",
    reasoning={"effort": "medium"},   # minimal | low | medium | high | xhigh
    input=[{"role": "user", "content": "Plan the refactor step by step."}],
)
print(resp.output_text)   # reasoning happens internally; you get the answer`,
          explanation:
            "OpenAI's reasoning models reject (or pin to their default) `temperature` the same way once reasoning is active; depth is a single top-level `reasoning={\"effort\": ...}` parameter on the Responses API (`reasoning_effort` on Chat Completions) rather than Anthropic's `thinking` + `output_config` pair, and the reasoning itself stays internal instead of arriving as content blocks. Exact support drifts by sub-version — some later GPT-5.x releases re-accept `temperature` once effort is explicitly set to a minimal level — so check the model's current docs rather than assuming the rule is fixed forever.",
        },
      ],
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "You set `temperature=0.7` on a request to `claude-sonnet-5` because a blog post from 2024 said creative tasks want higher temperature. What happens, and what should you do instead?",
      answer:
        'The API rejects the request with a **400** — Sonnet 5 accepts `temperature` only at its default value (or omitted); a non-default `0.7` doesn\'t qualify. (Opus 4.7/4.8 are stricter still: they reject the field even at the default.) For output-style control you now use prompting (describe the variety you want), and for how hard the model works you use `output_config: {"effort": ...}` with adaptive thinking. Older models (and most other providers) still accept sampling parameters — always check the model\'s docs rather than assuming the knobs are universal.',
    },
    {
      type: "heading",
      text: "Every response tells you why it stopped",
    },
    {
      type: "paragraph",
      text: "Every provider tells you why generation ended, and production code **switches on that field before reading content** — most silent agent failures trace back to code that assumed the happy path. But the field name, its possible values, and even which object it lives on are provider-specific and API-specific. Anthropic has one field on one API; OpenAI has two different mechanisms depending on which API you call. Learn both — interviewers use this as a completeness check when you whiteboard a loop.",
    },
    {
      type: "tab-group",
      tabs: [
        {
          provider: "claude",
          sections: [
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
              text: "The two everyone forgets on Anthropic: a **refusal is a 200**, so exception handling never sees it — only a `stop_reason` check does. And `max_tokens` truncation is silent — downstream JSON parsing fails mysteriously unless you check for it at the source. `stop_details` is populated only when `stop_reason` is `refusal`; it's `null` otherwise, so guard before reading it.",
            },
          ],
        },
        {
          provider: "openai",
          sections: [
            {
              type: "paragraph",
              text: 'OpenAI doesn\'t have a field called `stop_reason` at all, and its two APIs don\'t agree with each other. **Chat Completions** puts a `finish_reason` string on each `choice`. The **Responses API** instead puts a top-level `status` on the whole response, and when that status is `"incomplete"` you drill into `incomplete_details.reason` for the specifics — there is no `finish_reason` field on a Responses API call.',
            },
            {
              type: "table",
              headers: [
                "finish_reason (Chat Completions)",
                "Meaning",
                "What your code does",
              ],
              rows: [
                [
                  "`stop`",
                  "Model hit a natural stop or your `stop` sequence",
                  "Read `message.content`; the happy path",
                ],
                [
                  "`length`",
                  "Hit `max_tokens` mid-generation",
                  "Output is truncated — raise the cap or treat as incomplete. Never parse truncated JSON.",
                ],
                [
                  "`tool_calls`",
                  "Model wants to call one or more tools",
                  "Execute them, append results, loop (Lesson 3)",
                ],
                [
                  "`content_filter`",
                  "Output withheld or truncated by OpenAI's moderation layer",
                  "Can be an HTTP 200 with partial or empty content — check this before assuming a bug",
                ],
                [
                  "`function_call` (deprecated)",
                  "Legacy predecessor to `tool_calls`",
                  "Migrate to `tool_calls`; still returned by some older models",
                ],
              ],
            },
            {
              type: "table",
              headers: ["status (Responses API)", "Meaning", "What your code does"],
              rows: [
                [
                  "`completed`",
                  "Response finished normally",
                  "Read `output`; the happy path",
                ],
                [
                  "`incomplete`",
                  "Stopped early — check `incomplete_details.reason` (e.g. `max_output_tokens`)",
                  "Can fire before any visible text if reasoning tokens ate the whole budget — raise `max_output_tokens` and give reasoning models headroom",
                ],
                [
                  "`in_progress` / `queued`",
                  "Still running (streaming, or created with `background: true`)",
                  "Poll or stream until a terminal status arrives",
                ],
                [
                  "`failed`",
                  "Request errored server-side",
                  "Not generally retryable as-is — inspect the error detail on the response",
                ],
              ],
            },
            {
              type: "callout",
              kind: "warning",
              text: "The Responses API has **no dedicated status for tool calls** — when the model wants one, `status` is still `completed` and you instead find an `output` item of type `function_call`; scan `output` for that type rather than branching on `status`. And OpenAI's refusal signal isn't a stop value on either API: on Chat Completions it's a `refusal` string field on the assistant message, and on the Responses API it's a `refusal`-typed content part inside `output` — both alongside a `200`, so structured-output code must check for `refusal` before trying to parse the response as your schema.",
            },
          ],
        },
      ],
    },
    {
      type: "heading",
      text: "Streaming",
    },
    {
      type: "paragraph",
      text: "Without streaming, the client sends one request and blocks until the model has generated the *entire* completion — for a long answer that's many seconds of dead air. Streaming flips this: the API holds the HTTP response open and pushes tokens to the client as they're produced, over **Server-Sent Events (SSE)**. Time-to-first-token, not time-to-full-response, becomes the latency the user actually feels — often a 10× improvement in perceived speed for the same total generation time.",
    },
    {
      type: "heading",
      text: "Why SSE — not a plain response, not a WebSocket",
    },
    {
      type: "paragraph",
      text: "SSE is a W3C standard (part of the HTML spec) for server-to-client streaming over an ordinary HTTP connection. The server replies with `Content-Type: text/event-stream` and, instead of writing one body and closing, holds the connection open and emits a sequence of UTF-8 text **events** — each an `event:`/`data:` block terminated by a blank line — until it's finished. It's deliberately minimal: one direction (server → client), text only, carried by the same HTTP request you already made.",
    },
    {
      type: "paragraph",
      text: "Contrast that with a **plain HTTP request**, which is all-or-nothing: the client blocks until the full response body has arrived, then processes it. Even when chunked transfer encoding moves the bytes in pieces underneath, an ordinary client hands your code the body only once it's complete — so you're back to dead air. SSE is that same streamed HTTP response *plus* a thin framing protocol (typed events with explicit boundaries), which is exactly what lets the client parse and render each token the moment it lands instead of waiting for the last byte.",
    },
    {
      type: "paragraph",
      text: "A **WebSocket** starts as an HTTP request but then performs an `Upgrade` handshake that switches the connection to a separate, full-duplex protocol (`ws://`) where either side can send at any time. That bidirectionality is precisely what token streaming *doesn't* need: the interaction is send-one-prompt, stream-one-response. Reaching for WebSockets here buys you connection state, heartbeats, and reconnection logic to manage — plus infrastructure (corporate proxies, CDNs, load balancers) that frequently mishandles the protocol upgrade. SSE's unidirectional shape matches the request-then-response-stream shape of an API call, and because it stays plain HTTP, your bearer-token auth, proxies, retries, and request logging all keep working unchanged. That fit is why every major LLM provider streams over SSE rather than WebSockets.",
    },
    {
      type: "table",
      headers: ["", "Plain HTTP", "SSE", "WebSocket"],
      rows: [
        [
          "**Direction**",
          "Request → one response",
          "Server → client stream",
          "Full-duplex (both ways)",
        ],
        [
          "**Connection**",
          "Opens, one body, closes/reused",
          "One long-lived HTTP response",
          "HTTP `Upgrade` → persistent `ws://` socket",
        ],
        [
          "**Protocol**",
          "HTTP",
          "HTTP + `text/event-stream` framing",
          "Own frame protocol after the handshake",
        ],
        [
          "**Fits token streaming?**",
          "No — you wait for the whole answer",
          "Yes — the industry default",
          "Overkill — bidirectional you don't use",
        ],
        [
          "**Auth & infra**",
          "Works everywhere",
          "Works everywhere (it's just HTTP)",
          "Can break through proxies/CDNs/firewalls",
        ],
      ],
    },
    {
      type: "callout",
      kind: "insight",
      title: "Two senior nuances",
      text: "Over **HTTP/1.1**, browsers cap concurrent connections at ~6 per domain, so many open SSE streams to one host can starve other requests — **HTTP/2** multiplexes them over a single connection and makes the limit a non-issue (relevant when your *own* app fans out streams, less so for a single API call). And the SDK's `stream=True` isn't magic: the wire is always SSE regardless of language: the `messages.stream()` / `responses.create(stream=True)` helper is just parsing those `text/event-stream` frames into typed events for you (next section shows the raw frames).",
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
      title: "streaming a text response",
      code: `with client.messages.stream(
    model="claude-sonnet-5", max_tokens=1024,
    messages=[{"role": "user", "content": "Explain SSE in one paragraph."}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)

final = stream.get_final_message()          # full message + usage`,
      explanation:
        "On newer Claude models, thinking streams too (as thinking deltas) — surface it as a progress indicator or ignore it, but capture the final message after the loop either way.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `with client.responses.stream(
    model="gpt-5.5",
    input="Explain SSE in one paragraph.",
) as stream:
    for event in stream:
        if event.type == "response.output_text.delta":
            print(event.delta, end="", flush=True)

final = stream.get_final_response()          # full response + usage`,
          explanation:
            "The Responses API streams as typed events — branch on `event.type`. `response.output_text.delta` carries visible text; when reasoning summaries are enabled, `response.reasoning_summary_text.delta` streams those separately. `get_final_response()` returns the assembled output plus usage once the stream closes.",
        },
      ],
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
      text: "Streaming text is easy: every `text_delta` is a finished piece of string — you print it and move on. **Tool calls are the exception, and this is the one part of streaming people get wrong.** When the model decides to call a tool, the tool's arguments are a JSON object — but that object does not arrive whole. The API types it out the same way it types out prose: as a run of tiny character fragments, one per `input_json_delta` frame. Any single fragment is just raw characters of half-written JSON, so on its own it almost never parses.",
    },
    {
      type: "code",
      language: "text",
      title: "one JSON object, sliced across four deltas",
      code: `The tool call the model wants:
    {"city": "Paris", "units": "celsius"}

How it actually arrives — one input_json_delta at a time:
    delta 1  →  {"ci
    delta 2  →  ty": "Par
    delta 3  →  is", "un
    delta 4  →  its": "celsius"}

json.loads('{"ci')                     ✗  crashes — not valid JSON yet
parse after every delta                ✗  keeps crashing until the last piece
json.loads(all fragments joined)       ✓  {"city": "Paris", "units": "celsius"}`,
      explanation:
        "The delta boundaries are arbitrary — they fall wherever the network happened to chunk the bytes, not on JSON tokens. That's why no fragment is safe to parse in isolation.",
    },
    {
      type: "paragraph",
      text: "So the **key point** is a two-part rule. (1) *Don't parse as you go* — accumulate each fragment into a string buffer and call `json.loads` exactly once, when `content_block_stop` signals the object is complete. (2) *Keep one buffer per block, not one global buffer* — a single response can request several tools at once, and each is a separate content block with its own `index`; their fragments interleave on the wire, so you key buffers by index to keep them from mixing. That's the whole trick, and it's a classic live-coding trap.",
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
        "Claude Opus 4.7/4.8 reject sampling params outright; Sonnet 5 rejects only non-default values — control shifted to adaptive thinking + `output_config.effort` (default `\"high\"`).",
        "Switch on the stop field before reading content — but the field differs by provider: Anthropic's `stop_reason` (`end_turn`, `max_tokens`, `tool_use`, `pause_turn`, `refusal`, `model_context_window_exceeded`); OpenAI Chat Completions' `finish_reason` (`stop`, `length`, `tool_calls`, `content_filter`); OpenAI Responses API's `status` + `incomplete_details.reason`. A refusal is always a 200, and on OpenAI it's not a stop value at all — it's a `refusal` field/content part on the message.",
        "Streamed tool arguments arrive as `input_json_delta` fragments — accumulate per block index, parse only at `content_block_stop`.",
        "Streaming = SSE deltas; time-to-first-token is the UX metric that matters.",
        "Always capture the final usage/message object after a stream completes.",
      ],
    },
  ],
};
