import type { Lesson } from "@/lib/types";

export const lesson01: Lesson = {
  slug: "what-frameworks-actually-buy-you",
  title: "What Frameworks Actually Buy You",
  minutes: 25,
  summary:
    "You built the loop, memory, retries, and tracing by hand in Modules 1–4. That was the point: now you can evaluate a framework's version of each instead of trusting it blindly. LangGraph's pitch in one sentence: your agent loop, reified as a graph with persistent state.",
  sections: [
    {
      type: "paragraph",
      text: 'Every framework is selling you the same list of things — and you have personally implemented all of them from raw SDK calls. That changes how you read the marketing. The question is never "can LangGraph do X?" but "is LangGraph\'s X better than the 40 lines I\'d write myself, and what do I give up in debuggability to get it?" **Frameworks are a trade: less plumbing code for more abstraction between you and the API calls.** Sometimes that trade is excellent. Sometimes you spend a day discovering that a retry you didn\'t know existed was silently re-running a non-idempotent tool.',
    },
    {
      type: "table",
      headers: [
        "Capability",
        "Your hand-rolled version (Modules 1–4)",
        "What LangGraph gives you",
      ],
      rows: [
        [
          "State management",
          "A messages list plus ad-hoc dicts",
          "A typed, shared state schema every node reads and writes",
        ],
        [
          "Checkpointing / resume",
          "Probably nothing — crash = start over",
          "A checkpointer persists state after every step; resume by thread ID",
        ],
        [
          "Retries",
          "Backoff-with-jitter wrapper",
          "Configurable retry policies per node",
        ],
        [
          "Streaming",
          "SSE deltas from one call",
          "Streamed events across the whole graph: node starts, state updates, tokens",
        ],
        [
          "Human-in-the-loop",
          "input() hacks that block the process",
          "Durable interrupts: graph pauses, process can exit, resume days later",
        ],
        [
          "Tracing",
          "Your JSONL logger",
          "Hooks/integrations that record every node execution and state transition",
        ],
      ],
    },
    {
      type: "callout",
      kind: "insight",
      text: "The framework's real product is the **checkpointer**. Everything distinctive about LangGraph — resume after crash, time-travel debugging, durable human-in-the-loop — falls out of one design decision: persist the full graph state after every step. A bare while-loop keeps state in process memory; kill the process and it's gone. That single difference justifies most of the abstraction cost.",
    },
    {
      type: "heading",
      text: "The LangGraph mental model",
    },
    {
      type: "paragraph",
      text: "A LangGraph program is a **directed graph**. **Nodes** are plain Python functions that receive the current state and return a partial update. **Edges** say which node runs next — fixed edges always go the same way; conditional edges call a routing function that inspects state and picks a destination. A **state schema** (a `TypedDict` or Pydantic model) is the contract every node shares. You build the graph, `compile()` it, then `invoke()` or `stream()` it like any callable. Under the hood it's still the loop you wrote in Module 1 — call model, act, update state, decide what's next — but the control flow is now declared as data instead of buried in if-statements.",
    },
    {
      type: "animation",
      name: "agent-loop",
      caption:
        "Same loop you hand-built in Module 1 — LangGraph just reifies each step as a node and persists state between them.",
    },
    {
      type: "code",
      language: "python",
      title: "the smallest real LangGraph",
      code: `from typing import TypedDict

from langgraph.graph import StateGraph, START, END


class State(TypedDict):
    question: str
    draft: str
    approved: bool


def write_draft(state: State) -> dict:
    # call your model here (Module 1 skills); stubbed for clarity
    return {"draft": f"Draft answer to: {state['question']}"}


def review(state: State) -> dict:
    return {"approved": len(state["draft"]) > 10}


builder = StateGraph(State)
builder.add_node("write_draft", write_draft)
builder.add_node("review", review)
builder.add_edge(START, "write_draft")
builder.add_edge("write_draft", "review")
builder.add_edge("review", END)

graph = builder.compile()
result = graph.invoke({"question": "What is a checkpointer?"})
print(result["draft"], result["approved"])`,
      explanation:
        'Three things to internalize: nodes are ordinary functions (testable in isolation, no framework needed); nodes return **partial** updates (`{"draft": ...}`), not the whole state — LangGraph merges them in; and `START`/`END` are sentinel nodes marking entry and exit. `invoke()` runs the graph to completion and returns the final state.',
    },
    {
      type: "code",
      language: "python",
      title: "watching it run: stream instead of invoke",
      code: `# stream_mode="updates" yields each node's state delta as it executes —
# this is your first inter-agent trace, for free.
for step in graph.stream({"question": "What is a checkpointer?"},
                         stream_mode="updates"):
    print(step)

# {'write_draft': {'draft': 'Draft answer to: What is a checkpointer?'}}
# {'review': {'approved': True}}

# stream_mode="values" yields the FULL state after each step instead,
# which is handier when you want to inspect accumulated fields.`,
      explanation:
        "`stream()` is how you debug graphs and how you build UIs that show progress node-by-node. Log these updates to JSONL and you have an execution trace of the whole system — the habit from Module 3 carries straight over, one level up.",
    },
    {
      type: "callout",
      kind: "warning",
      title: "The framework tax",
      text: "Abstraction cuts both ways. When a graph misbehaves you're now debugging through the framework's execution engine, not your own 30-line loop. Mitigations: keep nodes small and pure enough to unit-test without the graph; log every state transition; and keep your Module 1 raw-SDK skills sharp — when a framework behavior confuses you, reproduce it with a raw call to see what's actually hitting the API.",
    },
    {
      type: "keypoints",
      points: [
        "Frameworks package what you already built: state, checkpointing, retries, streaming, HITL, tracing. Evaluate, don't worship.",
        "LangGraph = nodes (functions) + edges (control flow) + a shared typed state schema, compiled into a runnable.",
        "Nodes return **partial state updates**; the framework merges them.",
        "The checkpointer is the killer feature — durable state after every step enables resume, time-travel, and HITL.",
        '`stream(stream_mode="updates")` gives per-node traces for free — log them from day one.',
      ],
    },
  ],
};
