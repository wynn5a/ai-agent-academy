import type { Lesson } from "@/lib/types";

export const lesson03: Lesson = {
  slug: "checkpoints-resume-and-hitl",
  title: "Checkpoints, Resume & Human-in-the-Loop",
  minutes: 35,
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
      code: `# Colab cell 1 — run once. No API key needed; nodes are stubbed.
!pip install -q langgraph

import operator
from typing import Annotated, TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver


class State(TypedDict):
    question: str
    steps: Annotated[list[str], operator.add]


def plan(state: State) -> dict:   return {"steps": ["planned"]}
def search(state: State) -> dict: return {"steps": ["searched"]}
def write(state: State) -> dict:  return {"steps": ["wrote"]}

builder = StateGraph(State)
for name, fn in [("plan", plan), ("search", search), ("write", write)]:
    builder.add_node(name, fn)
builder.add_edge(START, "plan")
builder.add_edge("plan", "search")
builder.add_edge("search", "write")
builder.add_edge("write", END)

# In-memory checkpointer: perfect for dev/tests. For Lab 05's
# "resume after a killed process" criterion you need a DURABLE one --
# the sqlite or postgres checkpointer packages -- same interface.
checkpointer = MemorySaver()
graph = builder.compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": "research-042"}}
graph.invoke({"question": "Compare vector DB index types"}, config)

# The checkpointer snapshots state after every step, keyed by thread_id.
# get_state() is your debugging window into any thread:
snapshot = graph.get_state(config)
print(snapshot.values)        # the persisted state dict (all steps ran)
print(snapshot.next)          # () — nothing left to run; the graph completed

# The state lives in the CHECKPOINTER, not the graph object. A brand-new
# graph compiled against the same checkpointer + thread_id sees it:
graph2 = builder.compile(checkpointer=checkpointer)
print(graph2.get_state(config).values)   # same state — survived the object`,
      explanation:
        'The `thread_id` is the resume key — one per research job in Lab 05. `get_state()` is your debugging window: `snapshot.next` tells you which node(s) would run next (empty here because the run completed; after a real crash mid-graph it names exactly where execution stopped). The last three lines make the point concrete: a fresh graph object reads the same persisted state, because it lived in the checkpointer, not in process memory — that is the entire difference from a bare `while`-loop. `MemorySaver` still dies with the process; swap in a SQLite/Postgres checkpointer (separate packages, identical interface) for durability across restarts, which cell 2 and the lab rely on.',
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
      code: `# Colab cell 2 — run cell 1 first (langgraph installed, MemorySaver
# imported). No API key needed: this is a real, runnable interrupt/resume.
from typing import TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt, Command


class GateState(TypedDict):
    draft: str
    critique: str


def human_gate(state: GateState) -> dict:
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


builder = StateGraph(GateState)
builder.add_node("human_gate", human_gate)
builder.add_edge(START, "human_gate")
builder.add_edge("human_gate", END)
graph = builder.compile(checkpointer=MemorySaver())

# --- caller side ---
config = {"configurable": {"thread_id": "gate-001"}}
graph.invoke({"draft": "The answer is 42.", "critique": ""}, config)
print("paused at:", graph.get_state(config).next)   # ('human_gate',)

# ...later, possibly in a different process: resume the SAME thread with
# the human's decision injected as interrupt()'s return value.
graph.invoke(
    Command(resume={"approved": False, "feedback": "cite sources 2 and 3"}),
    config,
)
print("resumed; critique:", graph.get_state(config).values["critique"])`,
      explanation:
        "This uses the `interrupt()` / `Command(resume=...)` pair from recent LangGraph versions; older code used `interrupt_before=[\"node\"]` at compile time plus state edits, and the exact surface may evolve — check your installed version's docs. The mechanics to remember are stable, and the demo shows them end to end with no key: the first `invoke` runs until `interrupt()`, checkpoints, and stops (`get_state().next` now names the paused node); the second `invoke` resumes the same thread with the human's value injected. One subtlety: on resume, the interrupted node re-runs from its top, so keep code before `interrupt()` idempotent.",
    },
    {
      type: "callout",
      kind: "warning",
      title: "Don't ship MemorySaver",
      text: '`MemorySaver` holds checkpoints in the Python process — it demonstrates the API but provides zero durability. Lab 05\'s acceptance criterion is literally "kill the process, resume": that requires the SQLite (single machine) or Postgres (production) checkpointer. Also budget for storage: checkpointing full state every step for every thread adds up — durable checkpointers need a retention/cleanup policy in real deployments.',
    },
    {
      type: "heading",
      text: "What's actually in a checkpoint, and the exactly-once trap",
    },
    {
      type: "paragraph",
      text: "\"The checkpointer persists state\" undersells what has to be captured for resume to actually work. A checkpoint isn't just your `TypedDict` — it's the **full state values, plus which node(s) are next** (`snapshot.next`), plus, in a graph paused mid-fan-out, bookkeeping about which parallel branches have and haven't completed. Miss any of that and resume silently does the wrong thing: a naive reimplementation that serializes only your business fields (`plan`, `findings`, `draft`) and forgets the \"which node is pending\" bookkeeping has no way to know whether it should re-run the writer or re-dispatch three searchers — it can restore your data without being able to restore your **position in the graph**. That's precisely why you use the framework's checkpointer rather than rolling your own state dump: the hard part was never the JSON serialization.",
    },
    {
      type: "paragraph",
      text: 'The sharper problem is what happens when a node performs a **side effect on the outside world** — sending an email, charging a card, filing a ticket — and the process dies after that side effect fires but before the checkpoint recording "this node finished" is durably written. On resume, the node re-runs from its top (the same subtlety already flagged for interrupts), which means the side effect can fire **twice**. This is exactly Module 1\'s idempotency lesson, one layer up: there, a retried tool call risked double-charging a customer; here, a *resumed graph* risks the same thing, and the fix is the same shape — a **stable idempotency key** (derived from `thread_id` + node name + a business key, not from anything that changes between the two attempts) that the downstream system dedupes on. Two structural habits make this tractable: keep side-effecting work in its own single-purpose node that does as little else as possible, so "the node re-runs" means "the one guarded side effect is re-attempted," not "a chain of unrelated work re-executes too"; and remember that LangGraph checkpoints after every node execution, so the smaller that node\'s blast radius, the smaller your redo window.',
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "A `send_approval_email` node calls the mail API, then updates a `notified: True` state field, then returns. The pod is OOM-killed one line after the mail API call succeeds — before the state update and before the checkpoint write complete. The orchestrator restarts and resumes the same `thread_id`. What happens, and how should the node have been structured to prevent it?",
      answer:
        'Because the checkpoint from *before* this node ran is the last durable one, resume re-executes `send_approval_email` from its top — the framework has no record that the mail API call already succeeded, because that fact never made it into a checkpoint. The email goes out a second time. This is the exactly-once trap: **the side effect and the checkpoint are not atomic with each other**, and no amount of "the framework handles persistence" changes that, because the side effect happens outside the framework\'s transaction boundary entirely. The structural fix: give the send call a stable idempotency key — derived from `thread_id` plus a fixed string like `"approval-email"`, not from a timestamp or random UUID generated inside the node, since that would be different on each attempt and defeat the point — and pass that key to the mail provider\'s idempotency/dedup mechanism (most transactional email and payment APIs support one natively). That way, a resumed re-run of the node calls the API again, but the provider recognizes the key and no-ops the second send instead of delivering a duplicate. If the downstream system has no idempotency support at all, the fallback is to check-then-act against your own durable record *before* calling out (query "did I already send this key?"), accepting a small unavoidable race, and to keep the node doing nothing but the send — no unrelated logic before or after it that would also silently re-run.',
    },
    {
      type: "heading",
      text: "Designing the human gate: placement and payload",
    },
    {
      type: "paragraph",
      text: 'Two decisions determine whether a HITL gate is actually safe, and both are easy to get subtly wrong. **Placement**: the interrupt belongs immediately before the irreversible action, not merely "somewhere before the end." Generating a draft payment request, validating it, and formatting it for review are all reversible — do that work before the gate. The interrupt sits right before the node that actually calls the payment provider, so that everything after the human says yes is the smallest possible unit of real-world consequence, which also shrinks the exactly-once redo window from the previous section. A gate placed one node too early (say, before drafting instead of before dispatching) forces the human to approve something that still has to survive another round of processing before it matches what they saw. **Payload design**: don\'t hand the human your internal state dict and call it a review UI. Apply the same discipline as Lesson 4\'s handoff briefs — show exactly what will happen if they approve (the concrete action, amounts, recipients — a diff, not a transcript), not raw agent scratch state they\'d have to reverse-engineer. And structure the resume value as validated, typed input (`{"approved": bool, "feedback": str}`) rather than freeform text the node has to re-parse — a human gate that accepts arbitrary prose just relocates the parsing-unreliable-output problem from the model onto the human\'s typing.',
    },
    {
      type: "callout",
      kind: "career",
      text: "Hiring guides call out human-in-the-loop approval flows for irreversible actions as what enterprises specifically need before an agent is allowed near payments, deploys, or customer email — and it's a recurring screen for senior agent-engineering roles. Being able to demo a durable gate (graph pauses, the process exits, a different process resumes days later with the decision) and explain the exactly-once trap around it signals production judgment in a way no framework name on a résumé does.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Walk me through everything that has to be true for your HITL system to be safe to leave paused for a week."',
      answer:
        "I'd list it as a checklist, because in an interview this is where people hand-wave. **Durability**: a real checkpointer — SQLite or Postgres, never `MemorySaver` — because a week-long pause across deploys and restarts is exactly the scenario in-process storage can't survive. **Stable identity**: the `thread_id` scheme has to be deterministic and collision-free (a business key like the research job ID, not a random value generated per attempt) so whoever resumes it a week later can find it. **Idempotent pre-interrupt code**: the interrupted node re-runs from its top on resume, so anything before the `interrupt()` call — including any side effects — must be safe to repeat, per the exactly-once discussion above. **Self-contained payload**: the approval payload can't reference ephemeral resources — a signed URL or a session token that expires in an hour is useless to someone approving on day six; embed what's needed to render the decision, or re-derive fresh links at resume time. **Access control**: durable doesn't mean undirected — I need to know *who* is allowed to resume a given thread, or I've built an approval gate anyone with API access can rubber-stamp. **Retention and expiry**: a policy for how long a paused thread is allowed to sit before it's flagged stale, because 'durable' silently became 'forgotten' more than once in every team's history. **Follow-up probe:** \"what if the human never responds?\" → Durability guarantees the graph *can* resume; it says nothing about *whether* it will. I'd add a timeout path: a scheduled job that scans for threads paused past some SLA and escalates — pages a backup approver, or auto-rejects with a reason — so a stale thread has an owner instead of quietly aging in a database forever.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** A graph drafts a payment request, validates it, and — after human approval — dispatches it to a payment provider. Where exactly do you place the `interrupt()`, and defend the placement.",
      answer:
        "Right before the node that makes the actual call to the payment provider — not before drafting, and not folded into a single \"prepare and send\" node. Drafting and validating are reversible: if the human never gets to approve, or rejects, nothing in the real world happened yet, so that work can safely precede the gate and even be redone on a resumed run without consequence. The moment the graph crosses into an irreversible external effect, that's where the human has to have already said yes — placing the gate any earlier means the human is approving a proposal that still has to survive more processing (a validation bug found *after* approval) before it matches what they saw, and placing it any later defeats the point of asking at all. I'd also keep the post-approval dispatch node minimal — its only job is to make the guarded call with an idempotency key — so that if something goes wrong and the node re-runs after resume, the blast radius of a repeat is as small as the exactly-once discussion requires. **Follow-up probe:** \"the payment provider call itself times out after it already debited the account — does the interrupt help there?\" → No, and it's important to say so explicitly: the interrupt only governs whether a human authorized the action before it happened. Once you're past the gate, you're in ordinary side-effect safety territory — the same idempotency-key-plus-reconciliation discipline as any non-interrupt-guarded `charge_customer` call from Module 1. Conflating the two is a common design mistake: teams think a human approval step makes the downstream call safe, when it only makes the *decision* to attempt it accountable.",
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
};
