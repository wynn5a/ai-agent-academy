import type { Lesson } from "@/lib/types";

export const lesson01: Lesson = {
  slug: "the-eval-pyramid",
  title: "The Eval Pyramid",
  minutes: 38,
  summary:
    "You cannot improve what you cannot measure, and 'it looked good when I tried it' is not measurement. Three tiers of rigor — cheap deterministic assertions, validated LLM-as-judge, sampled human review — and how to decide what belongs in each.",
  sections: [
    {
      type: "paragraph",
      text: "Every agent demo works. The demo is three hand-picked inputs the author already knows succeed. **Production is the other ten thousand inputs**, and the gap between demo and production is exactly the gap that evals close. An eval is a repeatable, automated judgment of whether your agent did the right thing on inputs it hasn't been tuned against. Without one, every prompt tweak is a coin flip you can't score.",
    },
    {
      type: "callout",
      kind: "insight",
      text: "**Prompts are code, and code needs tests.** The moment you edit a system prompt, swap a model, or reorder tools, you have shipped a change with unknown blast radius. An eval suite is the test suite that tells you whether the change helped, hurt, or did both to different inputs at once — which is the usual, invisible case.",
    },
    {
      type: "heading",
      text: "Three tiers, cheapest first",
    },
    {
      type: "paragraph",
      text: "Think of evals as a pyramid. The base is wide, cheap, and deterministic; each tier up is narrower, costlier, and more subjective. You run the base on every commit, the middle on every meaningful change, and the top on a sample. Push every judgment as far down the pyramid as it will honestly go — a check you can write as an assertion should never be handed to a model or a human.",
    },
    {
      type: "table",
      headers: ["Tier", "What it answers", "Cost", "When it runs"],
      rows: [
        [
          "Deterministic assertions",
          "Did it call the right tool? Valid JSON? Does the cited passage exist in the corpus? Did it stay under budget?",
          "Near zero",
          "Every commit, in CI",
        ],
        [
          "LLM-as-judge",
          "Is this answer faithful, relevant, and complete against a rubric?",
          "One judge call per case",
          "Every prompt/model change",
        ],
        [
          "Human review",
          "The subtle stuff: tone, edge-case correctness, whether the judge itself is drifting",
          "Expensive, slow",
          "Sampled, not exhaustive",
        ],
      ],
    },
    {
      type: "animation",
      name: "eval-loop",
      caption:
        "Input set → run agent → score against each tier → aggregate pass/fail + cost. The loop you run on every change.",
    },
    {
      type: "heading",
      text: "The base: deterministic assertions",
    },
    {
      type: "paragraph",
      text: "The most valuable evals are the boring ones. A huge fraction of agent quality is checkable without any model in the loop: the output parses, the right tool fired with the right arguments, a citation actually appears in the source corpus, no forbidden tool was touched, the run stayed under a token budget. These are fast, free, and never flaky — write them first and write a lot of them.",
    },
    {
      type: "code",
      language: "python",
      title: "assertion-style evals with pytest",
      code: `import json
import pytest
from my_agent import run_agent   # returns a Result with .text, .tool_calls, .usage

# A "golden" dataset: inputs paired with checkable expectations.
CASES = [
    {
        "id": "refund_under_limit",
        "prompt": "Refund my $40 order #A123, it arrived broken.",
        "must_call": "issue_refund",
        "must_not_call": "escalate_to_human",
    },
    {
        "id": "refund_over_limit",
        "prompt": "Refund my $900 order #B456.",
        "must_call": "escalate_to_human",
        "must_not_call": "issue_refund",
    },
]

@pytest.mark.parametrize("case", CASES, ids=lambda c: c["id"])
def test_tool_selection(case):
    result = run_agent(case["prompt"])
    called = {c.name for c in result.tool_calls}

    # Deterministic: exact tool-routing behavior, no model judgment needed.
    assert case["must_call"] in called, (
        f"expected {case['must_call']}, got {called}"
    )
    assert case["must_not_call"] not in called, (
        f"forbidden tool {case['must_not_call']} was called"
    )

def test_output_is_valid_json_when_structured():
    result = run_agent("Classify ticket: my card was double charged.")
    parsed = json.loads(result.text)          # raises if malformed
    assert parsed["category"] in {"billing", "bug", "feature_request", "other"}`,
      explanation:
        "These tests give you a green/red signal in seconds and cost nothing. Note the shape of a golden case: an input plus **checkable** expectations. Resist the urge to assert exact output strings — models phrase things differently across runs. Assert on structure, tool routing, and invariants, which are stable, not on prose, which is not.",
    },
    {
      type: "heading",
      text: "Task success vs. per-step correctness",
    },
    {
      type: "paragraph",
      text: "Track two different numbers and never conflate them. **Task success rate** asks: did the whole run achieve the user's goal? **Per-step correctness** asks: at each turn, was the tool choice and argument right? A high task-success rate can hide a swamp of wrong first steps the agent recovered from — expensive, slow recoveries that will break the moment the environment shifts. A high per-step rate with low task success means the pieces are right but the orchestration is wrong. You need both to know where to fix.",
    },
    {
      type: "code",
      language: "python",
      title: "scoring both metrics over a run set",
      code: `from dataclasses import dataclass

@dataclass
class RunScore:
    task_success: bool          # did the end state match the goal?
    steps_total: int
    steps_correct: int          # per-step tool+arg correctness

def summarize(scores: list[RunScore]) -> dict:
    n = len(scores)
    task_rate = sum(s.task_success for s in scores) / n
    step_num = sum(s.steps_correct for s in scores)
    step_den = sum(s.steps_total for s in scores)
    step_rate = step_num / step_den if step_den else 0.0
    return {
        "task_success_rate": round(task_rate, 3),
        "per_step_correctness": round(step_rate, 3),
        "n_runs": n,
        # A big gap here is the signal: high task, low step = lucky recovery.
        "recovery_gap": round(task_rate - step_rate, 3),
    }

print(summarize([
    RunScore(True, 4, 2),   # succeeded, but half the steps were wrong
    RunScore(True, 3, 3),
    RunScore(False, 5, 4),  # steps mostly right, task still failed
]))`,
      explanation:
        "The `recovery_gap` is diagnostic gold. If task success is 0.9 but per-step correctness is 0.6, your agent is limping to the finish on lucky recoveries — cheap to celebrate, expensive to maintain, and fragile under distribution shift. Report both metrics in every eval summary so you never mistake luck for reliability.",
    },
    {
      type: "callout",
      kind: "tip",
      title: "Start with 20, not 2,000",
      text: "You do not need a giant benchmark to begin. Twenty well-chosen cases — a few happy paths, a few known-hard inputs, every bug you've ever fixed — catch most regressions. A small suite that runs on every change beats a huge one that runs never. Grow it by accretion: every production failure becomes a new case.",
    },
    {
      type: "heading",
      text: "Eval economics: matching cost to cadence",
    },
    {
      type: "paragraph",
      text: "The three tiers don't just differ in rigor — they differ in **unit cost by orders of magnitude**, and cadence should track that gap. Deterministic assertions cost fractions of a cent and run in milliseconds, so run hundreds of them on every single commit. A judge call runs anywhere from a fraction of a cent to a dollar or two depending on context size, so a 50–200 case judged suite costs a few dollars and a couple of minutes — affordable on every prompt/tool/model change, but too slow and too expensive to run on every keystroke. Human review costs real labor — call it minutes to tens of minutes per item, loaded cost of dollars each — so it's sampled: a fixed percentage of live traffic reviewed weekly for freshness, plus a fuller audit on a slower cadence (many teams land on quarterly) to catch judge drift and rubric staleness. This is the cost/frequency/fidelity trade made explicit: cheaper tiers run far more often but answer a narrower question; fidelity to 'did this actually satisfy the user' rises as you go up the pyramid, and cost rises faster than fidelity does — which is exactly why you push every judgment as far down as it honestly goes before reaching for the next tier.",
    },
    {
      type: "table",
      headers: ["Tier", "Rough unit cost", "Sane cadence", "What you'd miss running it less often"],
      rows: [
        [
          "Deterministic assertions",
          "~$0, milliseconds",
          "Every commit",
          "Obvious breakage ships and burns a full judge/human cycle to catch",
        ],
        [
          "LLM-as-judge",
          "$0.01–$1+ per case",
          "Every prompt/tool/model change; full suite nightly",
          "Subtle quality regressions ride along for a day or more before detection",
        ],
        [
          "Human review",
          "Dollars per item (labor)",
          "Weekly sample + periodic full audit",
          "Judge drift and rubric staleness go unnoticed until scores are visibly wrong",
        ],
      ],
    },
    {
      type: "heading",
      text: "Capability evals vs. regression evals",
    },
    {
      type: "paragraph",
      text: "The same pyramid machinery answers two different questions, and conflating them into one aggregate number is a common, costly mistake. **Capability evals** ask *are we getting better?* — run a candidate change (new model version, rewritten prompt, a new technique) against a fixed, often deliberately hard benchmark and compare the score to the current baseline; you run these when deciding whether a change is worth shipping. **Regression evals** ask *did we break something that used to work?* — run the suite of accreted past failures (Lesson 3's territory) and look for any score decrease from baseline; you run these on every change, unconditionally. A change can raise the capability score while quietly regressing a previously-fixed edge case, and a team that only watches one blended average will ship it, because the net moved up. The discipline: report the two deltas **separately** in every change review — capability delta where up is good, regression delta where any red is a blocker — and never let a big capability win buy forgiveness for a regression.",
    },
    {
      type: "exercise",
      kind: "predict",
      prompt:
        "To cut CI spend, a team moves its LLM-judge suite from 'runs on every PR touching prompts' to 'runs once, nightly.' Two weeks later a prompt regression merges and serves degraded answers in production for 18 hours before the nightly run catches it. What did the cadence change actually trade away, and what's the fix that keeps cost down without reopening that window?",
      answer:
        "It traded detection **latency** for cost savings, and did so by moving the entire judge tier off the merge gate rather than right-sizing it. The fix isn't 'judge suite on every PR again' (back to the original cost) or 'nightly forever' (back to the 18-hour window) — it's splitting the tier: keep the deterministic suite gating every commit as before (it already catches a large share of breakage for free), add a small, fast, high-risk **subset** of the judge suite (5–15 cases covering the riskiest known failure modes) that runs on every PR touching prompts/tools/model as a cheap smoke test, and reserve the **full** judged suite plus sampled human review for the nightly/full run. This keeps the per-PR cost close to what motivated the change while closing the 18-hour blind spot for the highest-risk regressions — the ones a smoke subset is specifically curated to catch. The general lesson: when cost pressure hits a tier, split the tier by risk before you drop its cadence to zero on the merge path.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"Design the eval pyramid for a coding agent that opens pull requests. What goes in each tier, and how often does each run?\"",
      answer:
        "Name concrete checks per tier, then state cadence. **Deterministic** (every commit): does the diff compile/lint, do existing tests still pass, is the diff within a size budget, did it touch only files in scope, no forbidden paths (CI config, secrets) written without a separate gate. **Judge tier** (every PR the agent opens): is the PR description accurate to the actual diff, is the change minimally scoped rather than drive-by refactoring, does it follow the repo's style conventions — each a narrow, rubric-anchored question, not a holistic 'is this a good PR?' score. **Human tier**: sampled senior-engineer review of a percentage of merged agent PRs weekly, plus a periodic full audit checking judge-human agreement hasn't drifted. Then split the *kind* of question, not just the tier: a **capability** benchmark (a fixed set of held-out issues, tracked over prompt/model versions) answers 'is the agent getting better at real tasks,' while the **regression** suite (every bug ever caused by an agent PR, replayed) answers 'did this change reintroduce a known-bad pattern' — report both deltas separately when deciding whether to ship a prompt change. **Follow-up probe:** \"the capability benchmark score is flat for two months — is that fine?\" → not necessarily: check whether it's a true plateau or a ceiling effect (the benchmark saturated and can't discriminate improvements anymore) versus real stagnation — a flat capability score with a growing regression suite that keeps catching new failures suggests the team is treading water, not standing still.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"Your regression suite score has been flat for three months, but a teammate says quality feels worse. What's your hypothesis, and how do you check it?\"",
      answer:
        "Hypothesis: the suite has gone stale relative to the live traffic distribution. A flat regression score only proves nothing regressed **on those specific 20–50 cases** — it says nothing about failure modes the suite never learned about, because it's built entirely from yesterday's postmortems. 'Quality feels worse' is exactly the signal a purely-regression-focused eval program is blind to. To check it: pull a fresh sample of recent production traces (not filtered by whether they triggered a complaint), score them against the current rubric, and compare to historical performance on similarly-sampled traffic; cross-reference against any user-feedback signal (thumbs-down rate, ticket volume) for a directional read; and look at whether the mix of tasks users are attempting has shifted — a suite frozen from six months ago encodes a traffic distribution that may no longer exist. The fix is procedural: keep growing the suite by accretion as the lesson describes, but also periodically **refresh** it with a fresh production sample regardless of whether anything broke, and maintain a separate capability benchmark that isn't defined by past failures at all, since a regression-only program can't detect decline in dimensions no past failure ever exercised. **Follow-up probe:** \"the capability benchmark also hasn't moved\" → check for a ceiling effect (ask whether any technique could plausibly move this benchmark further) versus genuine stagnation; if the benchmark itself no longer discriminates between good and mediocre runs, it's time to retire or expand it, the same way a saturated technical interview question stops being useful once everyone's seen it.",
    },
    {
      type: "keypoints",
      points: [
        "Evals turn 'it looked good' into a repeatable score on inputs you didn't tune against.",
        "Pyramid: deterministic assertions (base, in CI) → validated LLM-as-judge (middle) → sampled human review (top).",
        "Push every judgment as far down the pyramid as it honestly goes; an assertion is better than a judge.",
        "Assert on structure, tool routing, and invariants — never on exact prose.",
        "Track task success AND per-step correctness; the gap between them reveals fragile recoveries.",
        "Twenty good cases run on every change beat two thousand run never.",
        "Match cadence to cost: assertions on every commit, judge evals on every meaningful change (a cheap risk-based subset on PRs, the full suite nightly), human review sampled weekly plus a periodic full audit.",
        "Capability evals ('are we getting better?') and regression evals ('did we break something?') are different questions — report their deltas separately, never blended into one number.",
      ],
    },
  ],
};
