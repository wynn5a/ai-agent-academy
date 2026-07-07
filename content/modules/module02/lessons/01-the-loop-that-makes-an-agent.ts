import type { Lesson } from "@/lib/types";

export const lesson01: Lesson = {
  slug: "the-loop-that-makes-an-agent",
  title: "The Loop That Makes an Agent",
  minutes: 35,
  summary:
    "A chatbot maps one input to one output. An agent runs a loop where the model itself decides which tools to call, in what order, until the task is done. The loop is ~20 lines; everything else in this module is guardrails around it.",
  sections: [
    {
      type: "paragraph",
      text: "In Module 1 you built one tool-use round trip. The jump to an **agent** is smaller than the hype suggests: you put that round trip inside a `while` loop and let the model keep going. The defining property is **who chooses the control flow**. In a chatbot (or a workflow), your code decides what happens next. In an agent, the *model* decides — which tool, which arguments, whether to keep digging or stop. Same API, radically different system behavior.",
    },
    {
      type: "table",
      headers: ["Dimension", "Chatbot", "Agent"],
      rows: [
        [
          "Control flow",
          "One request → one response; your code owns every step",
          "Model picks the next action each iteration; path emerges at runtime",
        ],
        [
          "Tool calls",
          "Zero or one, hardcoded by you",
          "Zero to many, sequenced by the model",
        ],
        [
          "Cost & latency",
          "Predictable: one call",
          "Variable: N calls, unknown N until it runs",
        ],
        [
          "Failure surface",
          "Bad answer",
          "Bad answer, infinite loops, runaway cost, wrong tool spirals",
        ],
        [
          "When it shines",
          "The path is known in advance",
          "The path can't be predetermined (research, debugging, open-ended tasks)",
        ],
      ],
    },
    {
      type: "animation",
      name: "agent-loop",
      caption:
        "The loop: LLM → tool call → your code executes → result back into messages → LLM again, until the model stops asking for tools.",
    },
    {
      type: "heading",
      text: "The canonical loop",
    },
    {
      type: "code",
      language: "python",
      title: "a complete agent in ~55 lines (raw Anthropic SDK)",
      code: `import anthropic

client = anthropic.Anthropic()
MODEL = "claude-sonnet-5"

TOOLS = [
    {
        "name": "search_notes",
        "description": (
            "Search the local notes database for a keyword. Use whenever the "
            "user asks about anything that might live in their notes. "
            "Returns up to 5 matching snippets with note ids."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    {
        "name": "read_note",
        "description": "Read one note in full, by id from search_notes results.",
        "input_schema": {
            "type": "object",
            "properties": {"note_id": {"type": "string"}},
            "required": ["note_id"],
        },
    },
]

def search_notes(query: str) -> str: ...   # your implementations
def read_note(note_id: str) -> str: ...

IMPL = {"search_notes": search_notes, "read_note": read_note}

def run_agent(question: str, max_iterations: int = 10) -> str:
    messages = [{"role": "user", "content": question}]
    for _ in range(max_iterations):
        resp = client.messages.create(
            model=MODEL, max_tokens=2048,
            tools=TOOLS, messages=messages,
        )
        if resp.stop_reason != "tool_use":
            return resp.content[0].text          # model chose to stop

        messages.append({"role": "assistant", "content": resp.content})
        results = []
        for block in resp.content:
            if block.type == "tool_use":
                output = IMPL[block.name](**block.input)
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": output,
                })
        messages.append({"role": "user", "content": results})
    raise RuntimeError("max iterations exceeded")   # we'll fix this in lesson 4`,
      explanation:
        "Read the loop body slowly — it's the same four-step dance from Module 1, just repeated. Notice what's *absent*: no if/else deciding whether to search first or read first. The model sequences the tools itself by reading the schemas and the accumulating results. The `for` instead of `while True` is your first guardrail; raising on exhaustion is bad manners we'll replace with graceful degradation in lesson 4.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `import json
from openai import OpenAI

client = OpenAI()
MODEL = "gpt-5.5"

TOOLS = [
    {
        "type": "function",
        "name": "search_notes",
        "description": (
            "Search the local notes database for a keyword. Use whenever the "
            "user asks about anything that might live in their notes. "
            "Returns up to 5 matching snippets with note ids."
        ),
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    {
        "type": "function",
        "name": "read_note",
        "description": "Read one note in full, by id from search_notes results.",
        "parameters": {
            "type": "object",
            "properties": {"note_id": {"type": "string"}},
            "required": ["note_id"],
        },
    },
]

def search_notes(query: str) -> str: ...   # your implementations
def read_note(note_id: str) -> str: ...

IMPL = {"search_notes": search_notes, "read_note": read_note}

def run_agent(question: str, max_iterations: int = 10) -> str:
    input_items = [{"role": "user", "content": question}]
    for _ in range(max_iterations):
        resp = client.responses.create(
            model=MODEL, input=input_items, tools=TOOLS,
        )
        calls = [item for item in resp.output if item.type == "function_call"]
        if not calls:
            return resp.output_text              # model chose to stop

        for call in calls:
            output = IMPL[call.name](**json.loads(call.arguments))
            input_items.append(call)             # echo the call back
            input_items.append({
                "type": "function_call_output",
                "call_id": call.call_id,
                "output": output,
            })
    raise RuntimeError("max iterations exceeded")   # we'll fix this in lesson 4`,
          explanation:
            'Same loop, inverted termination signal: Anthropic says done via `stop_reason != "tool_use"`, while the Responses API says done by returning **no `function_call` items** in `resp.output`. Other mechanical differences: tool schemas use `parameters` (not `input_schema`), arguments arrive as a JSON string you must `json.loads`, results go back as `function_call_output` input items (after echoing the call), and `max_output_tokens` is optional where Anthropic\'s `max_tokens` is required.',
        },
      ],
    },
    {
      type: "callout",
      kind: "insight",
      text: "Memorize this shape: `while not done: response = llm(messages + tools); if tool_calls: execute, append results; else: done`. **Everything else in agent engineering is guardrails around this loop** — termination, budgets, context discipline, tracing, recovery. When a framework shows you an 'AgentExecutor', this loop is what's inside.",
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "The loop above ships, works for weeks — then you enable adaptive thinking on the model and every run crashes with `AttributeError: 'ThinkingBlock' object has no attribute 'text'`. Where's the latent bug?",
      code: `if resp.stop_reason != "tool_use":
    return resp.content[0].text          # model chose to stop`,
      answer:
        '`resp.content[0]` assumes the first content block is text. On thinking-enabled models the response often *starts with a thinking block*, so `content[0]` has no `.text`. The bug was always latent — content is a **list of typed blocks** (Module 1, Lesson 6), and position is never a contract. Robust extraction: `next(b.text for b in resp.content if b.type == "text")`, with a sensible fallback if no text block exists. The senior habit this trains: iterate content by block *type*, everywhere, always — the block mix changes across models and features, and positional indexing is how upgrades break agents.',
    },
    {
      type: "heading",
      text: "The inner loop lives inside an outer conversation",
    },
    {
      type: "paragraph",
      text: "A distinction that sounds pedantic until an interviewer probes it: **the agent loop runs entirely within one user turn**. The user asks a question; your loop makes N model calls (each a full stateless request!); the user sees one answer. When they ask a follow-up, you append it to the *same* messages array — tool calls, results, and all — and the inner loop starts again with that history as context. Two design consequences: the follow-up turn inherits every token of the previous turn's tool spelunking (context cost compounds across user turns, which is why Lesson 5's compaction exists), and your termination budgets (Lesson 4) should be **per user turn**, not per conversation — a fresh question deserves a fresh budget.",
    },
    {
      type: "heading",
      text: "Watch the path emerge",
    },
    {
      type: "code",
      language: "python",
      title: "instrument the loop and the dynamic path becomes visible",
      code: `def run_with_trace(question: str, max_iterations: int = 10) -> str:
    messages = [{"role": "user", "content": question}]
    for i in range(max_iterations):
        resp = client.messages.create(
            model=MODEL, max_tokens=2048, tools=TOOLS, messages=messages,
        )
        if resp.stop_reason != "tool_use":
            print(f"[{i}] final answer after {i} tool iterations")
            return resp.content[0].text

        messages.append({"role": "assistant", "content": resp.content})
        results = []
        for block in resp.content:
            if block.type == "tool_use":
                print(f"[{i}] model chose: {block.name}({block.input})")
                output = IMPL[block.name](**block.input)
                print(f"[{i}]   -> {len(output)} chars back")
                results.append({"type": "tool_result",
                                "tool_use_id": block.id, "content": output})
        messages.append({"role": "user", "content": results})
    raise RuntimeError("max iterations exceeded")

# Run 1: "What did I write about backoff?"
#   [0] model chose: search_notes({'query': 'backoff'})
#   [1] model chose: read_note({'note_id': 'n042'})
#   [2] final answer after 2 tool iterations
#
# Run 2: "Summarize my notes on rate limits AND caching"
#   [0] model chose: search_notes({'query': 'rate limits'})
#   [0] model chose: search_notes({'query': 'caching'})     # parallel!
#   [1] model chose: read_note({'note_id': 'n042'})
#   [1] model chose: read_note({'note_id': 'n107'})
#   [2] final answer after 2 tool iterations`,
      explanation:
        "Two things to internalize from the sample traces: the path differs per question with zero code changes (that's the agent-ness), and the model may request **multiple tool calls in a single turn** — your executor must answer every one of them, and can run them concurrently since they arrived together.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `import json

def run_with_trace(question: str, max_iterations: int = 10) -> str:
    input_items = [{"role": "user", "content": question}]
    for i in range(max_iterations):
        resp = client.responses.create(
            model=MODEL, input=input_items, tools=TOOLS,
        )
        calls = [item for item in resp.output if item.type == "function_call"]
        if not calls:
            print(f"[{i}] final answer after {i} tool iterations")
            return resp.output_text

        for call in calls:
            args = json.loads(call.arguments)
            print(f"[{i}] model chose: {call.name}({args})")
            output = IMPL[call.name](**args)
            print(f"[{i}]   -> {len(output)} chars back")
            input_items.append(call)
            input_items.append({"type": "function_call_output",
                                "call_id": call.call_id, "output": output})
    raise RuntimeError("max iterations exceeded")

# Run 1: "What did I write about backoff?"
#   [0] model chose: search_notes({'query': 'backoff'})
#   [1] model chose: read_note({'note_id': 'n042'})
#   [2] final answer after 2 tool iterations
#
# Run 2: "Summarize my notes on rate limits AND caching"
#   [0] model chose: search_notes({'query': 'rate limits'})
#   [0] model chose: search_notes({'query': 'caching'})     # parallel!
#   [1] model chose: read_note({'note_id': 'n042'})
#   [1] model chose: read_note({'note_id': 'n107'})
#   [2] final answer after 2 tool iterations`,
          explanation:
            "Identical traces, identical lesson — the only mechanics that change are collecting `function_call` items from `resp.output` and parsing each call's `arguments` from a JSON string before dispatch.",
        },
      ],
    },
    {
      type: "exercise",
      kind: "predict",
      prompt:
        'Run 3: the user asks "What did I write about Kubernetes?" — but there are no Kubernetes notes at all, so `search_notes` returns an empty list. Predict the plausible trajectories through the loop, from best to worst.',
      answer:
        "**Best:** the model tries one or two query variations (`k8s`, `kubernetes deployment`), gets empty results each time, and answers honestly: 'I found no notes about Kubernetes.' **Common:** it burns several iterations on near-identical queries before giving up — wasted spend, correct answer. **Worst:** it stops searching and *hallucinates* a plausible summary of notes that don't exist — because an empty result gives it nothing to ground on and nothing forbidding invention. The lesson: **absence of evidence needs to be an explicit observation.** Return `\"No results for 'kubernetes'. The notes database contains topics like: rate limits, caching, backoff.\"` instead of `[]` — a model told what *does* exist stops guessing about what doesn't. This 'empty result → hallucination' trajectory is a favorite interview probe because the fix is tool design, not prompting.",
    },
    {
      type: "callout",
      kind: "insight",
      title: "Interview angle",
      text: '"What *is* an agent?" deserves a one-sentence answer with teeth: **an LLM calling tools in a loop, where the model — not your code — decides the next action.** Then immediately name the price of that autonomy: unknown iteration count → unknown cost, latency, and a new failure surface (spirals, runaway spend, hallucinated grounding). Interviewers are listening for whether you volunteer the *costs* unprompted; the definition alone is the junior half of the answer.',
    },
    {
      type: "callout",
      kind: "career",
      title: "This loop is the job description",
      text: "Across 2026 agentic job postings, \"design agents that autonomously plan, call tools, and complete multi-step tasks\" is the single most recurring responsibility line — and the market behind it is real: **AI Engineer is LinkedIn's #1 fastest-growing US job title for 2026**, with the Agentic AI skill cluster up roughly **280% year over year** (~90K US postings). Being able to write this ~40-line loop from memory, in either provider's SDK, is the table stakes those postings are describing; the guardrails in lessons 4–5 are what make it a *senior* answer.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** Your team's chatbot answers from a fixed RAG pipeline today. Product wants it to 'become an agent.' What actually changes in the code, and what new failure modes must you handle before shipping?",
      answer:
        'Code change is deceptively small: expose retrieval (and whatever else) as *tools*, put the tool round-trip in a loop, let the model sequence calls — control flow moves from your `if/else` into the model\'s choices. The real work is the new failure surface, and listing it unprompted is the senior signal: (1) **unbounded iteration** — needs caps, cost budgets, deadlines (Lesson 4); (2) **variable latency** — the UX must show progress, because p95 goes from 2s to 30s; (3) **tool spirals** — repeated failing calls need escalating defenses (Lesson 5); (4) **emergent paths** — debugging needs per-run traces, not request logs; (5) **cost variance** — per-query cost goes from constant to a distribution; finance will ask. Then the counter-question that scores points: *does the path actually vary per query?* If 90% of queries take the same retrieve→answer path, the chatbot was already the right architecture — agent-ify the 10% behind a router. **Follow-up probe:** "how do you prove the agent beats the pipeline?" → offline eval set + A/B on quality, cost, latency — never vibes.',
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** In the traced Run 2, the model issued two `search_notes` calls in one turn, then two `read_note` calls the next turn. An interviewer asks: "why didn\'t it issue all four at once, and what does that tell you about parallelism in agent loops?"',
      answer:
        "Because the second pair **depends on the first pair's output** — the model can't know which note ids to read until search results come back. Parallelism in an agent loop is bounded by the *data dependency graph*, and the model discovers that graph as it goes: independent calls batch into one turn (both searches), dependent calls must wait an iteration. Three things this implies for your harness: (1) execute same-turn calls concurrently — they're independent by construction, the model asked for them together; (2) you can't 'optimize' cross-turn sequencing from the outside without breaking causality; (3) latency floor = depth of the dependency chain × (model latency + tool latency), so reducing *chain depth* (better tools that answer in one hop, e.g. `search_and_read`) beats making individual calls faster. **Follow-up probe:** \"when would you merge search+read into one tool?\" → when traces show the pair is nearly always called in sequence — that's a workflow hiding inside your agent.",
    },
    {
      type: "keypoints",
      points: [
        "Agent = LLM + tools + loop, with **the model choosing the path**. Chatbot/workflow = your code chooses.",
        "The loop is: call model → if `tool_use`, execute and append results → repeat → else return the text.",
        "The model can emit several tool calls per turn — answer all of them; they're safe to parallelize. Cross-turn sequencing is the model's data-dependency discovery — don't fight it.",
        "Extract the final answer by block *type*, never by position — `content[0].text` breaks the day thinking blocks appear.",
        "Empty tool results invite hallucination — return what *does* exist, not `[]`.",
        "The agent loop runs inside one user turn; budgets are per-turn, and context inherited across turns is why compaction exists.",
        "Flexibility costs you: unknown iteration count means unknown cost, latency, and new failure modes.",
        "Everything that follows in this module is guardrails bolted onto this one loop.",
      ],
    },
  ],
};
