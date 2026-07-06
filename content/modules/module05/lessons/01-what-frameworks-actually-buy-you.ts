import type { Lesson } from "@/lib/types";

export const lesson01: Lesson = {
  slug: "what-frameworks-actually-buy-you",
  title: "What Frameworks Actually Buy You",
  minutes: 35,
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
      type: "callout",
      kind: "career",
      text: "LangChain and LangGraph appear among LinkedIn's own most-commonly-listed skills for AI engineer roles — the #1 fastest-growing US job title in LinkedIn's 2026 report — and one job-market analysis found the LangChain ecosystem named in roughly 40% of agentic-AI postings (a single-source estimate, but directionally consistent with everything else). AutoGen and CrewAI are the other frameworks that show up by name. The differentiator in interviews isn't listing frameworks, though: it's this lesson's skill — itemizing the abstraction tax and saying precisely when the checkpointer's guarantees justify paying it.",
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
    # call your model here (Module 1 skills); stubbed for clarity.
    # in real code: model = init_chat_model("anthropic:claude-sonnet-5")
    # or:           model = init_chat_model("openai:gpt-5.5")  # one-string swap
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
      type: "heading",
      text: "The abstraction tax, itemized",
    },
    {
      type: "paragraph",
      text: "\"Framework tax\" isn't one cost — it's four, and a senior engineer names them individually instead of waving at \"complexity.\" **Debugging through layers**: a bug can live in your node, in LangGraph's execution engine, or in the interaction between them, and the stack trace rarely tells you which. **Prompt opacity**: helper methods like structured-output wrappers or message-formatting utilities can append instructions, retries, or reformatting you never wrote — and **you can't fix what you can't see the model receiving**. If you can't produce the exact string of text and images sent to the API for a given call, you are debugging blind. **Lock-in**: your state schema, node signatures, and checkpoint format are now shaped by the framework's conventions; migrating off later means rewriting the graph, not just swapping an import. **Version churn**: the fan-out dispatch API and the interrupt API you'll use in this module have both changed shape across LangGraph versions — code from a six-month-old tutorial may not compile against your installed version.",
    },
    {
      type: "table",
      headers: ["Tax", "What it costs you", "Mitigation"],
      rows: [
        [
          "Debugging through layers",
          "A bug can be yours, the framework's, or the interaction — the trace doesn't say which",
          "Keep nodes as plain, unit-testable functions; reproduce suspicious behavior with a raw SDK call before blaming your prompt",
        ],
        [
          "Prompt opacity",
          "Can't fix what you can't see the model receiving",
          "Enable the framework's debug/verbose tracing or callback hooks; if that's not enough, wrap the model client yourself and pass the wrapped client in, so every call funnels through code you control",
        ],
        [
          "Lock-in",
          "State schema, node signatures, and checkpoint format are framework-shaped; switching later means rewriting the graph",
          "Keep model-calling and business logic inside plain functions the graph merely calls — the framework should wrap your code, not the other way around",
        ],
        [
          "Version churn",
          "APIs you depend on (fan-out dispatch, interrupts) change shape across releases",
          "Pin an exact version in production, read the changelog before upgrading, and keep an integration test that actually compiles and runs the graph — not just unit tests of node functions in isolation",
        ],
      ],
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "Your HITL gate has worked in production for months. After a routine `pip install -U langgraph`, the graph raises `TypeError: interrupt_before is not a valid argument to compile()` — and it's caught in production, not CI. What's actually wrong, and what should have caught it earlier?",
      answer:
        "The immediate cause: LangGraph's human-in-the-loop surface changed between versions — from a compile-time `interrupt_before=[...]` list to the runtime `interrupt()` / `Command(resume=...)` pair used in this lesson. That's exactly the version churn this section warns about: a \"routine\" upgrade silently broke a load-bearing API. The real bug is upstream of the crash: the dependency was pinned loosely (something like `langgraph>=0.2`) instead of to an exact, deliberately-bumped version, so a `pip install -U` (or an unrelated CI cache rebuild) pulled in a breaking change nobody reviewed. It should have been caught earlier by an integration test that actually **compiles and invokes the graph through its interrupt path** — triggering the gate, checking the graph pauses, resuming it — rather than only unit-testing node functions in isolation, which never touch `compile()` or the interrupt machinery at all. The senior habit: pin exact versions for anything with a checkpoint format or interrupt contract, treat a framework upgrade as a change with its own changelog review and test run, and keep one end-to-end test per structurally load-bearing feature (checkpointing, interrupts, fan-out) so a breaking API change fails a build instead of a production request.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Convince me frameworks aren\'t just resume-padding — when do you actually reach for LangGraph over a hand-rolled loop?"',
      answer:
        "Name concrete triggers, not vibes. I reach for a framework when I need **durable resumability**: a job that must survive a process restart without re-paying for completed work, which means checkpointing keyed by thread ID, not a homegrown pickle-to-disk hack. I reach for it when I need **human-in-the-loop that spans days and processes**: the approval might come from a web request or a Slack bot hours later, and blocking on `input()` doesn't survive that. I reach for it when I need **dynamic fan-out with merge semantics**: N parallel workers whose results need to accumulate into shared state safely, which is exactly what reducers exist for. And I reach for it for the **trace/tooling ecosystem** — streaming per-node updates and callback integrations I'd otherwise build myself. What I don't do is reach for it to avoid writing a 40-line while-loop, or because a blog post said agents need graphs — that's buying lock-in and debugging-through-layers for nothing. The honest framing: a framework is worth its abstraction tax exactly when its checkpointer's guarantees are requirements, not nice-to-haves. **Follow-up probe:** \"your team says 'let's just use LangGraph everywhere so junior engineers ramp faster' — good reason?\" → Ramp speed is real but secondary, and it's backwards if the team doesn't already understand the raw loop: they'll misdiagnose a prompt bug or a tool-calling bug as \"a LangGraph problem\" and go spelunking in the framework's source instead of their own prompt. Teach the hand-rolled loop first — this course's whole structure — then hand them the framework as an accelerant, not a substitute for understanding.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"What is 'prompt opacity,' concretely, and how would you defeat it against a framework you don't control?\"",
      answer:
        "Prompt opacity is the gap between the plain-English prompt you wrote and the literal bytes that hit the model API — a framework's structured-output helper, message-formatting utility, or auto-injected tool-use instructions can silently reshape, reorder, or append to what you authored. The risk isn't hypothetical: a formatting helper that adds a few-shot example or a schema-repair instruction changes token cost, changes what the model attends to, and is invisible in your source code — you're debugging a prompt you've never actually read. To defeat it: first, turn on the framework's own debug/verbose mode or callback/tracing hooks, which usually expose the raw request LangChain or LangGraph constructs. If that's insufficient — some wrapping happens below the level any callback fires — intercept at the HTTP client layer (an `httpx` event hook, or a mitmproxy-style capture in a dev environment) so you see the literal JSON body leaving the process. The most robust fix, and the one I'd build into a serious system from day one: construct your own thin client wrapper around the model SDK and inject *that* into the framework wherever it accepts a custom client or callback — every call funnels through code you own, so you always have the exact prompt on hand, in production, not just in a debug session. **Follow-up probe:** \"why not just trust the framework's docs about what it sends?\" → Docs describe intended behavior at doc-publish time; version churn (this lesson's other axis) means the actual behavior of your pinned version can drift from the docs before anyone updates either. Verify against the wire, not the README.",
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
