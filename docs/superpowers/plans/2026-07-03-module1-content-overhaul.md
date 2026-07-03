# Module 1 Content Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Module 1 ("LLM API Mastery") up to mid-2026 API reality, add four missing topics (raw HTTP, extended thinking, model selection, multimodal), introduce reveal-answer exercises as a new content primitive, and deepen interview relevance.

**Architecture:** All course content is plain typed data in `content/modules/module01.ts` validated by the `Section`/`Lesson`/`Module` types in `lib/types.ts` and rendered by `components/SectionRenderer.tsx`. One additive schema change (a new `exercise` Section variant + `components/Exercise.tsx`) unlocks the interactive checkpoints; everything else is content edits to `module01.ts`.

**Tech Stack:** Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 · Framer Motion · TypeScript · pnpm.

## Global Constraints

- There is no unit-test suite in this repo. The content "test suite" is the TypeScript compiler: after every task run `pnpm exec tsc --noEmit` (fast) and expect exit 0; `pnpm lint` and `pnpm build` run in the final task.
- Spec: `docs/superpowers/specs/2026-07-03-module1-content-overhaul-design.md`.
- Anthropic model IDs used in content: `claude-sonnet-5` (default in examples), `claude-opus-4-8`, `claude-haiku-4-5`. Never date-suffixed variants.
- OpenAI model ID used in content: `gpt-5.5` (current frontier model, verified 2026-07-03); OpenAI examples use the **Responses API** (`client.responses.create`), noting Chat Completions as the legacy-but-common surface.
- Verified API facts baked into this plan (do not re-derive from memory):
  - Frontier Claude models (Sonnet 5, Opus 4.7/4.8, Fable 5) **reject** `temperature`/`top_p`/`top_k` with a 400. Control is `thinking: {"type": "adaptive"}` + `output_config: {"effort": "low"|"medium"|"high"|...}` (some models add `xhigh`/`max`).
  - Anthropic native structured outputs: `output_config: {"format": {"type": "json_schema", "schema": ...}}`; SDK convenience `client.messages.parse()`. Constrained decoding does **not** support numeric `minimum`/`maximum` or string length constraints — validate those client-side.
  - Strict tool use: `"strict": True` as a **top-level tool-definition field**, requires `"additionalProperties": False` + full `required`.
  - Thinking blocks arriving alongside `tool_use` must be resent verbatim with the assistant turn.
  - New stop reasons: `refusal` (HTTP 200 — check `stop_reason` before reading content; `stop_details` carries a category) and `model_context_window_exceeded` (distinct from `max_tokens`).
  - Prompt caching: reads ≈0.1× input price, writes ≈1.25× (5-min TTL); minimum cacheable prefix is model-dependent (~1K–4K tokens) — shorter prefixes silently don't cache.
  - Responses API tool shape: flat `{"type": "function", "name", "description", "parameters"}`; calls arrive as output items `{"type": "function_call", "call_id", "name", "arguments"}` (arguments is a JSON string); results go back as input items `{"type": "function_call_output", "call_id", "output"}`.
  - Responses API streaming: `stream=True` emits typed events; text arrives as `response.output_text.delta` events.
  - Files API: beta header `files-api-2025-04-14`; upload → `file_id` → reference via `{"type": "document"|"image", "source": {"type": "file", "file_id"}}`.
  - Anthropic docs live at `platform.claude.com` (not `docs.claude.com`).
- Commit after every task with a `feat:`/`fix:`/`content:` prefix and the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `exercise` Section type + Exercise component

**Files:**

- Modify: `lib/types.ts:5-19` (the `Section` union)
- Create: `components/Exercise.tsx`
- Modify: `components/SectionRenderer.tsx` (imports + one new `case`)

**Interfaces:**

- Produces: `Section` union member `{ type: "exercise"; kind: "predict" | "spot-the-bug" | "concept"; prompt: string; code?: string; language?: string; answer: string }` — Tasks 2–7 author content against this exact shape.
- Consumes: existing `CodeBlock` (`components/CodeBlock.tsx`) and `renderInline` (`lib/markdown.tsx`).

- [ ] **Step 1: Add the variant to the `Section` union in `lib/types.ts`**

Insert after the `keypoints` member (line 19), keeping the union's style:

