import type { Lesson } from "@/lib/types";

export const lesson03: Lesson = {
  slug: "regression-suites-in-ci",
  title: "Regression Suites in CI",
  minutes: 36,
  summary:
    "A bug you fixed without a test is a bug you will ship again. Every fixed failure becomes a permanent test case; the whole suite runs on every prompt and model change; the pipeline reports pass/fail and cost. This is how prompts become code.",
  sections: [
    {
      type: "paragraph",
      text: "In normal software, when you fix a bug you add a test so it never comes back. Agent engineering is no different, except the 'code' includes your prompts, your tool descriptions, and the model version. **Every one of those is a change that can silently regress behavior you already fixed.** The discipline: the moment you fix a failure, you capture it as a case in the regression suite, and the suite runs on every change to any of those inputs.",
    },
    {
      type: "callout",
      kind: "insight",
      text: "A prompt change is a deploy. It can improve nine cases and quietly break the tenth — the one a customer hit last month. Without a regression suite you will never see the breakage until the customer hits it again. The suite is the only thing standing between 'I tweaked the prompt' and a production incident.",
    },
    {
      type: "heading",
      text: "Turn every fixed bug into a case",
    },
    {
      type: "paragraph",
      text: "The workflow is mechanical and non-negotiable. A failure comes in. You reproduce it, understand it, fix it. Before you close it, you write the minimal case that fails on the old behavior and passes on the new — and you add it to the suite. Over a few months this accretes into a suite that encodes your agent's entire painful history, so it can never repeat it.",
    },
    {
      type: "code",
      language: "python",
      title: "a regression suite that mixes assertions and judged answers",
      code: `import json, pathlib
from my_agent import run_agent
from my_judge import run_judge, FAITHFULNESS_RUBRIC

# Each case declares HOW it should be scored, so the runner can mix tiers.
# cases/*.json example:
# {"id":"bug_412_empty_cart","prompt":"...","check":"assert",
#  "must_call":"lookup_cart","must_not_call":"issue_refund"}
# {"id":"bug_419_hallucinated_policy","prompt":"...","check":"judge",
#  "rubric":"faithfulness"}

def load_cases():
    for path in sorted(pathlib.Path("cases").glob("*.json")):
        yield json.loads(path.read_text())

def score_case(case) -> tuple[bool, float]:
    result = run_agent(case["prompt"])
    cost = result.usage.dollars      # tracked per run (next lesson)

    if case["check"] == "assert":
        called = {c.name for c in result.tool_calls}
        ok = (case.get("must_call", None) in called or "must_call" not in case) \\
             and case.get("must_not_call", "___none___") not in called
        return ok, cost

    if case["check"] == "judge":
        verdict = run_judge(result.text, FAITHFULNESS_RUBRIC)
        return verdict == "pass", cost

    raise ValueError(f"unknown check type: {case['check']}")

def main():
    passed = failed = 0
    total_cost = 0.0
    failures = []
    for case in load_cases():
        ok, cost = score_case(case)
        total_cost += cost
        if ok:
            passed += 1
        else:
            failed += 1
            failures.append(case["id"])
    print(f"PASS {passed}  FAIL {failed}  COST $" + f"{total_cost:.3f}")
    if failures:
        print("failing cases:", ", ".join(failures))
    raise SystemExit(1 if failed else 0)   # non-zero fails the CI job

if __name__ == "__main__":
    main()`,
      explanation:
        "One command, mixed tiers, and a cost line in the output. The `raise SystemExit(1 ...)` is what makes it a real CI gate — a non-zero exit fails the pipeline job and blocks the merge. Storing cases as small JSON files means adding a regression is a one-file commit, and the diff makes the new coverage reviewable.",
    },
    {
      type: "heading",
      text: "What belongs in a prompt-change CI pipeline",
    },
    {
      type: "list",
      items: [
        "**The deterministic suite** on every commit — fast, free, blocks obvious breakage.",
        "**The judged suite** on changes to prompts, tools, or model version — the ones that can shift behavior subtly.",
        "**A cost budget check** — fail the build if aggregate eval cost or per-run cost jumps beyond a threshold, so a prompt that doubles token use gets caught here, not in the bill.",
        "**Pinned model versions** in the eval config, so you know whether a change came from your edit or a silent provider update.",
        "**A diff-friendly report** posted to the PR: pass/fail counts, newly failing cases, cost delta versus main.",
      ],
    },
    {
      type: "code",
      language: "yaml",
      title: "wiring the suite into GitHub Actions",
      code: `name: agent-evals
on:
  pull_request:
    paths:
      - "prompts/**"
      - "src/agent/**"
      - "cases/**"
jobs:
  regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt
      - name: Run deterministic + judged regression suite
        env:
          ANTHROPIC_API_KEY: {{ secrets.ANTHROPIC_API_KEY }}
        run: python -m evals.run_suite     # exits non-zero on any failure`,
      explanation:
        "The `paths` filter is deliberate: the judged suite costs money per run, so you gate it on changes to the things that actually move behavior — prompts, agent source, and cases. In real YAML the secret reference uses the dollar-brace syntax around secrets.ANTHROPIC_API_KEY; it is written with plain braces here to keep the sample copy-safe. Keep the deterministic-only suite on a broader trigger since it is free.",
    },
    {
      type: "callout",
      kind: "warning",
      title: "Beware eval flakiness",
      text: "LLM outputs vary run to run, so a judged case can flip on a good day. Current frontier Claude models don't accept temperature/top_p/top_k at all (the API returns a 400 if you pass them), so 'turn down the randomness' isn't a lever here — reduce what you *can* control instead: pin fixtures, retrieval indexes, and timestamps so your own code contributes no extra variance, and prefer assertions over judgment wherever a check can be assertion-shaped. If a judged case flaps, that's a signal the rubric is too fuzzy or the behavior genuinely borderline — fix the case, don't just re-run until green. The next section makes 'how much flap is normal' precise.",
    },
    {
      type: "heading",
      text: "Statistical rigor at small n",
    },
    {
      type: "paragraph",
      text: "A single pass/fail run over a suite is one sample from a noisy process, and because the API gives you no determinism knob, re-running the *identical* prompt can produce a different tool call or a differently-phrased answer that a judge scores differently. On a 50-case suite, a swing from 82% to 84% (41/50 → 42/50) sits comfortably inside the noise you'd see from re-running the **same unchanged prompt** twice — treating it as evidence the change helped is a classic small-n mistake. Concretely: at n=50, the 95% confidence interval around an 80% pass rate spans roughly ±11 points: a genuinely unchanged system can bounce between the low 70s and low 90s across replays. A 2-point delta tells you almost nothing until you either shrink that interval or change how you're measuring.",
    },
    {
      type: "paragraph",
      text: "Two cheap fixes, in order of leverage. **(1) Run more items.** Confidence intervals shrink with sample size, not with more careful reading of a fixed set — going from 50 to 200 cases tightens the interval far more than any amount of rubric-tuning, because variance is a property of n. **(2) Run paired comparisons instead of independent aggregates.** Comparing 'baseline: 82% on 50 cases' against 'candidate: 84% on 50 cases' as two independent numbers wastes the fact that they're the *same* 50 cases — instead, score baseline and candidate on each case and count wins/losses/ties directly (a paired sign test). Pairing cancels out per-case difficulty (a case that's hard for every version stops contributing noise to the comparison) and needs far fewer samples to detect a real difference than comparing two independent percentages. For tasks where any successful attempt counts — code generation, retry-tolerant agent tasks — report **pass@k**: the probability that at least one of k sampled attempts succeeds, and never conflate it with pass@1 ('did the single production-shaped attempt succeed'), since a system can have great pass@k and mediocre pass@1 if it only succeeds with retries.",
    },
    {
      type: "code",
      language: "python",
      title: "before trusting a delta, check whether the intervals even separate",
      code: `import math

def wilson_interval(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Approximate 95% CI for a pass rate. Cheap gut-check before trusting a delta."""
    if n == 0:
        return (0.0, 0.0)
    p = successes / n
    denom = 1 + z**2 / n
    center = p + z**2 / (2 * n)
    margin = z * math.sqrt(p * (1 - p) / n + z**2 / (4 * n**2))
    return ((center - margin) / denom, (center + margin) / denom)

baseline = wilson_interval(41, 50)    # 82%
candidate = wilson_interval(42, 50)   # 84%
print(f"baseline  95% CI: {baseline[0]:.2f}-{baseline[1]:.2f}")
print(f"candidate 95% CI: {candidate[0]:.2f}-{candidate[1]:.2f}")
# These overlap heavily -> the 2-point move is noise, not signal at n=50.

def paired_sign_test(baseline_pass: list[bool], candidate_pass: list[bool]) -> dict:
    """Same cases, both versions -> count flips. Far more powerful than
    comparing two independent aggregate percentages."""
    newly_passing = sum(not b and c for b, c in zip(baseline_pass, candidate_pass))
    newly_failing = sum(b and not c for b, c in zip(baseline_pass, candidate_pass))
    return {"newly_passing": newly_passing, "newly_failing": newly_failing,
            "net": newly_passing - newly_failing}`,
      explanation:
        "Overlapping confidence intervals are the tell: don't ship on a delta the intervals can't distinguish from zero. The paired sign test is usually the more decisive tool in practice — a 3-newly-passing / 1-newly-failing split at n=50 is a much stronger and cheaper signal than the aggregate percentages alone, and it also forces you to look at *which* case newly failed, regardless of the net direction being positive.",
    },
    {
      type: "heading",
      text: "CI integration realities",
    },
    {
      type: "list",
      items: [
        "**Cache model outputs by input hash.** Memoize LLM/judge calls keyed on (prompt, model version, inputs) so re-running the suite for an unrelated code change doesn't re-spend money and re-introduce sampling noise on cases nothing touched; invalidate the cache only when the model version, prompt, or case itself changes.",
        "**Set a hard cost ceiling per run and per day.** Fail the build (or fall back to the deterministic-only subset) if a PR's eval cost exceeds a threshold — this is the mechanism, not just the aspiration, behind the cost-budget check above.",
        "**Decide gating thresholds and who can override them in advance, not during an incident.** A failing gate should default to blocking merge; only a named role (the prompt's owner, an on-call lead — never the change's own author) can override, and the override must carry a logged justification and a follow-up ticket, so 'urgent fix, skip the gate' doesn't quietly become the normal path around it.",
      ],
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "A teammate adds `temperature=0` to both the agent-under-test and the judge model calls in the regression suite, reasoning it will 'fight flakiness.' The next CI run fails with a 400 error from the Anthropic API on every single case. What happened, and what should the suite do instead to manage flakiness?",
      answer:
        "Current frontier Claude models reject `temperature` (and `top_p`/`top_k`) outright — a 400 Bad Request, not a silent no-op — so 'temperature=0 for determinism' isn't an available lever with this API at all; the teammate's fix doesn't degrade gracefully, it breaks the build entirely. The correct move is to remove the parameter and manage flakiness the way the API actually allows: eliminate variance you control (pin fixtures, retrieval indexes, and timestamps so your own code contributes zero extra noise), prefer assertions over judged checks wherever a check can be assertion-shaped (assertions have no sampling variance to begin with), and for checks that must be judged, stop expecting a single run to be stable — instead run each case k times and require majority-pass for gating, or track wins/losses via a paired comparison against baseline rather than trusting a single independent percentage. The fix that should ship: delete `temperature=0` from the code, and replace 'run at temperature 0' in the team's CI docs with 'k-sample majority vote plus a confidence-interval check on any delta.'",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"Your regression suite goes from 79% to 81% pass rate after a prompt change. Ship it or not — walk me through your reasoning.\"",
      answer:
        "Don't decide from the aggregate alone. First, size up the noise floor: at a suite of ~50 cases, the confidence intervals around 79% and 81% almost certainly overlap heavily, so a 2-point move is not distinguishable from re-run noise at that sample size. Second, and more decisively, look at the **same cases paired**: how many flipped fail→pass versus pass→fail? A pattern like 3 newly passing and 1 newly failing, with everything else stable, is a much stronger and cheaper signal of real improvement than the aggregate delta — and critically, it also tells you directly whether the change introduced a *new* regression among the flips, which you need to inspect regardless of whether the net direction is positive. If re-running the whole suite once more causes some of those flips to flip back, that's confirmation it's noise, and the fix is to grow the suite or switch to k-sample majority-vote scoring before trusting the number at all. The senior answer in one line: never ship on an unpaired aggregate delta smaller than the suite's noise floor — look at flips, not just the mean. **Follow-up probe:** \"same 2-point delta, but the suite is 500 cases\" → at n=500 the confidence interval is roughly three times tighter than at n=50, so the same 2-point move is far more likely to be real; sample size is doing exactly the statistical work described above, which is why 'grow the suite' is usually a better first move than deeper analysis of a small one.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"Design the override policy for a CI eval gate — who can merge past a failing regression suite, and why not just remove the gate for urgent fixes?\"",
      answer:
        "Model it on the same fail-closed discipline as an HITL approval gate. Default is blocking: a red gate stops the merge, full stop. The only path around it is an explicit, logged, named-role action — the prompt's designated owner or an on-call lead, deliberately never the author of the change under review, for the same separation-of-duties reason self-review is weak everywhere else in engineering. Require a one-line justification attached to every override, write it to the same audit trail the eval results already produce, and auto-file a follow-up ticket with a deadline (say, 48 hours) to actually fix or formally accept the failing case, so overrides don't quietly become the normal path. The part worth naming unprompted: removing the gate 'for urgent fixes' is exactly backwards, because urgency is precisely when a rushed prompt edit is most likely to regress something and least likely to get careful manual review — that's the worst possible moment to disable the safety net, and the whole point of an override mechanism is that urgency never has to mean removing the gate. **Follow-up probe:** \"overrides are happening every week\" → that's a signal the gate's threshold or the suite's coverage is miscalibrated, not that the policy is too strict — track override frequency as its own metric, and treat a rising rate as an incident in its own right, not routine friction to route around.",
    },
    {
      type: "keypoints",
      points: [
        "Every fixed bug becomes a permanent regression case — no test, no fix.",
        "Prompts, tool descriptions, and model version are all 'code'; changing any can regress fixed behavior.",
        "One command runs the mixed suite and exits non-zero to gate the merge.",
        "CI pipeline: deterministic on every commit, judged on prompt/model changes, plus a cost-budget check.",
        "Pin model versions so you can tell your change from a provider update.",
        "Claude models reject temperature/top_p/top_k (400) — you can't dial down sampling noise, so manage it statistically instead: pin what you control, prefer assertions, and use k-sample majority vote or paired comparisons for judged checks.",
        "A small delta on a small suite is usually noise: check confidence intervals or, better, paired flips before trusting an aggregate percentage move.",
        "Cache model outputs by input hash, set hard cost ceilings, and predefine who can override a failing gate (never the change's own author) with a logged justification.",
      ],
    },
  ],
};
