import type { Lesson } from "@/lib/types";

export const lesson03: Lesson = {
  slug: "pr-gating-and-evaluation",
  title: "PR Etiquette, HITL Gating & Evaluating a Coding Agent",
  minutes: 30,
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
      type: "keypoints",
      points: [
        "Green tests earn a PR proposal, not a merge; open a draft with a reviewer-ready description linking the issue.",
        "Opening a PR is an irreversible action — gate it with HITL showing diff, test results, and cost; log the decision; fail closed on timeout.",
        "Build your own small SWE-bench-style set (≥10 issues, real + seeded) with known ground truth to score automatically.",
        "Report success rate AND a partial-success taxonomy (wrong location, fix-without-test, regression, exhausted).",
        "Report median/worst cost and time per issue, broken down by stage using your traces.",
        "Naming failure categories turns numbers into insight and into interview vocabulary.",
      ],
    },
  ],
};
