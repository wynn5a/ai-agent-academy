import type { Lesson } from "@/lib/types";

export const lesson04: Lesson = {
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
};
