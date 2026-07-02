import type { Module } from "@/lib/types";

export const module05: Module = {
  id: 5,
  slug: "multi-agent-frameworks",
  title: "Multi-Agent Systems & Frameworks",
  weeks: "Weeks 12–14",
  phase: 3,
  phaseTitle: "Scale & interoperability",
  description:
    "Frameworks enter — you've earned them by building everything by hand. LangGraph for stateful, checkpointed, resumable agent graphs; orchestrator-worker and handoff patterns; and the senior-level judgment call interviews probe hardest: when multi-agent is worth the coordination cost (usually it isn't).",
  outcomes: [
    "Build a LangGraph StateGraph from memory: typed state, nodes, fixed and conditional edges, compile, invoke",
    "Enable checkpointing so a graph can resume after a crash, time-travel to past states, and pause for humans",
    "Implement human-in-the-loop interrupts that pause a graph mid-run and resume with human feedback",
    "Implement orchestrator-worker and handoff patterns with structured briefs, not raw transcripts",
    "Quantify error compounding and coordination cost, and argue when multi-agent is and isn't justified",
    "Run a single-agent baseline comparison and report quality, cost, and latency honestly",
  ],
  lessons: [
    {
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
    },
    {
      slug: "state-nodes-and-edges",
      title: "State, Nodes & Conditional Edges",
      minutes: 30,
      summary:
        "The state schema is the most important design decision in a LangGraph system: it's the contract between every node, the thing the checkpointer persists, and — in multi-agent graphs — the communication channel between agents. Get it right and routing, fan-out, and debugging all get easier.",
      sections: [
        {
          type: "paragraph",
          text: "Design the state schema the way you'd design a database table: **every field should have a clear owner (who writes it) and clear consumers (who reads it)**. When two nodes both scribble into a vague `notes` field, you've built shared mutable state with no contract — the classic multi-agent failure mode. A good Lab 05 schema looks like: `question` (written by the user, read by planner), `plan` (written by planner, read by searchers), `findings` (appended by searchers, read by writer), `draft` (written by writer, read by critic), `critique` (written by critic, read by writer).",
        },
        {
          type: "code",
          language: "python",
          title: "state schema with reducers",
          code: `import operator
from typing import Annotated, TypedDict


class ResearchState(TypedDict):
    question: str                              # input; nobody overwrites it
    plan: list[str]                            # planner writes, searchers read
    # Annotated[type, reducer]: when a node returns {"findings": [x]},
    # the reducer APPENDS instead of replacing. This is how parallel
    # searchers write concurrently without clobbering each other.
    findings: Annotated[list[str], operator.add]
    draft: str                                 # writer writes, critic reads
    critique: str                              # critic writes, writer reads
    revision_count: int                        # loop guard


def planner(state: ResearchState) -> dict:
    # decompose the question into 2-3 search subtasks (model call)
    subtasks = ["subtask A", "subtask B"]      # stub
    return {"plan": subtasks}


def searcher(state: ResearchState) -> dict:
    # runs once per subtask when fanned out; returns ONE finding
    return {"findings": ["finding for one subtask"]}`,
          explanation:
            "The `Annotated[list[str], operator.add]` pattern is load-bearing: it declares a **reducer** that merges concurrent updates. Without it, two parallel searchers returning `findings` would conflict — with it, LangGraph appends both. Default behavior for un-annotated fields is last-write-wins replacement, which is what you want for `draft` and `critique`.",
        },
        {
          type: "paragraph",
          text: "Two rules keep nodes healthy. First, **nodes should be as pure as possible**: read state, do work (model calls, tool calls), return an update. Side effects beyond that (writing files, mutating globals) break resumability — if the graph replays from a checkpoint, side effects replay too. Second, **state must be serializable** — the checkpointer has to persist it. Strings, numbers, lists, dicts, Pydantic models: fine. Open file handles, DB connections, clients: keep those out of state (construct them inside nodes or pass via config).",
        },
        {
          type: "heading",
          text: "Conditional edges: routing on state",
        },
        {
          type: "code",
          language: "python",
          title: "critic loop with a conditional edge and a hard cap",
          code: `from langgraph.graph import StateGraph, START, END


def critic(state: ResearchState) -> dict:
    # model call that returns a verdict + critique text (stubbed)
    verdict_ok = state["revision_count"] >= 1  # pretend logic
    return {
        "critique": "" if verdict_ok else "Tighten the citations.",
        "revision_count": state["revision_count"] + 1,
    }


def route_after_critic(state: ResearchState) -> str:
    # Pure function of state -> name of the next node. No side effects.
    if state["critique"] and state["revision_count"] <= 1:
        return "revise"          # one revision loop max (Lab 05 spec)
    return "done"


builder = StateGraph(ResearchState)
builder.add_node("writer", writer)
builder.add_node("critic", critic)
builder.add_edge(START, "writer")
builder.add_edge("writer", "critic")
builder.add_conditional_edges(
    "critic",
    route_after_critic,
    {"revise": "writer", "done": END},   # label -> destination map
)
graph = builder.compile()`,
          explanation:
            "The router is a plain function from state to a label; the dict maps labels to destinations. Note the `revision_count` guard — **every cycle in your graph needs a hard cap**, exactly like the max-iteration guard in your Module 1 loop. A critic-writer cycle without one is an infinite loop with an API bill.",
        },
        {
          type: "table",
          headers: ["Edge type", "API", "Use for"],
          rows: [
            [
              "Fixed",
              '`add_edge("a", "b")`',
              "Unconditional sequencing: planner always precedes searchers",
            ],
            [
              "Conditional",
              '`add_conditional_edges("a", router, mapping)`',
              "Branching on state: critic verdict, error vs. success paths",
            ],
            [
              "Fan-out",
              "Router returns multiple destinations / per-task dispatch (`Send`-style API)",
              "Parallel workers, one per subtask from the planner",
            ],
            [
              "Terminal",
              "Edge to `END`",
              "Graph completion; final state is returned",
            ],
          ],
        },
        {
          type: "paragraph",
          text: "For Lab 05's parallel searchers you need **dynamic fan-out**: the planner produces N subtasks at runtime, and you want N searcher executions with different inputs, running in the same step. LangGraph supports this via a dispatch mechanism in conditional edges (the `Send` API in current versions — check the docs for the exact signature in your installed version): the router returns one dispatch per subtask, each carrying its own slice of state, and the reducer on `findings` merges the results. If the API details shift, the concept doesn't: **map over subtasks, reduce into shared state**.",
        },
        {
          type: "callout",
          kind: "tip",
          title: "Design the schema before the graph",
          text: "Sketch the state table first — field, type, written-by, read-by — then draw the graph. If a field has two unrelated writers, split it. If a node needs a field nothing writes, you found a missing edge. This ten-minute exercise is also checkpoint-quiz question 10, and interviewers ask exactly this.",
        },
        {
          type: "keypoints",
          points: [
            "State is the contract: every field needs one clear writer and known readers.",
            "Reducers (`Annotated[list, operator.add]`) merge concurrent updates; default is last-write-wins.",
            "Nodes: read state, work, return partial update. No hidden side effects; state stays serializable.",
            "Conditional edges = pure router function + label→destination map.",
            "Every cycle gets a hard cap in state (`revision_count`) — frameworks don't repeal the infinite-loop rule.",
            "Dynamic fan-out: map subtasks to parallel node runs, reduce results with a reducer.",
          ],
        },
      ],
    },
    {
      slug: "checkpoints-resume-and-hitl",
      title: "Checkpoints, Resume & Human-in-the-Loop",
      minutes: 25,
      summary:
        "The checkpointer persists graph state after every step, keyed by thread ID. That one mechanism gives you crash recovery, time-travel debugging, and — combined with interrupts — humans who can approve or reject an agent's work days after the process exited.",
      sections: [
        {
          type: "paragraph",
          text: "Compile a graph with a **checkpointer** and LangGraph saves a snapshot of the full state after every node execution, indexed by a `thread_id` you supply in the run config. The consequences are bigger than they sound. **Resume:** if the process dies at step 7 of 10, restart it, invoke the same thread, and execution continues from the last checkpoint — steps 1–6 don't re-run and their token costs aren't re-paid. **Time-travel:** you can list a thread's historical checkpoints, inspect the exact state at any past step, and even fork execution from one. **Durable HITL:** because state survives the process, \"pause for human input\" no longer means blocking a Python process on `input()` — it means the graph parks itself in the database until someone responds.",
        },
        {
          type: "code",
          language: "python",
          title: "checkpointing: kill it, resume it",
          code: `from langgraph.checkpoint.memory import MemorySaver

# In-memory checkpointer: perfect for dev/tests. For Lab 05's
# "resume after a killed process" criterion you need a DURABLE one --
# the sqlite or postgres checkpointer packages -- same interface.
checkpointer = MemorySaver()
graph = builder.compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": "research-042"}}

# Run 1: starts the job. Suppose the process is killed mid-graph.
graph.invoke({"question": "Compare vector DB index types"}, config)

# Run 2 (new process, durable checkpointer): SAME thread_id.
# Passing None as input means "continue from the checkpoint,
# don't start over".
graph.invoke(None, config)

# Inspect where a thread currently is:
snapshot = graph.get_state(config)
print(snapshot.values)        # the persisted state dict
print(snapshot.next)          # which node(s) would run next`,
          explanation:
            "The `thread_id` is the resume key — one per research job in Lab 05. `get_state()` is your debugging window: after a crash, look at `snapshot.next` to see exactly where execution stopped. `MemorySaver` dies with the process; swap in a SQLite/Postgres checkpointer (separate packages, identical interface) for real durability.",
        },
        {
          type: "list",
          items: [
            "**Resume after failure** — a crashed 10-step run continues from step 7 instead of restarting; completed steps aren't re-executed or re-billed.",
            '**Time-travel** — enumerate a thread\'s checkpoint history, inspect the state at any step, replay or fork from it. This is how you debug "why did the writer produce that?" — look at exactly what state it received.',
            "**Durable human-in-the-loop** — pause indefinitely without a running process; the approval can arrive from a different process entirely (a web endpoint, a CLI, a Slack bot).",
          ],
        },
        {
          type: "heading",
          text: "Interrupts: pausing for a human",
        },
        {
          type: "paragraph",
          text: 'Mechanically, a human-in-the-loop interrupt works like this: a node signals an interrupt (with a payload for the human — "here\'s the draft, approve or reject"); LangGraph **checkpoints the state and stops executing**; `invoke()` returns with the interrupt surfaced instead of a final result. The process can now exit. Later — seconds or days — any process with access to the checkpointer resumes the same `thread_id`, passing in the human\'s response, and the interrupted node picks up with that value. It\'s the same resume machinery as crash recovery; the "crash" is just deliberate.',
        },
        {
          type: "code",
          language: "python",
          title: "HITL gate before the final answer (Lab 05 requirement)",
          code: `from langgraph.types import interrupt, Command


def human_gate(state: ResearchState) -> dict:
    # interrupt() checkpoints state and pauses the graph HERE.
    # Its argument is the payload shown to the human.
    decision = interrupt({
        "draft": state["draft"],
        "question": "approve, or reject with feedback?",
    })
    # Execution resumes at this point with the human's value.
    if decision["approved"]:
        return {"critique": ""}
    return {"critique": decision["feedback"]}


# --- caller side ---
config = {"configurable": {"thread_id": "research-042"}}
result = graph.invoke({"question": "..."}, config)
# result surfaces the pending interrupt payload instead of an answer.

# ...later, possibly in a different process:
graph.invoke(
    Command(resume={"approved": False, "feedback": "cite sources 2 and 3"}),
    config,
)`,
          explanation:
            "This uses the `interrupt()` / `Command(resume=...)` pair from recent LangGraph versions; older code used `interrupt_before=[\"node\"]` at compile time plus state edits, and the exact surface may evolve — check your installed version's docs. The mechanics to remember are stable: **checkpoint, stop, return control; resume same thread with the human's value injected**. One subtlety: on resume, the interrupted node re-runs from its top, so keep code before `interrupt()` idempotent.",
        },
        {
          type: "callout",
          kind: "warning",
          title: "Don't ship MemorySaver",
          text: '`MemorySaver` holds checkpoints in the Python process — it demonstrates the API but provides zero durability. Lab 05\'s acceptance criterion is literally "kill the process, resume": that requires the SQLite (single machine) or Postgres (production) checkpointer. Also budget for storage: checkpointing full state every step for every thread adds up — durable checkpointers need a retention/cleanup policy in real deployments.',
        },
        {
          type: "keypoints",
          points: [
            "Checkpointer = state snapshot after every step, keyed by `thread_id`.",
            "Three capabilities a bare loop lacks: resume after failure, time-travel inspection, durable HITL. (Checkpoint-quiz question 1.)",
            "Resume = same `thread_id`, input `None` (or a resume Command); completed steps don't re-run.",
            "Interrupt mechanics: checkpoint → stop → return control → resume same thread with the human's value.",
            "The interrupted node re-runs from its top on resume — keep pre-interrupt code idempotent.",
            "Dev: `MemorySaver`. Anything real: SQLite/Postgres checkpointer.",
          ],
        },
      ],
    },
    {
      slug: "orchestrators-workers-and-handoffs",
      title: "Orchestrator-Workers, Handoffs & What Crosses the Boundary",
      minutes: 25,
      summary:
        "The two structural patterns behind almost every multi-agent system — a central planner delegating to specialists, versus peers transferring control — and the design decision that determines whether either works: what actually gets passed between agents.",
      sections: [
        {
          type: "paragraph",
          text: "Strip the vendor diagrams away and multi-agent systems reduce to a handful of shapes. **Orchestrator-workers:** one agent owns the task, decomposes it, delegates subtasks to specialist workers, and integrates their results — control always returns to the center. **Handoffs:** peers transfer ownership sideways — a triage agent realizes this is a billing question and hands the conversation to the billing agent, which now owns it; control does not return. **Evaluator loops:** a producer's output goes to a critic, which approves or sends it back with feedback — you built exactly this with the writer-critic cycle in Lesson 2.",
        },
        {
          type: "animation",
          name: "workflow-patterns",
          caption:
            "Orchestrator-workers (hub delegating to spokes) vs. handoff (peer-to-peer transfer of ownership) vs. evaluator loop (producer-critic cycle).",
        },
        {
          type: "table",
          headers: [
            "Pattern",
            "Structure",
            "Control flow",
            "Canonical use case",
          ],
          rows: [
            [
              "Orchestrator-workers",
              "Hub and spokes; planner + specialists",
              "Always returns to the orchestrator, which integrates",
              "Research: planner decomposes a question, parallel searchers gather, writer integrates (Lab 05)",
            ],
            [
              "Handoff",
              "Peers; ownership transfers sideways",
              "One-way transfer; the receiver owns the task from then on",
              "Support routing: triage → billing specialist with its own tools and permissions",
            ],
            [
              "Evaluator loop",
              "Producer + critic cycle",
              "Bounded loop between two roles",
              "Draft-review-revise; code-gen with a test-runner critic",
            ],
          ],
        },
        {
          type: "code",
          language: "python",
          title:
            "orchestrator-workers in LangGraph: planner fans out, workers reduce",
          code: `# The orchestrator-worker shape, using the Lesson 2 schema.
# planner -> N parallel searchers -> writer -> critic (loop) -> END


def planner(state: ResearchState) -> dict:
    # One model call: decompose the question into concrete,
    # independently-searchable subtasks. Force structured output
    # (Module 1 skills) so 'plan' is a clean list, not prose.
    subtasks = plan_with_llm(state["question"])   # -> list[str]
    return {"plan": subtasks}


def make_searcher_input(subtask: str) -> dict:
    # each parallel searcher run receives ONE subtask as its input
    return {"task": subtask}


def searcher(worker_input: dict) -> dict:
    evidence = search_and_summarize(worker_input["task"])
    # reducer on 'findings' (operator.add) merges parallel writes
    return {"findings": [evidence]}


def writer(state: ResearchState) -> dict:
    draft = write_with_llm(state["question"], state["findings"],
                           feedback=state.get("critique", ""))
    return {"draft": draft}

# Fan-out wiring: a conditional edge after 'planner' dispatches one
# searcher run per subtask (LangGraph's Send-style dispatch API --
# exact call signature varies by version; the map/reduce concept
# is the stable part).`,
          explanation:
            "Notice what makes this orchestrator-workers rather than one agent with tools: each searcher runs with a **clean, small context** containing only its subtask — not the whole conversation — and they run **in parallel**. Those are two of the three legitimate reasons to go multi-agent (Lesson 5). The writer never sees raw search transcripts, only distilled findings.",
        },
        {
          type: "heading",
          text: "The handoff payload decides everything",
        },
        {
          type: "paragraph",
          text: "Whatever the pattern, quality is determined by **what crosses the agent boundary**. Passing the full conversation history feels safe but is usually wrong: it blows the receiver's context budget, buries the actual task in noise, and leaks irrelevant (sometimes sensitive) content across roles — and the receiver will latch onto distracting details exactly the way a human skimming a 40-page thread does. Passing a one-line summary is the opposite failure: the receiver lacks what it needs and hallucinates the gaps. The reliable middle ground is a **structured brief**: an explicit schema stating the task, the constraints, the relevant facts so far, and what the receiver must return.",
        },
        {
          type: "code",
          language: "python",
          title: "structured briefs + logged handoffs (Lab 05 requirement)",
          code: `import json
import time
from pydantic import BaseModel


class HandoffBrief(BaseModel):
    from_agent: str
    to_agent: str
    task: str                    # what the receiver must do
    context: list[str]           # ONLY the facts the receiver needs
    constraints: list[str]       # format, length, tone, citations
    expected_output: str         # shape of what comes back


def log_handoff(brief: HandoffBrief, path: str = "handoffs.jsonl") -> None:
    record = {"ts": time.time(), **brief.model_dump()}
    with open(path, "a") as f:
        f.write(json.dumps(record) + "\\n")


def planner_to_searcher_brief(subtask: str, question: str) -> HandoffBrief:
    return HandoffBrief(
        from_agent="planner",
        to_agent="searcher",
        task=f"Find evidence for: {subtask}",
        context=[f"Overall research question: {question}"],
        constraints=["cite the source of every claim",
                     "return at most 5 bullet findings"],
        expected_output="bulleted findings, each with a source",
    )`,
          explanation:
            "Every handoff in Lab 05 gets built as a `HandoffBrief` and logged before the receiver runs. The log serves two masters: **debugging** (when the writer produces garbage, read the brief it received — the bug is usually there, not in the writer) and the **inter-agent trace** your baseline comparison and README need. Pydantic gives you validation for free: a brief missing `expected_output` fails at construction, not three agents downstream.",
        },
        {
          type: "callout",
          kind: "insight",
          text: 'A multi-agent system is only as good as its worst handoff. Most "the critic is useless" and "the writer ignored the research" bugs are actually **briefing bugs**: the upstream agent never passed the information downstream needed. Before touching any agent\'s prompt, read the handoff log. This is the multi-agent version of Module 3\'s rule that most agent bugs are visible in the trace.',
        },
        {
          type: "callout",
          kind: "tip",
          title: "A critic that approves everything is a prompt bug",
          text: 'Symptom: your evaluator loop never loops. Causes, in order of likelihood: the critic\'s prompt asks "is this good?" (models say yes — sycophancy); the critic lacks a rubric to check against; the critic sees only the draft, not the original requirements. Fixes: give it a concrete checklist ("verify every claim has a citation; verify all subtasks in the plan are addressed"), require it to quote the failing passage for each issue found, and include the plan and question in its brief. If it still rubber-stamps, make it grade each rubric item separately — pass/fail per item is harder to fudge than one holistic verdict.',
        },
        {
          type: "keypoints",
          points: [
            "Orchestrator-workers: hub decomposes, delegates, integrates; control returns to center. Handoff: peer transfer of ownership; control doesn't return.",
            "Evaluator loops are a two-role cycle — always bounded by a revision cap.",
            "Full-history handoffs bloat context and bury the task; one-liners starve the receiver. Structured briefs (task, context, constraints, expected output) win.",
            "Log every handoff payload — most multi-agent bugs are briefing bugs, visible in the log.",
            "A rubber-stamp critic needs a rubric, the original requirements, and per-item grading — not a bigger model.",
          ],
        },
      ],
    },
    {
      slug: "when-multi-agent-is-worth-it",
      title: "When Multi-Agent Is Worth It (Usually It Isn't)",
      minutes: 25,
      summary:
        "The senior-engineer take interviews reward: multi-agent adds latency, cost, and compounding error rates, and most systems that ship as five agents should have shipped as one good agent. Learn the three legitimate justifications, the math of compounding failure, and how to run the baseline comparison that keeps you honest.",
      sections: [
        {
          type: "paragraph",
          text: "Here is the uncomfortable truth this module exists to teach: **most multi-agent systems are worse than the single agent they replaced would have been.** Every agent boundary you add introduces a handoff that can lose information, a scheduling step that adds latency, duplicated context that multiplies token cost, and an independent failure point. The architecture diagrams look like org charts, and that's seductive — \"a researcher, a writer, an editor, just like a real team!\" — but models aren't people. One model with good tools, a clean context, and a decent loop doesn't need meetings.",
        },
        {
          type: "paragraph",
          text: "The error math is brutal and worth quoting in interviews. If a task flows through five sequential stages and each stage is 90% reliable, end-to-end reliability is 0.9 to the fifth power — **about 59%**. Your five nines-of-effort agents ship a coin flip. Worse, errors *compound in content, not just probability*: stage 2 doesn't merely fail sometimes, it feeds subtly-wrong output to stage 3, which builds confidently on the error. A single agent with the same 90% reliability on the whole task is... 90%. Chaining only wins when each stage is dramatically more reliable on its narrow slice than one agent is on the whole — which you must measure, not assume.",
        },
        {
          type: "table",
          headers: [
            "Justified when…",
            "Why it actually helps",
            "NOT justified when…",
          ],
          rows: [
            [
              "**Context isolation matters** — each worker needs a clean window",
              "A searcher with a 5k-token context containing exactly its subtask outperforms one agent dragging 100k tokens of accumulated transcripts, dead ends, and tool dumps — the mess actively degrades attention",
              '"Separation of concerns" as an aesthetic — code modules give you that without runtime handoffs',
            ],
            [
              "**True parallelism** — subtasks are independent and I/O-bound",
              "Three searchers finish in one wall-clock unit instead of three; only works when subtasks don't need each other's results",
              "The subtasks are sequential anyway — you've added coordination and kept the latency",
            ],
            [
              "**Distinct tools or permissions per role** — the deploy agent has prod credentials, the researcher has read-only web",
              "Smaller blast radius per agent; a compromised or confused researcher cannot touch prod (Module 7 will sharpen this)",
              'All "agents" share the same tool set and permissions — that\'s one agent with extra steps',
            ],
          ],
        },
        {
          type: "paragraph",
          text: "Why does the clean-window worker win? Recall Module 4: model quality degrades as the context fills with low-relevance material — attention gets diluted, instructions in the middle get lost, and old errors get treated as established facts. A monolithic agent that has done nine searches carries every raw result and misstep into search ten. A fresh worker receives a brief: *the subtask, the constraints, nothing else*. Context isolation is the strongest technical argument for multi-agent because it attacks the actual failure mechanism, not the org chart. Notice the corollary: if your contexts aren't degrading — short tasks, small histories — this argument evaporates, and with it most of the case for splitting.",
        },
        {
          type: "heading",
          text: "The baseline comparison — Lab 05's differentiator",
        },
        {
          type: "paragraph",
          text: "The rule that keeps you honest: **never ship a multi-agent system without benchmarking it against a single-agent baseline with the same tools.** Same questions, same tools, same model; only the architecture differs. Measure three things — output quality (LLM-as-judge plus your own rubric), total cost (sum tokens across *all* agents and handoffs — people forget the orchestrator's tokens), and wall-clock latency. Signals that you should collapse to single-agent: quality is within noise of the baseline; most handoff payloads just restate prior state (the boundary adds no information); cost is a multiple of baseline; or your handoff log shows workers spending turns re-deriving context the monolith would simply have had.",
        },
        {
          type: "code",
          language: "python",
          title: "baseline comparison harness",
          code: `import json
import time


QUESTIONS = load_eval_questions("questions.json")   # the same 10 for both


def run_condition(name: str, run_fn) -> list[dict]:
    rows = []
    for q in QUESTIONS:
        t0 = time.time()
        answer, usage = run_fn(q)     # returns (text, token/cost totals)
        rows.append({
            "condition": name,
            "question": q,
            "answer": answer,
            "latency_s": round(time.time() - t0, 1),
            "input_tokens": usage["input_tokens"],    # summed over ALL
            "output_tokens": usage["output_tokens"],  # agents + handoffs
        })
    return rows


multi = run_condition("multi_agent", run_langgraph_system)
single = run_condition("single_agent", run_single_agent_same_tools)

with open("comparison_raw.jsonl", "w") as f:
    for row in multi + single:
        f.write(json.dumps(row) + "\\n")`,
          explanation:
            "The single-agent baseline gets the **same tools** (search, etc.) and the same model — otherwise you're comparing architectures and capabilities at once and the numbers mean nothing. Usage must be summed across every model call in the multi-agent run, including planner and critic turns; undercounting orchestration cost is the most common way these comparisons lie.",
        },
        {
          type: "code",
          language: "python",
          title: "LLM-as-judge scoring (pairwise, order-randomized)",
          code: `import random

JUDGE_PROMPT = """You are grading two research briefs answering:
{question}

Brief A:
{a}

Brief B:
{b}

Rubric: factual grounding and citations (40%), coverage of the
question (30%), clarity and structure (30%).
Score each brief 1-10 per rubric item, then declare a winner.
Return JSON: {{"a_scores": ..., "b_scores": ..., "winner": "A"|"B"|"tie"}}"""


def judge(question: str, multi_ans: str, single_ans: str) -> dict:
    # randomize position to cancel the judge's first-position bias
    if random.random() < 0.5:
        a, b, mapping = multi_ans, single_ans, {"A": "multi", "B": "single"}
    else:
        a, b, mapping = single_ans, multi_ans, {"A": "single", "B": "multi"}
    verdict = call_judge_model(JUDGE_PROMPT.format(
        question=question, a=a, b=b))          # structured output, temp 0
    verdict["winner"] = mapping.get(verdict["winner"], "tie")
    return verdict`,
          explanation:
            'Module 3 habits apply: judges have position bias (randomize order), need a rubric (not "which is better?"), and should run at temperature 0 with structured output. Spot-check a sample of judgments by hand and report your own rubric scores alongside the judge\'s. If the single agent wins, **say so in the README** — an honest negative result is a stronger portfolio signal than a rigged win.',
        },
        {
          type: "callout",
          kind: "tip",
          title: "The interview answer",
          text: 'When asked "how would you design a multi-agent system for X?", the senior move is to first ask whether X needs one: "I\'d start with a single agent with good tools and measure it. I\'d split only for context isolation, true parallelism, or distinct permissions — and I\'d keep the single-agent baseline running in my evals so I know the split is paying for its coordination cost." That answer signals judgment; jumping straight to a five-agent diagram signals you read too many vendor blog posts.',
        },
        {
          type: "keypoints",
          points: [
            "Default answer: one good agent. Multi-agent must earn its coordination cost with measurements.",
            "Five sequential stages at 90% each ≈ 59% end-to-end — and errors compound in content, not just probability.",
            'Three legitimate justifications: context isolation, true parallelism, distinct tools/permissions. "Separation of concerns" alone is hand-waving.',
            "Clean 5k-token worker windows beat one 100k-token accumulated mess because context pollution degrades attention.",
            "Always run a single-agent baseline: same tools, same model, same questions; compare quality, total cost (all agents' tokens), latency.",
            "Collapse signals: quality within noise of baseline, handoffs that add no information, cost multiples, workers re-deriving context.",
          ],
        },
      ],
    },
  ],
  quiz: [
    {
      question:
        "What does LangGraph's checkpointer enable that a bare while-loop doesn't? (Pick the answer naming all three.)",
      options: [
        "Faster model inference, lower token prices, and automatic prompt optimization",
        "Resume after a crash, time-travel inspection of past states, and durable human-in-the-loop pauses",
        "Automatic parallelism, built-in web search, and self-improving prompts",
        "Guaranteed determinism, unlimited context windows, and free retries",
      ],
      correct: 1,
      explanation:
        "The checkpointer persists full graph state after every step, keyed by thread_id. That one mechanism yields all three: resume (continue a killed run without re-executing completed steps), time-travel (inspect/fork from any historical checkpoint), and durable HITL (the graph pauses in storage, not in a blocked process). A bare loop keeps state in process memory — kill it and everything is gone.",
    },
    {
      question:
        "What is the structural difference between orchestrator-workers and handoffs?",
      options: [
        "Orchestrator-workers uses one model for everything; handoffs require different model providers",
        "Handoffs are faster because they skip the planner",
        "In orchestrator-workers, control always returns to a central agent that integrates results; in a handoff, ownership transfers sideways to a peer and doesn't return",
        "They are the same pattern with different names in different frameworks",
      ],
      correct: 2,
      explanation:
        "Orchestrator-workers is hub-and-spokes: a planner decomposes, delegates, and integrates — good for research-style decompose-and-combine tasks. A handoff is peer-to-peer transfer of ownership — good for routing, like triage passing a conversation to a billing specialist that has its own tools and permissions. The control-flow difference (returns to center vs. doesn't) is the structural distinction.",
    },
    {
      question:
        "A pipeline has five sequential agent stages, each 90% reliable. Roughly what is end-to-end reliability, and what makes the practical situation even worse than that number?",
      options: [
        "~59% (0.9^5) — and worse, failed stages feed subtly-wrong content downstream, so later stages build confidently on errors",
        "90% — reliability is determined by the weakest stage, not the chain",
        "~98% — stages cross-check each other, so reliability improves with depth",
        "~59% — but retries make the number irrelevant in practice",
      ],
      correct: 0,
      explanation:
        "Independent sequential stages multiply: 0.9^5 ≈ 0.59. And probability understates it — errors compound in *content*: stage 2's subtly-wrong output becomes stage 3's trusted input. This is the core quantitative argument for skepticism about long agent chains, and why each added boundary must earn its place.",
    },
    {
      question:
        "Which of these is a legitimate technical justification for splitting into multiple agents?",
      options: [
        "Separation of concerns — each agent's code is cleaner in its own file",
        "Each worker needs a clean, isolated context window because accumulated history degrades the monolithic agent's attention",
        "The architecture diagram maps nicely onto the human team's org chart",
        "More agents means more total intelligence applied to the problem",
      ],
      correct: 1,
      explanation:
        'The three legitimate reasons: context isolation (clean per-worker windows), true parallelism (independent I/O-bound subtasks), and distinct tools/permissions per role (blast-radius control). "Separation of concerns" is achievable with code organization — it doesn\'t require runtime handoffs. Org-chart mimicry and "more agents = smarter" are the classic anti-patterns.',
    },
    {
      question:
        "What should a handoff payload contain, and why is passing the full conversation history usually wrong?",
      options: [
        "Just the task in one sentence — receivers should figure out the rest",
        "The full history, because more context always improves model output",
        "Whatever fits in the context window, oldest first",
        "A structured brief — task, relevant context, constraints, expected output — because full history bloats the receiver's context, buries the task in noise, and leaks irrelevant content across roles",
      ],
      correct: 3,
      explanation:
        "Full transcripts blow the receiver's context budget and dilute attention with irrelevant detail (Module 4's context-pollution problem, exported across a boundary); one-line summaries starve the receiver so it hallucinates gaps. The structured brief is the reliable middle: explicit task, only the needed facts, constraints, and the expected output shape — validated by a schema and logged.",
    },
    {
      question:
        "Mechanically, how does a human-in-the-loop interrupt work in a checkpointed LangGraph?",
      options: [
        "The node blocks on input() until a human types at the server's terminal",
        "The node signals an interrupt: state is checkpointed, execution stops, and invoke() returns with the pending interrupt; later, any process resumes the same thread_id passing the human's response, and the node continues with that value",
        "The graph emails the human and polls an inbox every 30 seconds inside the node",
        "LangGraph spins up a web UI automatically and pauses the Python GIL",
      ],
      correct: 1,
      explanation:
        "The interrupt reuses the resume machinery: checkpoint → stop → return control to the caller. Because state is durable, the process can exit entirely; the approval can arrive days later from a different process that resumes the same thread with the human's value injected. One subtlety: the interrupted node re-runs from its top on resume, so pre-interrupt code should be idempotent.",
    },
    {
      question:
        "Your critic agent approves every draft, so the revision loop never fires. What's the most likely diagnosis and fix?",
      options: [
        "The model is too small — swap in the largest available model",
        "Critics are inherently useless — remove the loop",
        'The critic\'s prompt asks a vague "is this good?" and it lacks a rubric and the original requirements — give it a concrete checklist, the plan/question in its brief, and require per-item grades with quoted evidence',
        "The temperature is too low — raise it so the critic gets more opinionated",
      ],
      correct: 2,
      explanation:
        "Models are sycophantic under vague evaluation prompts. The fix is structural: a concrete rubric (\"every claim cited? every planned subtask addressed?\"), access to the original requirements (a critic that sees only the draft can't check coverage), per-item pass/fail grading, and required quotes of failing passages. Bigger models and higher temperature don't fix a briefing/prompting bug.",
    },
    {
      question:
        "Why can a worker agent with a clean 5k-token context outperform a single agent carrying 100k tokens of accumulated history on the same subtask?",
      options: [
        "Smaller contexts are billed at a discount, so the provider allocates better hardware",
        "It can't — more context always helps",
        "The 5k worker uses a different, faster model automatically",
        "Long contexts full of stale transcripts, dead ends, and tool dumps dilute attention and get old errors treated as facts; the worker's context contains exactly its task and nothing else",
      ],
      correct: 3,
      explanation:
        "This is context isolation — the strongest technical argument for multi-agent. Model quality degrades as context fills with low-relevance material (lost-in-the-middle effects, error propagation from earlier mistakes). A fresh worker briefed with only its subtask attacks that failure mechanism directly. Corollary: if contexts aren't degrading, this justification evaporates.",
    },
    {
      question:
        "How would you detect that a multi-agent system should be collapsed to single-agent?",
      options: [
        "Run a single-agent baseline with the same tools/model/questions; collapse if quality is within noise of baseline while cost/latency are multiples, if handoff logs show payloads that merely restate prior state, or if workers spend turns re-deriving context the monolith would have had",
        "Count the agents; more than three is always too many",
        "Ask the model whether it prefers working alone",
        "Check GitHub stars of the framework you used",
      ],
      correct: 0,
      explanation:
        "The measurement discipline: same questions through both architectures, compare quality (judge + rubric), total cost (summing every agent's tokens including the orchestrator), and latency. The handoff log adds qualitative signals — boundaries that add no information, or context being expensively reconstructed on the far side of each split.",
    },
    {
      question:
        "In a LangGraph state schema, two parallel searcher nodes both write to a `findings: list[str]` field. What must you do to avoid one update clobbering the other?",
      options: [
        "Run the searchers sequentially — parallel writes are impossible",
        "Annotate the field with a reducer, e.g. `Annotated[list[str], operator.add]`, so LangGraph merges concurrent updates by appending instead of replacing",
        "Have each searcher write to the same string field with a lock",
        "Use global variables instead of graph state",
      ],
      correct: 1,
      explanation:
        "Un-annotated state fields use last-write-wins replacement — fine for `draft`, wrong for accumulating results. A reducer declared via `Annotated[type, reducer]` tells LangGraph how to merge concurrent updates; `operator.add` on lists appends. This is the map-reduce backbone of the fan-out pattern in Lab 05.",
    },
    {
      question:
        "What is the correct way to route after a critic node in LangGraph, including loop safety?",
      options: [
        "Have the critic node call the writer node directly as a Python function",
        "Use a fixed edge back to the writer — the model will know when to stop",
        "Raise an exception in the critic to escape the graph when done",
        "add_conditional_edges with a pure router function that reads state (critique + a revision counter) and returns a label mapped to either the writer or END — with a hard cap on revisions stored in state",
      ],
      correct: 3,
      explanation:
        "Conditional edges take a router (pure function of state → label) and a label→destination map. The revision counter in state is the loop guard — every cycle in a graph needs a hard cap, exactly like the max-iteration guard in a hand-rolled loop. Fixed edges can't branch, and calling nodes directly bypasses state management and checkpointing.",
    },
    {
      question:
        "For Lab 05's baseline comparison, why must the single-agent baseline get the same tools and model as the multi-agent system, and what's the most common way these comparisons lie?",
      options: [
        "Because otherwise you're comparing architecture and capability at once, so the numbers attribute nothing; the common lie is undercounting multi-agent cost by forgetting orchestrator/critic tokens and handoff overhead",
        "It doesn't matter — any baseline shows due diligence",
        "The baseline should use a weaker model so the multi-agent system looks good in the README",
        "Same tools are needed only to keep the code DRY; comparisons can't really lie",
      ],
      correct: 0,
      explanation:
        "A fair comparison isolates the one variable you're testing: architecture. Same model, same tools, same 10 questions. The classic cheat (often accidental) is summing only the worker agents' tokens — the planner, critic, and every handoff's re-sent context are real costs. And if the single agent wins, the honest conclusion belongs in the README; that honesty is the portfolio signal.",
    },
  ],
  lab: {
    title: "Multi-Agent Research System with Single-Agent Baseline",
    portfolio: true,
    objective:
      "Build a planner → parallel searchers → writer → critic research system in LangGraph that answers questions with a cited brief — checkpointed, resumable, with a human approval gate and logged structured handoffs — then benchmark it honestly against a single agent with the same tools. Starter code lives in labs/lab05-multi-agent/.",
    sections: [
      {
        type: "heading",
        text: "What you're building",
      },
      {
        type: "paragraph",
        text: "A research question goes in; a cited brief comes out. The **planner** decomposes the question into 2–3 subtasks; **parallel searchers** (web or a provided corpus) gather evidence, one clean context each; the **writer** integrates findings into a draft; the **critic** reviews against a rubric with at most one revision loop; a **human gate** pauses the graph for approve/reject-with-feedback before the final answer. Every handoff is a structured brief, logged to JSONL. Then the part that makes this a portfolio piece: the same 10 questions through a single agent with the same tools, and an honest comparison table.",
      },
      {
        type: "animation",
        name: "multi-agent",
        caption:
          "Lab 05's shape: planner fans out to parallel searchers; writer integrates; critic loops at most once; a human gates the exit.",
      },
      {
        type: "heading",
        text: "Suggested structure",
      },
      {
        type: "code",
        language: "python",
        title: "skeleton (fill in the TODOs)",
        code: `# state.py
import operator
from typing import Annotated, TypedDict

class ResearchState(TypedDict):
    question: str
    plan: list[str]
    findings: Annotated[list[str], operator.add]   # parallel-safe
    draft: str
    critique: str
    revision_count: int

# handoff.py — HandoffBrief (pydantic) + log_handoff() -> handoffs.jsonl

# graph.py
builder = StateGraph(ResearchState)
builder.add_node("planner", planner)         # decompose via structured output
builder.add_node("searcher", searcher)       # fanned out per subtask
builder.add_node("writer", writer)
builder.add_node("critic", critic)
builder.add_node("human_gate", human_gate)   # interrupt() lives here

builder.add_edge(START, "planner")
# TODO: fan-out dispatch planner -> N searcher runs (Send-style API)
builder.add_edge("searcher", "writer")
builder.add_edge("writer", "critic")
builder.add_conditional_edges("critic", route_after_critic,
                              {"revise": "writer", "gate": "human_gate"})
builder.add_conditional_edges("human_gate", route_after_gate,
                              {"revise": "writer", "done": END})

graph = builder.compile(checkpointer=sqlite_checkpointer)  # durable!

# baseline.py — single agent, SAME tools, same model, same 10 questions
# compare.py — runs both, sums usage across ALL calls, judges pairwise`,
        explanation:
          "Design decisions that matter: the checkpointer must be durable (SQLite, not MemorySaver) or the kill-and-resume criterion fails; every searcher receives a brief containing only its subtask — resist passing the whole state; the critic gets the plan and question, not just the draft, or it can't check coverage; and `revision_count` caps the critic loop at one revision per the spec.",
      },
      {
        type: "callout",
        kind: "warning",
        title: "The honesty clause",
        text: "The baseline comparison is graded on rigor, not on the multi-agent system winning. Sum tokens across every model call including planner and critic turns; randomize judge order; spot-check judgments by hand. If the single agent wins on quality-per-dollar — a common outcome — the README says so and analyzes why. A rigged comparison fails the lab.",
      },
    ],
    acceptanceCriteria: [
      "LangGraph graph with: planner node (decomposes the question), 2–3 parallel search workers (web or corpus), writer, and critic with at most one revision loop",
      "Typed state schema; checkpointing enabled; the run can resume after a killed process",
      "HITL interrupt: before the final answer, the graph pauses for human approve or reject-with-feedback",
      "Handoffs pass structured briefs (not raw transcripts); every handoff payload is logged",
      "Baseline comparison: the same 10 questions through a single agent with the same tools; report quality (LLM-as-judge + your own rubric), cost, and latency for both, with an honest conclusion — if single-agent wins, say so",
      "README with an architecture diagram and the comparison table",
    ],
    stretchGoals: [
      "Time-travel demo: use the checkpoint history to fork a run from before the writer step with a modified plan, and diff the outcomes",
      "Add a token/cost budget to state that any node can trip, terminating the graph gracefully with a partial-results report",
      "Practical test rehearsal: kill the process mid-run on camera, resume from the checkpoint, and narrate your baseline numbers as if defending them in an interview",
    ],
  },
  resources: [
    {
      title: "LangChain Academy — Intro to LangGraph",
      url: "https://academy.langchain.com/",
      description: "Free official course; do modules 1–4 before Lab 05.",
      kind: "course",
    },
    {
      title: "Anthropic — How we built our multi-agent research system",
      url: "https://www.anthropic.com/engineering/multi-agent-research-system",
      description:
        "Real production numbers on orchestrator-worker, incl. token cost honesty.",
      kind: "essay",
    },
    {
      title: "Cognition — Don't Build Multi-Agents",
      url: "https://cognition.ai/blog/dont-build-multi-agents",
      description:
        "The counterargument. Read both sides; interviews reward the synthesis.",
      kind: "essay",
    },
    {
      title: "Hugging Face AI Agents Course",
      url: "https://huggingface.co/learn/agents-course",
      description:
        "Free, certified; broad framework coverage (smolagents, LlamaIndex, LangGraph).",
      kind: "course",
    },
    {
      title: "LangGraph reference docs",
      url: "https://langchain-ai.github.io/langgraph/",
      description:
        "The API reference for Lab 05 — state, reducers, checkpointers, interrupts.",
      kind: "docs",
    },
  ],
};
