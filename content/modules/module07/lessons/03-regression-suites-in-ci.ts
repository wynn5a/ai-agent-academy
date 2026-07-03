import type { Lesson } from "@/lib/types";

export const lesson03: Lesson = {
  slug: "regression-suites-in-ci",
  title: "Regression Suites in CI",
  minutes: 26,
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
      text: "LLM outputs vary run to run, so a judged case can flip on a good day. Reduce nondeterminism (temperature 0 for the agent under test and the judge), and for borderline cases prefer assertions over judgment. If a judged case flaps, that's a signal the rubric is too fuzzy or the behavior genuinely borderline — fix the case, don't just re-run until green.",
    },
    {
      type: "keypoints",
      points: [
        "Every fixed bug becomes a permanent regression case — no test, no fix.",
        "Prompts, tool descriptions, and model version are all 'code'; changing any can regress fixed behavior.",
        "One command runs the mixed suite and exits non-zero to gate the merge.",
        "CI pipeline: deterministic on every commit, judged on prompt/model changes, plus a cost-budget check.",
        "Pin model versions so you can tell your change from a provider update.",
        "Run agent and judge at temperature 0 to fight flakiness; borderline flapping means fix the case.",
      ],
    },
  ],
};
