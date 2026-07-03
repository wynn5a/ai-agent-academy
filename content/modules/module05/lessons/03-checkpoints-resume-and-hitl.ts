import type { Lesson } from "@/lib/types";

export const lesson03: Lesson = {
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
};
