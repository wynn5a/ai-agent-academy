import type { Lesson } from "@/lib/types";

export const lesson05: Lesson = {
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
};
