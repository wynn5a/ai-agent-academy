import type { Lesson } from "@/lib/types";

export const lesson02: Lesson = {
  slug: "state-nodes-and-edges",
  title: "State, Nodes & Conditional Edges",
  minutes: 40,
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
      text: "Sketch the state table first — field, type, written-by, read-by — then draw the graph. If a field has two unrelated writers, split it. If a node needs a field nothing writes, you found a missing edge. This ten-minute exercise is also quiz material for this module, and interviewers ask exactly this.",
    },
    {
      type: "heading",
      text: "Reducers are a state-machine choice, not a syntax detail",
    },
    {
      type: "paragraph",
      text: "A `StateGraph` with a cycle in it (writer → critic → writer) is not a DAG — it's a **state machine**: nodes are states, edges are transitions, and the same node can execute more than once per run. That reframing matters because it changes what \"the state\" means. In a DAG, each field is typically written once, by exactly one node, and you can reason about it top to bottom. In a cyclic graph, a field like `revision_count` or `findings` accumulates *across visits* to the same node — the graph's shape is acyclic-looking in your `add_node` calls, but its runtime behavior is a loop with memory. The reducer you attach to each field is what defines that memory's semantics, and picking the wrong one is a state-machine design bug, not a typo.",
    },
    {
      type: "table",
      headers: ["Reducer", "Semantics", "Wrong-choice failure mode"],
      rows: [
        [
          "Default (none)",
          "Last write wins — the newest update replaces the field entirely",
          "Used on `findings` in a fan-out: only the last parallel searcher's result survives, the rest silently vanish",
        ],
        [
          "`operator.add` (lists)",
          "Appends every update; no notion of duplicates",
          "A retried or re-run node appends its result again — the field grows with every retry, not every unique event",
        ],
        [
          "Custom merge function",
          "You define exactly how two updates combine — dedupe by key, keep max/min, merge dicts",
          "Writing one that has side effects or depends on call order — reducers can run during replay/time-travel, so they must be pure and order-independent",
        ],
      ],
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "You turn on LangGraph's per-node retry policy (Lesson 1's table) for `searcher`, so transient network errors get retried automatically. A month later `findings` sometimes contains the exact same evidence twice for a single subtask — even though the planner never emits duplicate subtasks. What's going on?",
      code: `def searcher(worker_input: dict) -> dict:
    evidence = search_and_summarize(worker_input["task"])  # can raise
    cache_result(worker_input["task"], evidence)            # can also raise
    return {"findings": [evidence]}

# compiled with: retry_policy=RetryPolicy(max_attempts=3) on this node`,
      answer:
        "A retry policy re-executes the **entire node function** from the top on failure — it has no idea which line inside the function raised. If `search_and_summarize` succeeds but the *next* line, `cache_result`, throws a transient error, the framework retries `searcher` from scratch: it calls `search_and_summarize` again (a second real evidence fetch) and, if `cache_result` succeeds this time, returns a *second* `{\"findings\": [evidence]}`. The `operator.add` reducer doesn't know or care that this is a retry — appending is exactly its job, so the same evidence lands in state twice. This is the general trap: **retry policies assume the retried unit is idempotent; additive reducers are the opposite of idempotent by design — they accumulate every attempt, successful or not.** Fixes, in order of preference: restructure the node so anything retryable-but-not-state-shaping (like caching) happens with its own inner retry/try-except rather than letting a failure there re-run the whole node; make the node idempotent by memoizing on subtask id before doing any work a retry would repeat; or, if neither is practical, dedupe in the reducer or downstream (subtask id + content hash) before the writer consumes `findings`. The principle to say out loud in an interview: **before enabling a framework's automatic retries on a node, check what its reducer does with a duplicate — 'accumulate' and 'blind retry' is a bad combination by default.**",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** Design the state schema for a 4-node customer-support triage graph — router, knowledge-base answerer, human-escalation, and a closer that logs the resolution — before you draw a single edge.",
      answer:
        "I sketch a table, not a graph: field, type, written-by, read-by, reducer if any. `ticket_text` (input, read by router — nobody overwrites it). `category` and `confidence` (written once by router, read by the conditional edge and by whichever branch runs next). `kb_answer` (written by the KB node only on the KB branch — I don't share one `answer` field across branches that produce differently-shaped output, because that's the 'vague notes field' anti-pattern from this lesson: two unrelated writers on one field with no contract). `escalation_reason` (written only on the escalation branch, read by the human queue). `resolution` and `resolved_by` (written once, by whichever terminal branch fires, read by the closer). No field needs a reducer here because there's no fan-out and no cycle — that's a tell that this graph is a plain DAG, and I'd say so explicitly rather than defaulting to `operator.add` out of habit. Before wiring edges I check two things: does any field have two writers that don't know about each other (split it), and does any node need a field nothing upstream writes (I'm missing an edge or a field). **Follow-up probe:** \"a teammate wants to add a `notes: str` field every node can append context to — approve it?\" → No — that's exactly the shared-mutable-state failure mode this lesson opens with. If multiple nodes need to leave breadcrumbs, give each its own named field with one writer, or make it a reducer-merged list of structured `{node, note}` entries so at least the origin is traceable — a single free-text field everyone scribbles into is unowned state with no contract, and it's undebuggable six months from now.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "When do you reach for a custom reducer function instead of the default replace or `operator.add`?"',
      answer:
        "Three concrete cases. **Tracking an extremum across visits**: a `highest_severity_seen: Annotated[int, max]` field in a triage loop — every node that classifies severity contributes, and I want the running maximum, not the latest or a list of all of them. **Deduped accumulation**: `sources_cited: Annotated[set[str], operator.or_]` when multiple agents cite overlapping sources and I want the union, not a list with duplicates that `operator.add` would produce. **Structured merges**: two nodes each own a slice of a dict-shaped field (e.g., a `budget: Annotated[dict, merge_budgets]` where one node decrements dollars and another decrements iterations) — a custom function merges the dicts key-by-key instead of one write clobbering the other. The contract I hold any custom reducer to: it must be a **pure function of the old value and the new update, with no side effects and no dependence on call order**, because LangGraph can invoke it during replay or time-travel debugging, and a reducer that isn't order-independent gives you a different final state depending on how parallel updates happened to arrive — which defeats the entire point of state being a reliable, replayable record. **Follow-up probe:** \"how would you unit-test a custom reducer?\" → Exactly like a pure reduce function outside any graph: call it directly with a handful of (old, new) pairs in different orders and assert the result is the same regardless of order for any updates that are logically commutative — if it isn't, that's a correctness bug you want caught before it's merging state under a fan-out in production.",
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
};
