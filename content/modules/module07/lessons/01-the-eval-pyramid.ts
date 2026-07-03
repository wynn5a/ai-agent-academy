import type { Lesson } from "@/lib/types";

export const lesson01: Lesson = {
  slug: "the-eval-pyramid",
  title: "The Eval Pyramid",
  minutes: 28,
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
      type: "keypoints",
      points: [
        "Evals turn 'it looked good' into a repeatable score on inputs you didn't tune against.",
        "Pyramid: deterministic assertions (base, in CI) → validated LLM-as-judge (middle) → sampled human review (top).",
        "Push every judgment as far down the pyramid as it honestly goes; an assertion is better than a judge.",
        "Assert on structure, tool routing, and invariants — never on exact prose.",
        "Track task success AND per-step correctness; the gap between them reveals fragile recoveries.",
        "Twenty good cases run on every change beat two thousand run never.",
      ],
    },
  ],
};
