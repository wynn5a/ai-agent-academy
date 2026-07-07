import type { Lesson } from "@/lib/types";

export const lesson03: Lesson = {
  slug: "pr-gating-and-evaluation",
  title: "PR Etiquette, HITL Gating & Evaluating a Coding Agent",
  minutes: 40,
  summary:
    "A green test suite isn't a merge. The agent produces a well-formed PR gated on human approval, then you measure whether the whole thing actually works — a small SWE-bench-style eval set you assemble yourself, with a partial-success taxonomy and cost/time per issue.",
  sections: [
    {
      type: "paragraph",
      text: "Passing tests earns the right to *propose* a change, not to merge it. The delivery stage produces a proper pull request — a clear description linking the issue, the diff, and the test evidence — and puts it behind a human approval gate. Then comes the part that makes this a portfolio piece rather than a toy: you evaluate the agent honestly across many issues and report real numbers.",
    },
    {
      type: "heading",
      text: "PR etiquette",
    },
    {
      type: "list",
      items: [
        "**A description a reviewer can act on:** what the bug was, the root cause, what changed and why, and the test that now proves it — linking the original issue.",
        "**Open as a draft**, not ready-to-merge — the agent proposes; a human decides.",
        "**Show the evidence:** the diff, the before/after test results (red → green), and the cost of producing the fix.",
        "**Small, focused diffs:** one issue, one logical change — the search/replace default pays off here.",
      ],
    },
    {
      type: "callout",
      kind: "danger",
      title: "The PR is an irreversible action — gate it",
      text: "Opening a PR against a real repo is exactly the kind of consequential, hard-to-undo action Module 7's HITL pattern exists for. The gate shows the approver the diff, test results, and cost so they can decide in seconds; nothing hits GitHub without an explicit yes; the decision is logged; a timeout defaults to reject. This is also your defense if a malicious issue tries to inject instructions — a human sees the diff before anything ships.",
    },
    {
      type: "code",
      language: "python",
      title: "producing the PR behind an HITL gate (PyGithub)",
      code: `from github import Github        # PyGithub
import os

def open_pr_if_approved(repo_full: str, branch: str, base: str,
                        title: str, body: str, diff: str,
                        cost_usd: float) -> str:
    # 1) Surface everything the human needs to approve in seconds.
    print("=== PROPOSED PR ===")
    print(title)
    print(body)
    print(f"cost to produce: $" + f"{cost_usd:.3f}")
    print(diff[:4000])            # trimmed diff preview
    decision = input("open this draft PR? [y/N] ").strip().lower()

    audit({"event": "pr_decision", "repo": repo_full, "branch": branch,
           "approved": decision == "y", "cost_usd": cost_usd})
    if decision != "y":
        return "rejected by human — nothing pushed"

    # 2) Only on explicit yes do we touch GitHub, and only as a DRAFT.
    gh = Github(os.environ["GITHUB_TOKEN"])
    repo = gh.get_repo(repo_full)
    pr = repo.create_pull(title=title, body=body, head=branch,
                          base=base, draft=True)
    audit({"event": "pr_opened", "url": pr.html_url})
    return pr.html_url`,
      explanation:
        "The gate is the whole point: the human sees title, body, cost, and a trimmed diff, and only an explicit 'y' reaches `create_pull` — opened as a draft. Every path writes to the audit log, so there's a durable record of what the agent proposed and what a human decided. In a team setting the `input()` becomes a web approval UI, but the contract is identical: propose with full context, execute only on approval.",
    },
    {
      type: "heading",
      text: "Why small, reviewable diffs beat big ones",
    },
    {
      type: "paragraph",
      text: "The 'small, focused diffs' bullet above is more than style — it's what makes the entire gate structure work. **Reviewer trust:** a human approver skimming a 15-line diff can genuinely verify it inside the seconds an HITL gate is designed to take; a 400-line diff gets rubber-stamped under the same time pressure, which defeats the gate's entire purpose — the approval becomes theater instead of a real check. **Bisectability:** `git bisect` and `git blame` stay useful only if each commit does one thing; a diff that fixes the bug *and* reformats three files *and* renames a variable makes future debugging archaeology harder, including your own agent's future regression-hunting. **The PR as the unit of accountability:** one issue, one fix, one clear description creates a clean audit trail — this PR closes this issue, this test proves it. A bundled diff obscures which change caused which effect, which matters enormously when a *later* PR from the same agent introduces a regression and you need to know which prior change is implicated. This is why Lesson 2's 'default to search/replace' choice isn't just an implementation detail — it's the thing that makes the diffs small enough for this gate to mean anything.",
    },
    {
      type: "heading",
      text: "Layered gates: from fast fail to human",
    },
    {
      type: "paragraph",
      text: "The HITL approval isn't the only gate — it's the last and most expensive one in a sequence that should fail fast and cheap before it fails slow and human. **Lint/typecheck** first: seconds, catches syntax and type errors before you ever burn a full test-suite run. **The test suite** next: the red→green proof from Lesson 2. **Agent self-review vs. an independent review model**: never let the model that wrote the fix be its only reviewer — the same self-preference bias Module 7 names for LLM judges applies here (a model rates its own family's output more favorably), so route the diff through a different model, or at minimum a fresh context with a narrow rubric, before a human ever sees it. **Human approval** is the final gate precisely because it's the only one that's adversarially robust — every earlier layer is itself a model or a script that can, in principle, be fooled by the same class of failure the pipeline exists to catch.",
    },
    {
      type: "code",
      language: "python",
      title: "an independent review pass before the human ever sees the diff",
      provider: "claude",
      code: `import json

import anthropic

reviewer_client = anthropic.Anthropic()   # if the fixer is an OpenAI model,
                                          # this IS the cross-family reviewer

REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "touches_tests": {"type": "boolean"},
        "scope_concern": {"type": "boolean"},
        "verdict": {"type": "string", "enum": ["pass", "flag"]},
    },
    "required": ["touches_tests", "scope_concern", "verdict"],
    "additionalProperties": False,
}

def independent_review(diff: str, issue_text: str) -> dict:
    """A DIFFERENT model/context reviews the diff before a human does.
    Never let the model that wrote the fix be the only reviewer of it."""
    resp = reviewer_client.messages.create(
        model="claude-sonnet-5", max_tokens=1024,
        system=(
            "You are reviewing a code change, not the engineer who wrote it. "
            "Check: does the diff plausibly fix the described issue? Does it "
            "touch any file under tests/ or named test_*/*_test? Is the diff "
            "larger than the issue seems to warrant?"
        ),
        messages=[{"role": "user", "content":
            f"Issue:\\n{issue_text}\\n\\nDiff:\\n{diff}"}],
        # Structured output: the verdict is machine-routed, so don't parse prose.
        output_config={"format": {"type": "json_schema", "schema": REVIEW_SCHEMA}},
    )
    text = next(b.text for b in resp.content if b.type == "text")
    return json.loads(text)`,
      explanation:
        "The rubric is deliberately narrow and mechanical (touches_tests, scope_concern, verdict) rather than an open 'is this good?' — narrow, structured checks resist the position and self-preference biases Module 7 covers better than holistic judgments do. Because a gate routes on this verdict, the JSON shape is *enforced* via structured outputs rather than requested in the prompt. `touches_tests` is exactly the guardrail Lesson 2 promised against test-gaming: any repair that edits a test file gets flagged for elevated scrutiny automatically, before the human's limited attention is spent on it. This call is cheap triage, not certification — it exists so the HITL gate only ever sees diffs that already cleared automated review, not to replace the human's judgment. One deliberate difference from Module 7's judge, which forced a **tool call** for the same enforce-the-shape job: both are Module 1's structured-output patterns, and since nothing here needs executing, the native `output_config` format is the lighter fit — pick either, just pick consciously.",
      variants: [
        {
          provider: "openai",
          code: `import json
from openai import OpenAI

reviewer_client = OpenAI()   # if the fixer is a Claude model, this IS the
                             # different-family reviewer — and vice versa

REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "touches_tests": {"type": "boolean"},
        "scope_concern": {"type": "boolean"},
        "verdict": {"type": "string", "enum": ["pass", "flag"]},
    },
    "required": ["touches_tests", "scope_concern", "verdict"],
    "additionalProperties": False,
}

def independent_review(diff: str, issue_text: str) -> dict:
    """A DIFFERENT model/context reviews the diff before a human does.
    Never let the model that wrote the fix be the only reviewer of it."""
    resp = reviewer_client.responses.create(
        model="gpt-5.5",
        instructions=(
            "You are reviewing a code change, not the engineer who wrote it. "
            "Check: does the diff plausibly fix the described issue? Does it "
            "touch any file under tests/ or named test_*/*_test? Is the diff "
            "larger than the issue seems to warrant?"
        ),
        input=[{"role": "user", "content":
            f"Issue:\\n{issue_text}\\n\\nDiff:\\n{diff}"}],
        # Structured output: the verdict is machine-routed, so don't parse prose.
        text={"format": {"type": "json_schema", "name": "review",
                         "schema": REVIEW_SCHEMA, "strict": True}},
    )
    return json.loads(resp.output_text)`,
          explanation:
            'Same narrow rubric, same enforced JSON — the Responses API takes the schema via `text={"format": {"type": "json_schema", ..., "strict": True}}` where the Messages API uses `output_config={"format": {"type": "json_schema", ...}}`, and the result reads directly off `resp.output_text`. The cross-family pairing is the practical payoff of having both providers wired: a `claude-sonnet-5` fixer reviewed by `gpt-5.5` (or the reverse) de-biases by construction, per the self-preference material this lesson\'s drills cover.',
        },
      ],
    },
    {
      type: "heading",
      text: "Evaluating a coding agent",
    },
    {
      type: "paragraph",
      text: "Now the honest question: how often does it actually work? You assemble your own small SWE-bench-style eval set — real issues from small OSS repos plus bugs you seed yourself (introduce a bug, write the issue, keep the known-good fix). The README target is ≥10 issues. For each, you know ground truth, so you can score automatically: does the agent's fix make the reproducing test pass without breaking existing tests? Report success rate, and don't stop there.",
    },
    {
      type: "animation",
      name: "eval-loop",
      caption:
        "Run the agent across your issue set, score each (success / partial / failure), aggregate rate, cost, and time.",
    },
    {
      type: "heading",
      text: "The partial-success taxonomy",
    },
    {
      type: "paragraph",
      text: "Binary pass/fail hides everything interesting. Coding agents fail in *structured* ways, and naming those categories is what turns raw numbers into insight — and into interview vocabulary. Track where each run landed:",
    },
    {
      type: "table",
      headers: ["Outcome", "Meaning", "What it tells you"],
      rows: [
        [
          "Full success",
          "Reproducing test passes, existing tests pass",
          "The happy path",
        ],
        [
          "Wrong location",
          "Edited the wrong file/function; never touched the bug",
          "Exploration/retrieval is weak",
        ],
        [
          "Fix without test",
          "Bug fixed but no reproducing test written",
          "Repair loop isn't enforcing red-first",
        ],
        [
          "Regression introduced",
          "New test passes but broke existing ones",
          "Fix too broad; needs tighter, more localized edits",
        ],
        [
          "Exhausted retries",
          "Hit the retry cap still failing",
          "Issue beyond current scope — good limitations-doc material",
        ],
      ],
    },
    {
      type: "code",
      language: "python",
      title: "scoring the eval set with a partial-success taxonomy",
      code: `from dataclasses import dataclass, field

@dataclass
class IssueResult:
    issue_id: str
    outcome: str          # one of the taxonomy categories
    cost_usd: float
    seconds: float

def score_issue(run) -> str:
    if run.status == "exhausted":
        return "exhausted_retries"
    before, after = run.tests_before, run.tests_after
    if not run.wrote_reproducing_test:
        return "fix_without_test"
    if after.existing_failed:                 # broke something that passed
        return "regression_introduced"
    if not after.repro_test_passed:
        return "wrong_location"               # never actually fixed it
    return "full_success"

def report(results: list[IssueResult]) -> dict:
    n = len(results)
    from statistics import median
    succ = sum(r.outcome == "full_success" for r in results)
    by_outcome: dict[str, int] = {}
    for r in results:
        by_outcome[r.outcome] = by_outcome.get(r.outcome, 0) + 1
    return {
        "n_issues": n,
        "success_rate": round(succ / n, 3),
        "taxonomy": by_outcome,
        "median_cost_usd": round(median(r.cost_usd for r in results), 3),
        "median_seconds": round(median(r.seconds for r in results), 1),
    }`,
      explanation:
        "The scoring function encodes the taxonomy as a decision tree over ground truth you control: did it run out of retries, skip the reproducing test, break existing tests, or fail to fix the target? Reporting the outcome histogram alongside the headline success rate is what a senior reviewer wants — it shows you know *how* your agent fails, not just how often. Median cost and time per issue are the operational numbers every hiring conversation asks for.",
    },
    {
      type: "callout",
      kind: "tip",
      title: "Cost analysis that reads as senior",
      text: "Report median (and worst-case) cost per issue and per outcome — successes are often cheaper than exhausted runs that retried five times. Break cost down by stage (exploration vs. repair) using your traces from Module 7; usually exploration or a runaway repair loop dominates. 'Median $X per successful fix, exhausted runs cost ~3x' is a sentence that lands in an interview.",
    },
    {
      type: "heading",
      text: "What SWE-bench-style numbers do and don't tell you",
    },
    {
      type: "paragraph",
      text: "Your own eval set borrows SWE-bench's shape, so it's worth knowing exactly where that shape misleads. **Pass@1 vs. pass@k:** pass@1 asks whether a single attempt succeeds; pass@k asks whether *at least one* of k independent attempts succeeds — pass@k is mechanically ≥ pass@1 for k>1, because more independent chances can only help. A number reported as 'resolved' without specifying which one is comparing apples to a fruit basket; production is almost always pass@1, since a user's PR gets opened from exactly one attempt. **Env-setup brittleness:** a meaningful share of historical SWE-bench failures turned out to be the *harness* failing to reproduce a repo's environment, not the model failing to fix the bug — a low score can mean 'our setup is fragile,' not 'the model is weak,' and conflating the two misdirects your debugging effort. **Benchmark contamination:** frontier models may have seen SWE-bench instances or their fixes during training, inflating published scores in ways that don't transfer to your own private, freshly-seeded issue set — which is exactly why you built one instead of just quoting the public number. **The gap to real repo work:** benchmarks select for issues with a clean reproducible test and unambiguous ground truth; real repos have flaky CI, tribal knowledge nowhere in the docs, and issues that are underspecified until someone asks a clarifying question. A benchmark number is a ceiling estimate on real work, not a guarantee of it.",
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "A teammate's slide says: 'Our agent matches published SWE-bench-verified numbers: 65% resolved.' The published figure is pass@1 on the full SWE-bench-verified set. Your team's number comes from running your own agent 5 times per issue on your own 10-issue set and counting an issue as resolved if ANY of the 5 attempts passed. What's wrong with the comparison, and what should the slide say instead?",
      answer:
        "Two separate mismatches compound, both inflating the comparison. First, **pass@k vs. pass@1**: 'resolved in at least one of 5 attempts' is pass@5, not pass@1 — pass@5 is mechanically ≥ pass@1 because you get five independent chances and only need one hit, so it isn't comparable to a published pass@1 figure without either computing your own pass@1 (single attempt per issue) or finding the paper's pass@5 number, if reported, to compare like-for-like. In production a user's PR is opened from exactly one attempt, so pass@1 is almost always the operationally honest number to lead with. Second, **sample size and distribution**: 10 self-assembled issues is a completely different statistical regime and composition (real + seeded, one language, one size band) than 500 curated SWE-bench-verified instances — a 6/10 rounds to a suspiciously precise-looking 60%. The corrected slide line: **'6/10 (pass@1) on our own seeded + real issue set — not directly comparable to published SWE-bench numbers.'** Passing off a pass@5 number on a 10-issue set as 'matching' a pass@1 benchmark on 500 issues is exactly the kind of inflation a limitations doc (next lesson) exists to prevent.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Walk me through every gate a change goes through between your agent finishing a fix and that fix landing on main — and tell me which ones a determined agent could talk its way past."',
      answer:
        "Narrate the layers in order and, for each, name what a misaligned or gamed agent could still slip through. **Lint/typecheck** catches nothing semantic — a plausible-looking but wrong fix sails through. **The test suite** can itself be gamed (Lesson 2's test-gaming) unless something specifically diffs test files rather than trusting the green checkmark. **An independent-review model** helps, but if it shares the generator's family it inherits some self-preference bias — the same failure Module 7 names for LLM judges — and a sufficiently plausible, well-worded PR description can talk past a holistic 'does this look right?' rubric; narrow, mechanical checks (touches_tests, diff-size-vs-issue-size) resist this better than open judgment calls. **Human approval** is the only gate that's actually adversarially robust, because it's the only layer that isn't itself another model reasoning about text that could, in principle, be crafted to fool it. The design principle to state explicitly: automate everything you can verify mechanically, and reserve human attention for the judgment calls that remain after the mechanical checks pass — that's what keeps the human gate meaningful instead of a rubber stamp under time pressure. **Follow-up probe:** \"what if the human just clicks approve without reading?\" → then the gate is theater regardless of how good the upstream layers are; the fix is a UI that forces a genuine look (diff and cost surfaced prominently, timeout defaults to reject not approve) and a periodic sample-audit of approvals after the fact to catch rubber-stamping before it becomes routine.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "You add a second LLM as an independent reviewer before human approval. It\'s the same model family as the one that wrote the fix. Good enough? What would you change?"',
      answer:
        "Not good enough, and the reason is the exact judge-bias material from Module 7: a reviewer from the same model family, even in a fresh context with no shared memory, tends to rate outputs from its own family more favorably — similar training data, similar blind spots, similar failure modes it doesn't recognize as failures because it wouldn't have flagged them in its own output either. The fix isn't necessarily 'use a bigger model' — it's **de-bias by construction**: prefer a different model family for review when feasible, and regardless of family, replace open-ended judgment ('is this good?') with a narrow, structured rubric (does the diff touch tests/, is its size proportionate to the issue, does the description match the diff) — narrow checks resist bias better than holistic ones for the same reason Module 7's judge calibration teaches: vague rubrics produce incoherent, exploitable scores. Calibrate it the same way, too: hand-label a set of good/bad diffs, measure the reviewer's agreement with your labels, and treat disagreements as evidence to fix the rubric rather than trusting the dashboard. Frame it correctly for the interviewer: the independent reviewer is a cheap pre-filter that keeps obviously bad diffs from wasting the human's limited attention, not a replacement for the human gate or a certification of correctness. **Follow-up probe:** \"budget won't allow a second model call on every PR\" → don't review everything equally — reserve the independent-review call for diffs that trip a cheap heuristic first (touches tests/, diff size above a threshold, low confidence signal from the repair loop), so the extra spend concentrates where the risk actually is.",
    },
    {
      type: "keypoints",
      points: [
        "Green tests earn a PR proposal, not a merge; open a draft with a reviewer-ready description linking the issue.",
        "Opening a PR is an irreversible action — gate it with HITL showing diff, test results, and cost; log the decision; fail closed on timeout.",
        "Small diffs aren't just style: they're what makes reviewer trust, bisectability, and PR-as-accountability-unit actually work.",
        "Layer the gates cheap-to-expensive: lint/typecheck → tests → independent review (different model family, narrow rubric — beware self-preference bias) → human approval as the only adversarially robust layer.",
        "Build your own small SWE-bench-style set (≥10 issues, real + seeded) with known ground truth to score automatically.",
        "Report success rate AND a partial-success taxonomy (wrong location, fix-without-test, regression, exhausted).",
        "Report median/worst cost and time per issue, broken down by stage using your traces.",
        "Know SWE-bench's limits: pass@1 vs pass@k are not interchangeable, env-setup brittleness and contamination inflate published numbers, and a benchmark score is a ceiling estimate on real repo work, not a guarantee.",
        "Naming failure categories turns numbers into insight and into interview vocabulary.",
      ],
    },
  ],
};
