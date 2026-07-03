import type { Lesson } from "@/lib/types";

export const lesson01: Lesson = {
  slug: "the-loop-that-makes-an-agent",
  title: "The Loop That Makes an Agent",
  minutes: 25,
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
      title: "a complete agent in ~40 lines (raw Anthropic SDK)",
      code: `import anthropic

client = anthropic.Anthropic()
MODEL = "claude-sonnet-4-5"

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
    },
    {
      type: "callout",
      kind: "insight",
      text: "Memorize this shape: `while not done: response = llm(messages + tools); if tool_calls: execute, append results; else: done`. **Everything else in agent engineering is guardrails around this loop** — termination, budgets, context discipline, tracing, recovery. When a framework shows you an 'AgentExecutor', this loop is what's inside.",
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
    },
    {
      type: "keypoints",
      points: [
        "Agent = LLM + tools + loop, with **the model choosing the path**. Chatbot/workflow = your code chooses.",
        "The loop is: call model → if `tool_use`, execute and append results → repeat → else return the text.",
        "The model can emit several tool calls per turn — answer all of them; they're safe to parallelize.",
        "Flexibility costs you: unknown iteration count means unknown cost, latency, and new failure modes.",
        "Everything that follows in this module is guardrails bolted onto this one loop.",
      ],
    },
  ],
};
