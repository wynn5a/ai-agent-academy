import type { Lesson } from "@/lib/types";

export const lesson02: Lesson = {
  slug: "sampling-and-streaming",
  title: "Controlling Generation: Sampling, Thinking & Streaming",
  minutes: 25,
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
        "Streaming complicates tool calling slightly: tool-call arguments arrive as partial JSON fragments you must accumulate until the block completes. The SDKs' helper events (`content_block_stop`, accumulated snapshots) handle this — use them rather than parsing fragments yourself. On newer Claude models, thinking streams too (as thinking deltas) — surface it as a progress indicator or ignore it, but capture the final message either way.",
    },
    {
      type: "callout",
      kind: "insight",
      title: "Interview angle",
      text: 'Expect "what does temperature actually do?" (logit scaling before softmax — not \'creativity magic\') followed by "how do you control a model that doesn\'t expose it?" The strong answer covers both eras: distribution-shaping knobs where they exist, thinking/effort budgets on 2026 frontier models, and time-to-first-token as the streaming UX metric.',
    },
    {
      type: "keypoints",
      points: [
        "Sampling picks from a probability distribution; temperature scales it, top_p truncates it. Where both exist, tune one.",
        "2026 frontier Claude models removed sampling params (400 if sent) — control is adaptive thinking + `output_config.effort`.",
        "`max_tokens` is a guardrail; detect truncation via `stop_reason`.",
        "Streaming = SSE deltas; time-to-first-token is the UX metric that matters.",
        "Always capture the final usage/message object after a stream completes.",
      ],
    },
  ],
};
