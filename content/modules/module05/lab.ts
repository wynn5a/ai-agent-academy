import type { Lab } from "@/lib/types";

export const lab05: Lab = {
  title: "Multi-Agent Research System with Single-Agent Baseline",
  portfolio: true,
  objective:
    "Build a planner → parallel searchers → writer → critic research system in LangGraph that answers questions with a cited brief — checkpointed, resumable, with a human approval gate and logged structured handoffs — then benchmark it honestly against a single agent with the same tools. You scaffold the project yourself; the skeleton below is the file map.",
  sections: [
    {
      type: "callout",
      kind: "info",
      title: "Before you start",
      text: 'New dependencies: `pip install langgraph "langchain[anthropic]" langgraph-checkpoint-sqlite` (swap in `langchain[openai]` if you\'re on the OpenAI tab). The last one matters: the durable SQLite checkpointer (`SqliteSaver`) lives in that separate package, and the kill-and-resume acceptance criterion fails with the default in-memory saver. If you use web search rather than a local corpus, you\'ll also need a search tool/API of your choice. Budget two to three days including the baseline comparison.',
    },
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
# one model for every node AND the baseline — swappable by one string:
# model = init_chat_model("anthropic:claude-sonnet-5")  # or: "openai:gpt-5.5"
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
    {
      type: "heading",
      text: "Ship it to your portfolio",
    },
    {
      type: "list",
      items: [
        "**README with a 60-second demo** — architecture diagram up top, then a short clip or GIF: question in, planner fans out, gate pauses, human approves, cited brief out. Hiring managers look at GitHub before the résumé; make the first minute count.",
        "**Logged inter-agent traces** — commit a sample `handoffs.jsonl` and link it from the README. A multi-agent system with specialized roles and logged inter-agent traces is a specifically-cited portfolio project in hiring guides, and the trace file is the artifact reviewers actually open.",
        "**Demonstrate the HITL approval flow** — capture the pause (process exits), then the resume with both an approve and a reject-with-feedback. Approval gates in front of irreversible actions are what enterprises specifically screen for.",
        "**An honest 'Limitations' section** — where the single agent won or tied, the judge's noise floor, and what you'd measure next before trusting the multi-agent claim. A measured negative result reads as senior; a suspiciously uniform win reads as rigged.",
      ],
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
};
