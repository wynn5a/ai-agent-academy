import type { Lesson } from "@/lib/types";

export const lesson05: Lesson = {
  slug: "when-multi-agent-is-worth-it",
  title: "When Multi-Agent Is Worth It (Usually It Isn't)",
  minutes: 35,
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
        question=question, a=a, b=b))          # structured output, JSON schema
    verdict["winner"] = mapping.get(verdict["winner"], "tie")
    return verdict`,
      explanation:
        'Module 3 habits apply: judges have position bias (randomize order) and need a rubric (not "which is better?"). Get consistency from the rubric and a strict output schema, not a sampling knob — current frontier Claude models reject `temperature`/`top_p`/`top_k` entirely (Module 1), so "run it at temperature 0" isn\'t available; a narrow, structured rubric is what current models rely on for repeatable judging. Spot-check a sample of judgments by hand and report your own rubric scores alongside the judge\'s. If the single agent wins, **say so in the README** — an honest negative result is a stronger portfolio signal than a rigged win.',
    },
    {
      type: "callout",
      kind: "tip",
      title: "The interview answer",
      text: 'When asked "how would you design a multi-agent system for X?", the senior move is to first ask whether X needs one: "I\'d start with a single agent with good tools and measure it. I\'d split only for context isolation, true parallelism, or distinct permissions — and I\'d keep the single-agent baseline running in my evals so I know the split is paying for its coordination cost." That answer signals judgment; jumping straight to a five-agent diagram signals you read too many vendor blog posts.',
    },
    {
      type: "heading",
      text: "Cost multiplication, worked",
    },
    {
      type: "paragraph",
      text: "\"Multi-agent costs more\" is easy to say and easy to underestimate — the multiplier isn't the agent count, it's **agent count × iterations per agent × handoff re-sends**. Take a single agent averaging 8 loop iterations at roughly 3k tokens each: about 24k tokens for the task. Now the five-role research pipeline: planner runs 2 iterations, three parallel searchers run 4 each (12 total), the writer runs 3, the critic runs 2 for one revision cycle — 19 agent-iterations total, which sounds almost comparable to the single agent's 8. It isn't, because each of those iterations pays for **context the single agent never re-sent**: every searcher re-includes its brief and the tools it needs, the writer re-includes every finding, the critic re-includes the plan, the question, and the full draft. The realistic outcome on real workloads is **2–4× the single agent's token cost for the same task**, not 19/8. This is exactly why the baseline harness above sums tokens across *every* call including the orchestrator's — a comparison that only counts \"the interesting agents' \" tokens will always make multi-agent look cheaper than it is.",
    },
    {
      type: "heading",
      text: "Debugging multiplication",
    },
    {
      type: "paragraph",
      text: "Cost isn't the only thing that scales with agent count — **debugging surface area does too, and worse than linearly**. A single agent has one loop to trace. A five-node pipeline has five nodes *and* four handoffs, and a wrong final answer could originate at any of those nine places — plus a tenth: the interaction between two of them, where each individually looks correct in isolation (Lesson 4's briefing-bug pattern). Failures also **mask each other**: a planner that silently drops a subtask doesn't look like a bug until three stages later, when the writer's draft is missing a section, and the instinct is to debug the writer — the actual defect is two hops upstream, in a component whose output looked fine because it was never checked against the original question, only consumed as-is by the next node. Multi-agent systems therefore have a non-negotiable observability tax on top of the token tax: every node **and** every handoff needs its own log entry (Lesson 4), because a system you can't fully instrument at N=5 is a system you can't debug at N=5, no matter how good any individual agent's prompt is.",
    },
    {
      type: "heading",
      text: "Escalate on evidence, not vibes",
    },
    {
      type: "paragraph",
      text: "The \"Justified when…\" table above tells you the three legitimate reasons; this is the protocol for finding out whether *your* system actually has one of them, instead of pattern-matching an architecture diagram to a vague feeling that \"this task feels like it needs a team.\" Measure the single agent first, on the real workload, before designing a single node of a multi-agent replacement.",
    },
    {
      type: "table",
      headers: [
        "Question to measure",
        "How to measure it",
        "What justifies escalating",
      ],
      rows: [
        [
          "Is context actually degrading?",
          "Plot the single agent's error/quality rate against conversation length or tool-call count on real traces",
          "Quality drops measurably past some context size — that's context isolation's evidence, not a hunch about 'long contexts are bad'",
        ],
        [
          "Are subtasks actually independent?",
          "Profile the single agent's tool calls: do later calls depend on earlier results, or could they run with no shared state?",
          "A real chunk of wall-clock time is spent on calls that don't depend on each other — that's true parallelism's evidence",
        ],
        [
          "Does blast radius actually matter here?",
          "Ask what the worst-case action is if the model is confused or compromised, and who/what it can currently touch",
          "The worst case is unacceptable and the tool set can be cleanly partitioned by role — that's the permissions justification's evidence",
        ],
        [
          "None of the above show up",
          "—",
          "Ship the single agent. Revisit only when new measurements say otherwise, not when a new pattern trends on social media",
        ],
      ],
    },
    {
      type: "exercise",
      kind: "predict",
      prompt:
        "Your baseline comparison returns: single-agent quality 7.8/10, cost $0.04/question, latency 6s. Multi-agent: quality 8.0/10, cost $0.19/question, latency 14s — and your judge's own hand-labeled agreement rate (Module 3's calibration habit) is 90%. The team wants to ship multi-agent because \"the numbers are better.\" What's your call, and what number is missing before anyone can be confident either way?",
      answer:
        "Ship the single agent, and say explicitly why the \"the numbers are better\" framing is wrong: the quality delta (8.0 vs. 7.8, a 0.2-point gap) is being read off a judge whose own agreement with human labels is only 90% — a judge that disagrees with a careful human one time in ten has more than enough noise in it to produce a 0.2-point gap on 10 questions with zero real quality difference underneath. That gap has not been shown to be real. The cost and latency deltas, by contrast, are not statistical artifacts — a 4.75× cost multiple and a 2.3× latency multiple are direct measurements of tokens spent and clock time elapsed, not judge opinions, so they're solid ground to make a decision on even with a small sample. The missing number is a **confidence interval or significance test on the quality delta** — bootstrap over more questions, or at minimum run the judge multiple times with order randomized and report the spread, before treating 8.0 vs. 7.8 as a real difference rather than noise. The senior answer to the team: 'we have a real, measured 4–5x cost increase and a quality difference we haven't shown is distinguishable from judge noise — that's not a case for shipping multi-agent, that's a case for either a bigger eval set or staying with the cheaper system.'",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"An exec says: 'let's build an agent team like a real company — a CEO agent managing VP agents.' Push back, in the room, without being condescending.\"",
      answer:
        "I wouldn't attack the metaphor directly — I'd redirect it to evidence, because the org-chart instinct usually comes from a real, if vaguely-articulated, frustration with the current system. I'd ask: 'what specifically is the single agent failing at today — is it getting confused on long tasks, is it too slow because things that could run in parallel are running sequentially, or is it doing something risky that a narrower-permissioned agent wouldn't be able to do?' Each answer maps directly onto one of the three legitimate justifications, and if there's a concrete symptom, I now have a scoped, defensible reason to split — 'the researcher role needs a clean context because our traces show quality dropping past 40k tokens' is a sentence I can act on; 'let's build a team' is not. If there's no concrete measured symptom yet, I'd propose spending two weeks instrumenting the current single agent's failures before designing anything, which usually reframes the conversation from architecture-as-aesthetic to architecture-as-consequence-of-data. I keep the tone collaborative — 'let's find out which of these three reasons applies to us' rather than 'multi-agent is a bad idea' — because the exec isn't wrong that something needs to improve, they're just reaching for the org-chart shape before checking whether it's the right shape for *this* failure. **Follow-up probe:** \"it's already decided at the VP level, non-negotiable — now what?\" → I'd constrain the blast radius: ship the smallest possible version (two agents, not five), and instrument the single-agent-vs-multi-agent baseline comparison as part of v1 regardless of whether this decision used one. Even a decision made without evidence can produce evidence for the *next* one — that's the leverage point that's still available.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"How do bugs actually multiply going from one agent to five? Give me the mechanism, not just 'it's harder.'\"",
      answer:
        "Three concrete mechanisms, not a vibe. First, **surface area**: a single agent has one loop and one prompt to suspect; five agents have five prompts plus four handoffs, so the number of places a defect can live scales roughly with nodes-plus-edges, not just node count — and Lesson 4 already showed that most of those defects hide in the edges, not the nodes. Second, **masking**: an error introduced early doesn't announce itself where it happens — it gets consumed silently by the next stage, which builds on it without complaint, and only becomes visible several hops later as a symptom that looks like it belongs to whichever stage produced the visibly-bad output, which is almost never where the actual defect is. Third, **combinatorial interaction**: two agents can each behave correctly given their own inputs and still produce a bad outcome together, because the bug is in the boundary — what one agent assumed the brief meant versus what the other agent intended by it — and that class of bug doesn't show up in either agent's unit tests, only in the full chain. All three mean the instrumentation bar is categorically higher, not just 'more logging would be nice': you need a full node-plus-handoff trace to even have a chance of localizing a bug, because you can't unit-test your way out of an interaction defect. **Follow-up probe:** \"so how do you actually start debugging a 5-agent system when the final answer is wrong?\" → Read the handoff log chronologically from the beginning, not backward from the bad output. At each hop, check the *input* that stage received against what the upstream stage's brief promised to send — before judging whether that stage's own output looks reasonable. The defect is almost always at the point where what was promised and what was received disagree, which is Lesson 4's briefing-bug insight applied as a debugging procedure rather than a design principle.",
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
