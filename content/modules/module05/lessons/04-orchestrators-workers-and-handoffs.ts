import type { Lesson } from "@/lib/types";

export const lesson04: Lesson = {
  slug: "orchestrators-workers-and-handoffs",
  title: "Orchestrator-Workers, Handoffs & What Crosses the Boundary",
  minutes: 35,
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
      headers: ["Pattern", "Structure", "Control flow", "Canonical use case"],
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
      code: `# Colab cell 1 — run once. No API key needed; the model calls are stubbed
# so the orchestrator-worker shape runs on LangGraph's machinery alone.
# planner -> N parallel searchers (fan-out) -> writer -> END
!pip install -q langgraph

import operator
from typing import Annotated, TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.types import Send


class ResearchState(TypedDict):
    question: str
    plan: list[str]
    findings: Annotated[list[str], operator.add]   # reducer merges parallel writes
    draft: str


# --- stubbed model calls (Module 1 would make these real) ---
def plan_with_llm(question: str) -> list[str]:
    return [f"{question} — angle {i}" for i in (1, 2, 3)]

def search_and_summarize(task: str) -> str:
    return f"evidence for [{task}]"

def write_with_llm(question: str, findings: list[str]) -> str:
    return f"Draft for {question!r} citing {len(findings)} findings."


def planner(state: ResearchState) -> dict:
    # One model call: decompose the question into concrete,
    # independently-searchable subtasks. Force structured output
    # (Module 1 skills) so 'plan' is a clean list, not prose.
    return {"plan": plan_with_llm(state["question"])}


def searcher(worker_input: dict) -> dict:
    # receives ONE subtask (the Send payload), not the whole state
    evidence = search_and_summarize(worker_input["task"])
    return {"findings": [evidence]}   # reducer appends parallel writes


def writer(state: ResearchState) -> dict:
    return {"draft": write_with_llm(state["question"], state["findings"])}


# Fan-out: a conditional edge after 'planner' returns one Send per
# subtask, each carrying its own slice of state. (The Send API's exact
# signature varies by LangGraph version; the map/reduce concept is the
# stable part.)
def fan_out_to_searchers(state: ResearchState) -> list[Send]:
    return [Send("searcher", {"task": task}) for task in state["plan"]]


builder = StateGraph(ResearchState)
builder.add_node("planner", planner)
builder.add_node("searcher", searcher)
builder.add_node("writer", writer)
builder.add_edge(START, "planner")
builder.add_conditional_edges("planner", fan_out_to_searchers, ["searcher"])
builder.add_edge("searcher", "writer")
builder.add_edge("writer", END)
graph = builder.compile()

result = graph.invoke({"question": "How do vector index types differ?",
                       "plan": [], "findings": [], "draft": ""})
print(result["findings"])   # one per subtask, merged by the reducer
print(result["draft"])`,
      explanation:
        "Notice what makes this orchestrator-workers rather than one agent with tools: each searcher runs with a **clean, small context** containing only its subtask (the `Send` payload) — not the whole conversation — and they run **in parallel**, their results merged by the `operator.add` reducer on `findings`. Those are two of the three legitimate reasons to go multi-agent (Lesson 5). The writer never sees raw search transcripts, only distilled findings. It all runs with no key because the three model calls are stubbed — swap them for real ones (Module 1) without touching the graph.",
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
      code: `# Colab cell 2 — run cell 1 first (it defines graph). Pure Python + pydantic;
# no API key needed.
!pip install -q pydantic

import json
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
    )


brief = planner_to_searcher_brief("compare HNSW vs IVF recall",
                                  "How do vector index types differ?")
log_handoff(brief)                       # appends one line to handoffs.jsonl
print(brief.task, "->", brief.expected_output)
print(open("handoffs.jsonl").read().strip())`,
      explanation:
        "Every handoff in Lab 05 gets built as a `HandoffBrief` and logged before the receiver runs. The log serves two masters: **debugging** (when the writer produces garbage, read the brief it received — the bug is usually there, not in the writer) and the **inter-agent trace** your baseline comparison and README need. Pydantic gives you validation for free: a brief missing `expected_output` fails at construction, not three agents downstream. The demo builds one brief, logs it, and reads the JSONL line back — that file is the inter-agent trace your README and baseline comparison need.",
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
      type: "heading",
      text: "Shared state vs. message passing",
    },
    {
      type: "paragraph",
      text: "There are two fundamentally different ways to let agents communicate, and LangGraph's reducer-merged state schema is a specific, opinionated answer — not the only one. **Shared state** (what you've been building all module): every node reads and writes one common, typed schema; the checkpointer snapshots the whole thing; any node can, in principle, see any field. **Message passing**: agents have no shared memory at all — each keeps its own private context, and the only thing that crosses a boundary is an explicit message, the same discipline as the `HandoffBrief` you just built, but as the *only* channel rather than a convention layered on top of a shared schema. Frameworks built around an actor or agent-to-agent messaging model (rather than a shared graph state) take this second approach natively.",
    },
    {
      type: "table",
      headers: [
        "",
        "Shared state (LangGraph)",
        "Message passing (actor-style)",
      ],
      rows: [
        [
          "Debuggability",
          "One snapshot to inspect; time-travel and checkpointing fall out for free",
          "Have to reconstruct the global picture from many private logs — no single source of truth to `get_state()`",
        ],
        [
          "Coupling",
          "Every node depends on the shape of one global schema — a field rename touches every reader",
          "Agents only depend on the message contract they receive — internal state can change freely",
        ],
        [
          "Isolation",
          "Nothing stops a careless node from reading a field it shouldn't need (the 'vague notes field' failure from Lesson 2)",
          "Strong by construction — an agent literally cannot see what it wasn't sent",
        ],
        [
          "Best fit",
          "One team, one deployable, tight iteration loop, need for audit/replay (compliance, this course's labs)",
          "Independently owned/deployed agents, different release cadences, org boundaries between teams",
        ],
      ],
    },
    {
      type: "paragraph",
      text: "In practice the two aren't opposites so much as two layers of the same system. LangGraph gives you shared state as the **infrastructure** primitive — it's what the checkpointer persists and what makes resume and time-travel possible — but nothing stops you from disciplining *how nodes actually use it* to get message-passing's isolation benefits: the `HandoffBrief` pattern from this lesson is exactly that hybrid. Each node still technically shares one `TypedDict`, but by convention a searcher only ever reads the narrow brief fields meant for it, not the whole state. You get checkpointing's audit trail and message-passing's discipline at once — the discipline just isn't enforced by the type system, so code review is where it actually gets held.",
    },
    {
      type: "heading",
      text: "The telephone game: why chains lose information",
    },
    {
      type: "paragraph",
      text: 'A single well-designed handoff brief solves the full-history-vs-one-liner problem for *one* hop. It does not automatically solve it for a **chain** of hops, and that\'s a distinct failure mode worth naming on its own: at each step, an agent summarizes what it received into a fresh brief for the next agent — and a summary of a summary loses whatever the first agent judged unimportant, even if it was a hard constraint. A user says "refund the coffee maker, but only if it\'s still sealed." Triage briefs the returns specialist with `task: "process refund for coffee maker"` — reasonable-looking, but the conditional silently dropped because it read like a detail rather than a constraint. The returns specialist briefs the payment agent with `task: "issue refund, item: coffee maker"` — by hop three, a real constraint from the original request no longer exists anywhere in the system, and every individual handoff still looks locally correct.',
    },
    {
      type: "paragraph",
      text: "The fix isn't better summarization — it's recognizing that some fields shouldn't be *summarized* at all. Carry a small, explicit **hard-constraints** field (or a short list of verbatim quotes from the original request) through every hop of a chain unmodified, separate from the free-text `task` description each agent rewrites. Only the narrative gets compressed hop to hop; the constraints that must survive get passed as data, not prose, and nothing downstream is allowed to paraphrase them. This is the same principle as citations in Module 3's grounded generation: some information is too important to survive being retold.",
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "A support ticket says: \"Cancel my subscription, but only refund the last month if I haven't used the API in that time.\" It passes through triage → account-lookup agent → refund agent, each one rewriting a fresh `HandoffBrief.task` string summarizing the *previous agent's brief* (not the original ticket). The refund agent issues a full refund without checking API usage. Where's the bug, and what's the structural fix — not just \"tell the refund agent to read more carefully\"?",
      answer:
        'The bug is architectural, not a prompting slip in any single agent: each hop\'s brief is built by summarizing the *prior brief*, not the original request, so the conditional ("only if I haven\'t used the API") has to survive three consecutive re-summarizations to reach the refund agent — and conditionals are exactly the kind of detail a task-focused rewrite drops, because each intermediate agent is optimizing its summary for its own downstream task ("cancel the subscription") rather than preserving what it doesn\'t currently need. By hop three the eligibility condition is gone, and the refund agent, having never seen it, does nothing wrong *relative to what it was told*. The fix is structural: add a `hard_constraints: list[str]` field to `HandoffBrief` that is copied **verbatim** from the original ticket at the first hop and forbidden from being rewritten or dropped by any subsequent agent — every downstream agent must either satisfy each listed constraint or explicitly flag it as unresolvable, not silently omit it. More generally: **stop chaining hop-to-hop summaries and instead carry two channels through the whole chain — a narrative that each agent may compress for its own purposes, and a small constraints/facts channel that is copied, never re-derived.** Also log the original ticket text alongside every brief in the chain so a human debugging this later can diff each hop against the source, not just against the previous hop.',
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"Two teams both call their system 'multi-agent': one is a LangGraph graph with shared reducer-merged state, the other is a set of services shipping JSON messages over a queue with no shared memory. You're designing a fraud-review pipeline — which shape do you pick, and why?\"",
      answer:
        "I'd lead with what the product actually needs, not a stylistic preference. Fraud review typically needs a strong **audit trail**: given a flagged transaction, you need to reconstruct exactly what every stage saw and decided, potentially months later for a regulator or a dispute. Shared state with a durable checkpointer gives that almost for free — `get_state()` and time-travel are an audit log by construction. It also tends to be one team's system end to end, so the coupling cost of a shared schema is contained within one codebase and one release cycle, which is where shared state's debuggability advantage outweighs its coupling downside. I'd reach for message passing instead if the stages were owned by genuinely separate teams or services with independent deploy schedules — say, a third-party sanctions-screening vendor as one 'agent' in the pipeline — because forcing an external service to read and write your internal shared schema is either impossible or a tight coupling you don't want across an org boundary; a well-versioned message contract is the right interface there regardless of how either side is implemented internally. **Follow-up probe:** \"what if you need both — one regulated internal pipeline that also calls an external vendor?\" → Layer them: the internal pipeline is its own LangGraph with shared state and full checkpointing, and the boundary to the external vendor is a single node that translates internal state into a message-passing-style request/response, logged the same way a `HandoffBrief` is logged in this lesson. Shared state inside a trust boundary, structured messages across it.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Your orchestrator-workers research pipeline was fine until you added a fourth specialist stage between the writer and the critic. Output quality dropped. Debug the handoff chain for me, out loud."',
      answer:
        "I don't start by rereading prompts — I start by reading the handoff log chronologically, because per this lesson's core claim, most multi-agent bugs are briefing bugs, and adding a stage is exactly when a new one gets introduced. First check: does every brief in the chain still validate against its schema (Pydantic would already catch missing fields, so if it compiled, the bug is semantic, not structural). Second check, and the one I'd bet on: what does the *new* stage's brief actually contain — is it built from the original question and the writer's draft, or is it built by summarizing the writer's brief (which was itself built from the plan)? If the new stage sits between writer and critic and only receives the previous stage's already-condensed output, I'd suspect telephone-game loss — some constraint from the original question that the writer satisfied implicitly (because it saw the question directly) never made it into what the new stage passes to the critic, so the critic now judges against an incomplete picture of the requirements. Third check: whether the new stage is *restating* work the writer already did rather than adding new value — a sign the pipeline grew a stage without a clear, non-overlapping owner for any state field, which is Lesson 2's schema-design rule violated one level up. **Follow-up probe:** \"the logs show every brief in the chain is schema-valid and non-empty — that's fine then?\" → No — schema validity only proves the brief has the *shape* it's supposed to, not that it carries the *content* the receiver needs. I'd diff the hard-constraints/facts a human would consider essential against what actually survived from hop one to hop four, not just check that every field is populated with something.",
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
};