```ts
  | { type: "keypoints"; title?: string; points: string[] }
  | {
      type: "exercise";
      kind: "predict" | "spot-the-bug" | "concept";
      prompt: string; // markdown-lite question
      code?: string; // optional code the question refers to
      language?: string; // language for the code block (default "python")
      answer: string; // markdown-lite, revealed on click
    };
```

- [ ] **Step 2: Create `components/Exercise.tsx`**

```tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { renderInline } from "@/lib/markdown";
import CodeBlock from "./CodeBlock";

type ExerciseKind = "predict" | "spot-the-bug" | "concept";

const KIND_STYLES: Record<ExerciseKind, { label: string; badge: string }> = {
  predict: {
    label: "Predict the output",
    badge: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  },
  "spot-the-bug": {
    label: "Spot the bug",
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  },
  concept: {
    label: "Check yourself",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  },
};

export default function Exercise({
  kind,
  prompt,
  code,
  language,
  answer,
}: {
  kind: ExerciseKind;
  prompt: string;
  code?: string;
  language?: string;
  answer: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const st = KIND_STYLES[kind];

  return (
    <div className="border-border my-6 rounded-xl border bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase ${st.badge}`}
        >
          {st.label}
        </span>
      </div>
      <div className="leading-relaxed text-slate-300">
        {renderInline(prompt)}
      </div>
      {code && <CodeBlock language={language ?? "python"} code={code} />}
      <button
        onClick={() => setRevealed((r) => !r)}
        className="border-border mt-4 rounded-lg border px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
      >
        {revealed ? "Hide answer" : "Reveal answer"}
      </button>
      <AnimatePresence initial={false}>
        {revealed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm leading-relaxed text-slate-300">
              {renderInline(answer)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 3: Wire it into `components/SectionRenderer.tsx`**

Add the import below the existing ones:

```tsx
import Exercise from "./Exercise";
```

Add a case before `default:`:

```tsx
          case "exercise":
            return (
              <Exercise
                key={i}
                kind={s.kind}
                prompt={s.prompt}
                code={s.code}
                language={s.language}
                answer={s.answer}
              />
            );
```

- [ ] **Step 4: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 5: Smoke-render** — temporarily nothing uses the type yet; that's fine (content arrives in Tasks 2–7).

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts components/Exercise.tsx components/SectionRenderer.tsx
git commit -m "feat: add reveal-answer exercise section type and component"
```

---

### Task 2: Lesson 1 refresh — model IDs, raw HTTP, exercises

**Files:**

- Modify: `content/modules/module01.ts` (lesson `messages-are-the-only-state`, plus a global model-ID sweep)

**Interfaces:**

- Consumes: `exercise` Section variant from Task 1.

- [ ] **Step 1: Global model-ID sweep across the whole file**

Replace **all** occurrences of `claude-sonnet-4-5` with `claude-sonnet-5` in `content/modules/module01.ts` (Edit with `replace_all: true`). There are 6 occurrences (lessons 1, 2, 3, 4, 5).

- [ ] **Step 2: Update the tiktoken snippet in the "count before you send" code block**

In the lesson-1 code block titled `count before you send`, replace:

```python
# OpenAI: tiktoken locally
import tiktoken
enc = tiktoken.encoding_for_model("gpt-4o")
n = len(enc.encode("How many tokens is this sentence?"))
```

with:

```python
# OpenAI: tiktoken locally (approximate — encodings lag the newest models)
import tiktoken
enc = tiktoken.get_encoding("o200k_base")
n = len(enc.encode("How many tokens is this sentence?"))
```

- [ ] **Step 3: Insert the raw-HTTP section**

Immediately **after** the first code section (`the entire illusion of conversation`) and **before** the `heading: "The roles"` section, insert:

```ts
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
```

- [ ] **Step 4: Insert a token-math exercise + interview callout before the lesson-1 `keypoints`**

Immediately before lesson 1's `keypoints` section, insert:

```ts
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
```

- [ ] **Step 5: Bump the lesson's `minutes` from `25` to `30`.**

- [ ] **Step 6: Type-check** — `pnpm exec tsc --noEmit`, expect exit 0.

- [ ] **Step 7: Commit**

```bash
git add content/modules/module01.ts
git commit -m "content: refresh lesson 1 — current model IDs, raw HTTP section, exercises"
```

---

### Task 3: Lesson 2 rewrite — sampling, thinking & effort, streaming

**Files:**

- Modify: `content/modules/module01.ts` (lesson `sampling-and-streaming`)

- [ ] **Step 1: Retitle the lesson**

Change `title` to `"Controlling Generation: Sampling, Thinking & Streaming"`, `minutes` from `20` to `25`, and `summary` to:

```ts
      summary:
        "How a token actually gets picked — and how the dials changed. Classic sampling (temperature, top_p) still runs most of the industry, but 2026 frontier models replaced those knobs with adaptive thinking and an effort parameter. Streaming turns dead air into perceived speed.",
```

- [ ] **Step 2: Reframe the sampling list items as provider-dependent**

In the lesson's `list` section, replace the first item

```
"**temperature** (0–1 Anthropic, 0–2 OpenAI): scales the logits before softmax. Near 0 → almost always the top token (near-deterministic, but not perfectly — GPU nondeterminism and ties remain). High → more diverse, more creative, more wrong.",
```

with

```
"**temperature**: scales the logits before softmax. Near 0 → almost always the top token (near-deterministic, but not perfectly — GPU nondeterminism and ties remain). High → more diverse, more creative, more wrong. Ranges vary by provider (0–2 on OpenAI; 0–1 on Anthropic models that still accept it).",
```

- [ ] **Step 3: Replace the "Settings for agents" tip callout**

Replace the entire callout (`kind: "tip"`, title `"Settings for agents"`) with:

```ts
        {
          type: "callout",
          kind: "tip",
          title: "Settings for agents",
          text: "Where sampling parameters exist, tool-calling agents want **low temperature (0–0.3)** — you're asking for precise JSON and correct arguments, not prose flair. But check your model first: on Anthropic's current frontier models there is no temperature to set at all (next section), and 'tuning randomness' stops being part of the job.",
        },
```

- [ ] **Step 4: Insert the thinking/effort section**

Immediately after that callout and before the `heading: "Streaming"` section, insert:

```ts
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
            "The API rejects the request with a **400** — current frontier Claude models removed `temperature`/`top_p`/`top_k` entirely. For output-style control you now use prompting (describe the variety you want), and for how hard the model works you use `output_config: {\"effort\": ...}` with adaptive thinking. Older models (and most other providers) still accept sampling parameters — always check the model's docs rather than assuming the knobs are universal.",
        },
```

- [ ] **Step 5: Update the OpenAI streaming snippet to the Responses API**

In the `streaming with both SDKs` code block, replace the OpenAI half:

```python
# OpenAI
resp = openai_client.chat.completions.create(
    model="gpt-4o", stream=True,
    messages=[{"role": "user", "content": "Explain SSE in one paragraph."}],
)
for chunk in resp:
    delta = chunk.choices[0].delta.content
    if delta:
        print(delta, end="", flush=True)
```

with:

```python
# OpenAI (Responses API — the current primary surface)
stream = openai_client.responses.create(
    model="gpt-5.5", stream=True,
    input="Explain SSE in one paragraph.",
)
for event in stream:
    if event.type == "response.output_text.delta":
        print(event.delta, end="", flush=True)
```

And append one sentence to that block's `explanation`:

```
 On newer Claude models, thinking streams too (as thinking deltas) — surface it as a progress indicator or ignore it, but capture the final message either way.
```

- [ ] **Step 6: Add an interview callout before the lesson's `keypoints`**

```ts
        {
          type: "callout",
          kind: "insight",
          title: "Interview angle",
          text: "Expect \"what does temperature actually do?\" (logit scaling before softmax — not 'creativity magic') followed by \"how do you control a model that doesn't expose it?\" The strong answer covers both eras: distribution-shaping knobs where they exist, thinking/effort budgets on 2026 frontier models, and time-to-first-token as the streaming UX metric.",
        },
```

- [ ] **Step 7: Update the lesson's `keypoints`** — replace the first two points with:

```ts
            "Sampling picks from a probability distribution; temperature scales it, top_p truncates it. Where both exist, tune one.",
            "2026 frontier Claude models removed sampling params (400 if sent) — control is adaptive thinking + `output_config.effort`.",
```

(keep the remaining three points unchanged).

- [ ] **Step 8: Type-check** — `pnpm exec tsc --noEmit`, expect exit 0.

- [ ] **Step 9: Commit**

```bash
git add content/modules/module01.ts
git commit -m "content: rewrite lesson 2 — sampling theory + adaptive thinking/effort, Responses API streaming"
```

---

### Task 4: Lesson 3 — thinking in tool loops, strict mode, parallel calls, Responses API

**Files:**

- Modify: `content/modules/module01.ts` (lesson `tool-calling`)

- [ ] **Step 1: Extend the "two invariants" explanation on the Anthropic tool-loop code block**

Replace, in the explanation of the `complete working tool loop (Anthropic, raw SDK)` block:

```
"Two invariants trip everyone up: the assistant message containing `tool_use` must be resent **verbatim**, and every `tool_result` must reference a real `tool_use_id` from the immediately preceding assistant turn.
```

with:

```
"Three invariants trip everyone up: the assistant message containing `tool_use` must be resent **verbatim** (including any thinking blocks that arrived with it — on thinking-enabled models, reasoning and tool calls travel together), and every `tool_result` must reference a real `tool_use_id` from the immediately preceding assistant turn.
```

(keep the rest of the sentence about 400s unchanged).

- [ ] **Step 2: Replace the OpenAI comparison block with the Responses API shape**

Replace the entire `same dance, different field names` code block's `code` with:

```python
input_list = [{"role": "user", "content": "Should I bike to work in Tokyo today?"}]

resp = openai_client.responses.create(
    model="gpt-5.5",
    input=input_list,
    tools=[{
        "type": "function",              # flat — no nested "function" wrapper
        "name": "get_weather",
        "description": "Get current weather for a city.",
        "parameters": {                  # 'parameters', not 'input_schema'
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    }],
)

for item in resp.output:
    if item.type == "function_call":
        args = json.loads(item.arguments)      # arrives as a STRING — parse it
        input_list.append(item)                # echo the call back, verbatim
        input_list.append({
            "type": "function_call_output",
            "call_id": item.call_id,           # must match!
            "output": get_weather(**args),
        })
# then call responses.create again with the grown input_list
```

and its `explanation` with:

```
"OpenAI's current primary surface is the **Responses API** (the older Chat Completions API is still everywhere in production — know both). Same four-step dance, different plumbing: tool definitions are flat, arguments arrive as a JSON **string** you must parse, calls and results are items in a growing `input` list, and `call_id` pairing is just as strict as Anthropic's `tool_use_id`.
```

- [ ] **Step 3: Insert strict-mode + parallel-calls sections**

Immediately after the OpenAI code block and before the `Tool descriptions are prompts` warning callout, insert:

```ts
        {
          type: "heading",
          text: "Guaranteed-valid arguments: strict mode",
        },
        {
          type: "paragraph",
          text: "By default the model *usually* emits arguments matching your schema. Both providers now offer **strict mode** — constrained decoding that makes conformance a guarantee, not a probability. On Anthropic, set `\"strict\": True` as a top-level field on the tool definition (your schema must set `\"additionalProperties\": False` and list every property in `required`). On OpenAI, it's `\"strict\": True` in the function definition. Use it for every tool whose arguments feed real side effects.",
        },
        {
          type: "paragraph",
          text: "One more production detail: the model can request **several tools in one turn** (parallel tool calls). Execute them all — concurrently if you like — and return **all** the `tool_result` blocks in a **single** user message. Splitting results across multiple messages malforms the history and quietly teaches the model to stop parallelizing.",
        },
        {
          type: "exercise",
          kind: "spot-the-bug",
          prompt:
            "This loop handles a tool-use turn. It runs once, then the second API call fails with a 400. What's wrong?",
          code: `while True:
    resp = client.messages.create(
        model="claude-sonnet-5", max_tokens=1024,
        tools=TOOLS, messages=messages,
    )
    if resp.stop_reason != "tool_use":
        break
    results = []
    for block in resp.content:
        if block.type == "tool_use":
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": run_tool(block.name, block.input),
            })
    messages.append({"role": "user", "content": results})`,
          answer:
            "It never appends the **assistant turn** before the results. The history must read: assistant message containing the `tool_use` blocks (resent verbatim), *then* a user message with matching `tool_result` blocks. Add `messages.append({\"role\": \"assistant\", \"content\": resp.content})` before appending results — otherwise the `tool_result` references an id that doesn't exist in the history, and the API rejects it with a 400.",
        },
```

- [ ] **Step 4: Add an interview callout before lesson 3's `keypoints`**

```ts
        {
          type: "callout",
          kind: "insight",
          title: "Interview angle",
          text: "\"Whiteboard a tool-calling loop\" is the single most common agent-engineering exercise. The invariants they're checking: loop on `stop_reason`, resend the assistant turn verbatim, strict id pairing, all parallel results in one message, errors returned as `tool_result` content so the model can recover, and a max-iteration guard. If you can also say *why* each invariant exists, you're above the bar.",
        },
```

- [ ] **Step 5: Type-check** — `pnpm exec tsc --noEmit`, expect exit 0.

- [ ] **Step 6: Commit**

```bash
git add content/modules/module01.ts
git commit -m "content: lesson 3 — thinking in tool loops, strict mode, parallel calls, Responses API tools"
```

---

### Task 5: Lesson 4 — native structured outputs become primary

**Files:**

- Modify: `content/modules/module01.ts` (lesson `structured-outputs`)

- [ ] **Step 1: Update the rigor table**

Replace the `Schema-enforced` row of the three-level table with these **two** rows (table becomes four levels):

```ts
            [
              "Native structured outputs",
              'Anthropic: `output_config: {format: {type: "json_schema", schema}}` (or `client.messages.parse()`); OpenAI: structured outputs with `strict: true`',
              "Conforms to your schema via constrained decoding. **The current default choice.**",
            ],
            [
              "Forced tool call",
              "A forced tool call whose `input_schema` is your output schema",
              "Same guarantee — the portable fallback for any tool-calling model.",
            ],
```

- [ ] **Step 2: Insert the native structured-outputs example before the tool-trick code block**

```ts
        {
          type: "code",
          language: "python",
          title: "native structured outputs (Anthropic) — the current default",
          code: `TICKET_SCHEMA = {
    "type": "object",
    "properties": {
        "category": {"type": "string",
                     "enum": ["billing", "bug", "feature_request", "other"]},
        "severity": {"type": "integer"},
        "summary":  {"type": "string"},
    },
    "required": ["category", "severity", "summary"],
    "additionalProperties": False,     # required for constrained decoding
}

resp = client.messages.create(
    model="claude-sonnet-5", max_tokens=1024,
    output_config={"format": {"type": "json_schema", "schema": TICKET_SCHEMA}},
    messages=[{"role": "user", "content": f"Classify this ticket: {ticket_text}"}],
)
data = json.loads(resp.content[0].text)   # guaranteed to match the schema`,
          explanation:
            "The SDKs also ship a convenience wrapper (`client.messages.parse()` with a Pydantic/Zod model) that validates for you. One catch: constrained decoding supports enums, `required`, and types — but **not** numeric `minimum`/`maximum` or string-length limits. Keep those in your schema for documentation, but enforce them client-side (next section).",
        },
```

- [ ] **Step 3: Retitle and reframe the forced-tool-call example**

Change that code block's `title` to `"the tool-call trick — the portable fallback"` and replace its `explanation` with:

```
"`tool_choice` forces the call, so the 'tool' is really just an output mold. Before native structured outputs shipped, this *was* the standard Anthropic pattern — and it remains the portable one: it works on any tool-calling model, any provider, any API version. Conceptually it's also what structured outputs desugar to: constrained generation against a schema."
```

- [ ] **Step 4: Add an exercise + interview callout before lesson 4's `keypoints`**

```ts
        {
          type: "exercise",
          kind: "concept",
          prompt:
            "You're building (a) a ticket classifier that outputs `{category, severity}`, and (b) an assistant that must look up order status in a database before answering. Which mechanism fits each — structured output or tool calling — and why?",
          answer:
            "(a) **Structured output**: there's no action to perform, you just need the answer in a shape — one schema-constrained call, no loop. (b) **Tool calling**: the model needs information mid-task that only your code can fetch; it requests `get_order_status`, you execute and return the result, and the model continues. The test is 'does the model need my code to *do* something mid-task?' — if no, don't dress extraction up as an agent.",
        },
        {
          type: "callout",
          kind: "insight",
          title: "Interview angle",
          text: "A favorite systems question: \"the model returns JSON that fails validation in production — walk me through your mitigation ladder.\" The ladder: (1) constrain harder (native structured outputs / strict mode, enums, required); (2) validate with Pydantic/Zod and retry **with the validation error fed back**; (3) fall back to a stronger model or deterministic parser; (4) never silently regex-fix. Bonus points for knowing constrained decoding can't enforce numeric ranges — that's the validator's job.",
        },
```

- [ ] **Step 5: Update lesson 4's `keypoints`** — replace the first point with:

```ts
            "Native structured outputs (constrained decoding) are the default; the forced tool call is the portable fallback; JSON mode only guarantees syntax.",
```

- [ ] **Step 6: Type-check** — `pnpm exec tsc --noEmit`, expect exit 0.

- [ ] **Step 7: Commit**

```bash
git add content/modules/module01.ts
git commit -m "content: lesson 4 — native structured outputs as primary pattern"
```

---

### Task 6: Lesson 5 — new stop reasons, model selection & pricing

**Files:**

- Modify: `content/modules/module01.ts` (lesson `errors-and-resilience`)

- [ ] **Step 1: Fix the typo**

Replace `Retrying a 400 is a infinite loop.` with `Retrying a 400 is an infinite loop.`

- [ ] **Step 2: Update the failure-taxonomy table**

Replace the `Refusal / empty content` row with:

```ts
            [
              '`stop_reason: "refusal"`',
              "HTTP **200**, but the model (or a safety layer) declined; `content` may be empty and `stop_details` carries a category",
              "Check `stop_reason` before reading `content[0]`; surface to the user or route to a fallback model — don't loop blindly",
            ],
            [
              '`model_context_window_exceeded`',
              "The conversation no longer fits the context window (distinct from `max_tokens`, your output cap)",
              "Not retryable as-is — truncate or summarize history (Module 4) and resend",
            ],
```

- [ ] **Step 3: Extend the prompt-caching paragraph**

Append to the paragraph beginning "Agents resend a large, mostly-identical prefix...":

```
 Two mechanics worth memorizing: caching keys on an exact prefix match, and there's a **minimum cacheable prefix** (roughly 1K–4K tokens depending on model) — short prompts silently don't cache at all, with no error.
```

- [ ] **Step 4: Insert the model-selection section**

Immediately after the `Cost discipline from day one` warning callout and before lesson 5's `keypoints`, insert:

```ts
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
          headers: ["Tier", "Anthropic (mid-2026)", "Rough $/MTok in / out", "Reach for it when"],
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
            "An agent sends a 5,000-token system prompt with `cache_control` on it, but the prompt template starts with `f\"Current time: {datetime.now()}. You are...\"`. What do `cache_read_input_tokens` show across turns, and what's the fix?",
          answer:
            "**Zero reads, every turn.** Caching is an exact prefix match — the timestamp changes every request, so the prefix never matches and you pay the cache-*write* premium repeatedly while reading nothing. Fix: keep the system prompt byte-stable and inject volatile context (time, user state) later in the message list, after the cache breakpoint. Structure requests stable-first, volatile-last.",
        },
        {
          type: "callout",
          kind: "insight",
          title: "Interview angle",
          text: "Cost questions separate seniors from juniors: \"your agent's API bill is 10× budget — walk me through the audit.\" Order of attack: log `usage` per call (you can't fix what you can't see) → check for accidental payload resends → prompt caching on the stable prefix → route stages to cheaper tiers → cap sessions with hard budgets. Model routing is usually the biggest single win.",
        },
```

- [ ] **Step 5: Bump lesson 5's `minutes` from `25` to `30`, and append one keypoint:**

```ts
            "Model routing (cheap tier for routine stages, flagship only where it matters) is the biggest cost lever — bigger than caching.",
```

- [ ] **Step 6: Type-check** — `pnpm exec tsc --noEmit`, expect exit 0.

- [ ] **Step 7: Commit**

```bash
git add content/modules/module01.ts
git commit -m "content: lesson 5 — refusal/context-window stop reasons, model selection and routing"
```

---

### Task 7: New Lesson 6 — "Beyond Text: Images, PDFs & Files"

**Files:**

- Modify: `content/modules/module01.ts` (append a sixth lesson object to `lessons`)

- [ ] **Step 1: Append this complete lesson after lesson 5 (`errors-and-resilience`)**

```ts
    {
      slug: "multimodal-inputs",
      title: "Beyond Text: Images, PDFs & Files",
      minutes: 15,
      summary:
        "Real agent tasks aren't text-only: screenshots in bug reports, invoices as PDFs, documents to extract from. Multimodal input is just more content-block types in the same messages array.",
      sections: [
        {
          type: "paragraph",
          text: "Everything in this module so far sent `content` as a string. The full truth: `content` is a **list of typed blocks**, and text is only one block type. Add an `image` or `document` block and the same stateless, resend-the-array machinery now carries screenshots and PDFs. No new endpoint, no new mental model.",
        },
        {
          type: "code",
          language: "python",
          title: "images: base64 or URL blocks in a user message",
          code: `import base64

img_b64 = base64.standard_b64encode(open("error.png", "rb").read()).decode()

resp = client.messages.create(
    model="claude-sonnet-5", max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {"type": "image",
             "source": {"type": "base64",
                        "media_type": "image/png", "data": img_b64}},
            # or, if it's already hosted:
            # {"type": "image", "source": {"type": "url", "url": "https://..."}},
            {"type": "text", "text": "What's the error in this screenshot, and the likely fix?"},
        ],
    }],
)`,
          explanation:
            "Put media blocks **before** the text that asks about them. Images are billed as input tokens — on the order of ~1,500 tokens for a typical image, more at high resolution — so an image-heavy conversation eats the context window fast. Resize client-side when full fidelity isn't needed.",
        },
        {
          type: "paragraph",
          text: "PDFs work the same way with a `document` block — the model sees both the text layer and the rendered pages, so tables, stamps, and layout survive. This is the workhorse for extraction jobs: invoices, contracts, reports.",
        },
        {
          type: "code",
          language: "python",
          title: "PDFs: document blocks + structured extraction",
          code: `pdf_b64 = base64.standard_b64encode(open("invoice.pdf", "rb").read()).decode()

resp = client.messages.create(
    model="claude-sonnet-5", max_tokens=2048,
    output_config={"format": {"type": "json_schema", "schema": {
        "type": "object",
        "properties": {
            "line_items": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "qty": {"type": "integer"},
                    "unit_price": {"type": "number"},
                },
                "required": ["description", "qty", "unit_price"],
                "additionalProperties": False,
            }},
        },
        "required": ["line_items"],
        "additionalProperties": False,
    }}},
    messages=[{
        "role": "user",
        "content": [
            {"type": "document",
             "source": {"type": "base64",
                        "media_type": "application/pdf", "data": pdf_b64}},
            {"type": "text", "text": "Extract every line item."},
        ],
    }],
)`,
          explanation:
            "Notice the combo: a `document` block **plus** structured outputs from Lesson 4 — multimodal extraction with a guaranteed shape is the pattern behind half of real-world document automation. Mind the limits (tens of MB per request, page caps per model) and count tokens on big documents before sending.",
        },
        {
          type: "paragraph",
          text: "Inlining base64 is fine for one-shot calls, but an agent that consults the same 200-page handbook every session would resend megabytes per call. The **Files API** fixes that: upload once, get a `file_id`, reference it by id in any later request.",
        },
        {
          type: "code",
          language: "python",
          title: "Files API: upload once, reference forever",
          code: `# upload once (beta header required at the time of writing)
f = client.beta.files.upload(file=open("handbook.pdf", "rb"))

# reference by id in any later request — no re-upload, no base64
resp = client.beta.messages.create(
    model="claude-sonnet-5", max_tokens=1024,
    betas=["files-api-2025-04-14"],
    messages=[{
        "role": "user",
        "content": [
            {"type": "document", "source": {"type": "file", "file_id": f.id}},
            {"type": "text", "text": "What does the vacation policy say?"},
        ],
    }],
)`,
          explanation:
            "Rule of thumb: **inline base64** for one-off inputs, **URL** for already-hosted images, **Files API** for anything reused across requests or sessions. The file content still counts as input tokens each call — the Files API saves upload bandwidth and request size, not token cost (prompt caching handles that part).",
        },
        {
          type: "exercise",
          kind: "concept",
          prompt:
            "Three inputs: (a) a screenshot a user just pasted into your support bot, (b) a product image already on your CDN, (c) a 300-page compliance manual your agent consults on every run. Base64, URL, or Files API for each — and which one still needs prompt caching to be economical?",
          answer:
            "(a) **base64** — it's a one-off blob you already hold in memory. (b) **URL** — it's hosted; let the provider fetch it. (c) **Files API** — upload once, reference by `file_id`. But (c) still bills its tokens as input on *every* call, so pair the `file_id` reference with **prompt caching** (stable prefix) to cut the repeated cost by ~90%. Files API solves re-uploading; caching solves re-processing.",
        },
        {
          type: "callout",
          kind: "insight",
          title: "Interview angle",
          text: "Multimodal questions are usually cost questions in disguise: \"design a pipeline that processes 10K invoices/day.\" Strong answers combine this lesson's blocks — document input + structured outputs + a cheap model tier + batching — and mention the failure modes: page limits, image token costs, and validating extracted numbers client-side.",
        },
        {
          type: "keypoints",
          points: [
            "`content` is a list of typed blocks — images and PDFs are just more block types in the same stateless array.",
            "Media blocks go before the text that references them; images cost real input tokens (~1.5K+ each).",
            "`document` blocks + structured outputs = schema-guaranteed extraction, the core document-automation pattern.",
            "Base64 for one-offs, URL for hosted media, Files API (`file_id`) for anything reused — plus caching for repeated token cost.",
            "Check per-model limits (request size, page caps) and count tokens before sending large documents.",
          ],
        },
      ],
    },
```

- [ ] **Step 2: Type-check** — `pnpm exec tsc --noEmit`, expect exit 0.

- [ ] **Step 3: Commit**

```bash
git add content/modules/module01.ts
git commit -m "content: add lesson 6 — multimodal inputs (images, PDFs, Files API)"
```

---

### Task 8: Quiz audit + additions, lab stretch goal, resources, module metadata

**Files:**

- Modify: `content/modules/module01.ts` (`quiz`, `lab`, `resources`, `description`, `outcomes`)

- [ ] **Step 1: Rewrite the sampling quiz question**

Replace the question object beginning `"What do temperature and top_p do, and what suits a tool-calling agent?"` with:

```ts
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
```

- [ ] **Step 2: Append four new quiz questions**

```ts
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
```

- [ ] **Step 3: Add the lab stretch goal**

In `lab.stretchGoals`, insert before the "Practical test" item:

```ts
      "Add a --think flag that enables adaptive thinking (thinking={'type': 'adaptive'}) and prints the model's reasoning summary before the final answer",
```

- [ ] **Step 4: Update resources**

- Change the Anthropic tool-use docs URL from `https://docs.claude.com/en/docs/build-with-claude/tool-use` to `https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview`.
- Append one resource:

```ts
    {
      title: "OpenAI — Migrate to the Responses API",
      url: "https://platform.openai.com/docs/guides/migrate-to-responses",
      description:
        "Chat Completions vs. Responses API, side by side — interviews still ask about both surfaces.",
      kind: "docs",
    },
```

- [ ] **Step 5: Update module `description` and `outcomes`**

Replace `description` with:

```ts
  description:
    "No frameworks. Raw HTTP/SDK calls only. Everything an agent does reduces to these mechanics: the message array, tool calling, structured outputs, thinking & effort, streaming, multimodal input, tokens, and robust error handling.",
```

Append two `outcomes`:

```ts
    "Enable adaptive thinking, tune effort, and explain why frontier models replaced sampling parameters",
    "Send images and PDFs as content blocks and combine document input with structured outputs for extraction",
```

- [ ] **Step 6: Type-check** — `pnpm exec tsc --noEmit`, expect exit 0.

- [ ] **Step 7: Commit**

```bash
git add content/modules/module01.ts
git commit -m "content: module 1 quiz additions, lab stretch goal, resources, metadata"
```

---

### Task 9: Final verification

- [ ] **Step 1: Lint** — Run `pnpm lint`. Expected: exit 0 (warnings acceptable if pre-existing, no new errors).
- [ ] **Step 2: Build** — Run `pnpm build`. Expected: successful production build, no type errors.
- [ ] **Step 3: Manual walkthrough** — Run `pnpm dev`, open `http://localhost:3000/modules/llm-api-mastery` and verify: 6 lessons listed; each lesson renders (especially exercises: badge, reveal/hide toggle animates, code inside exercises highlights); quiz shows 16 questions; lab shows the new stretch goal; resources show the new OpenAI entry. Fix anything broken, re-run build, and commit fixes.
- [ ] **Step 4: Final commit** (if fixes were needed) with message `fix: module 1 overhaul polish after walkthrough`.
