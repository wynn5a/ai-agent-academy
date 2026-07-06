import type { Lab } from "@/lib/types";

export const lab08: Lab = {
  title: "Capstone — Autonomous Coding Agent (Issue → Tested, HITL-Gated PR)",
  portfolio: true,
  objective:
    "Build the portfolio anchor: an agent that takes a GitHub issue, explores the repo, implements a fix in a sandbox, writes a reproducing test and iterates to green with bounded retries, and opens a draft PR gated on human approval. Ship it with full tracing, a per-issue cost report, an evaluation across ≥10 issues with a partial-success taxonomy, and a frank limitations doc. Then turn it into Gate G4 interview material.",
  sections: [
    {
      type: "heading",
      text: "What you're building",
    },
    {
      type: "paragraph",
      text: "An end-to-end coding agent scoped honestly ('simple bug-fix issues in Python repos <10k LOC with a pytest suite'). It ingests an issue, maps the repo and states its understanding and plan (checkpointed), edits in a git worktree or container (never the real tree), runs the test suite and writes a reproducing test (red → green) iterating up to 5 attempts, and opens a **draft** PR only after a human approves a view of the diff, test results, and cost. It's instrumented with Module 7 tracing and reports cost per issue.",
    },
    {
      type: "animation",
      name: "capstone-pipeline",
      caption:
        "The artifact you're shipping: issue → explore → plan → sandbox edit → test loop → HITL-gated draft PR, all traced.",
    },
    {
      type: "heading",
      text: "Suggested weekly plan",
    },
    {
      type: "list",
      ordered: true,
      items: [
        "**W21:** harness + repo exploration + plan generation working end-to-end on one toy issue.",
        "**W22:** sandboxed editing + test running; first full red→green fix.",
        "**W23:** retry loops, failure handling, HITL PR gate.",
        "**W24:** eval set of 10 issues; run, measure, fix the top failure mode. (Also: full take-home simulation this week.)",
        "**W25:** eval rerun, results write-up, README polish, demo recording.",
        "**W26:** buffer + Gate G4 full mock loop.",
      ],
    },
    {
      type: "code",
      language: "python",
      title: "skeleton — the top-level pipeline (fill the TODOs)",
      code: `# capstone/pipeline.py — glue for the six stages
from langfuse import observe          # tracing from Module 7

@observe()
def solve_issue(issue_url_or_path: str, repo_full: str) -> dict:
    issue = load_issue(issue_url_or_path)        # TODO: GitHub API or local file

    workspace = make_sandbox(repo_full)          # TODO: git worktree OR container
    try:
        plan = explore_and_plan(issue.text)      # checkpointed to plan.json
        outcome = repair(plan, issue.text)       # bounded red->green loop (max 5)

        tests = run_tests()                       # final verification
        diff = git_diff(workspace)               # TODO: git diff in the sandbox
        cost = current_trace_cost()              # TODO: pull from your tracing

        if outcome["status"] == "success" and tests["passed"]:
            url = open_pr_if_approved(            # HITL gate — draft PR only on 'y'
                repo_full, branch=workspace.branch, base="main",
                title=pr_title(issue), body=pr_body(issue, outcome),
                diff=diff, cost_usd=cost,
            )
            return {"issue": issue.id, "result": "pr_proposed", "url": url,
                    "cost_usd": cost}
        return {"issue": issue.id, "result": outcome["status"],
                "cost_usd": cost}
    finally:
        cleanup_sandbox(workspace)               # discard the throwaway tree

# capstone/evaluate.py — run across the issue set, score with the taxonomy
def evaluate(issue_set) -> dict:
    results = []
    for spec in issue_set:                       # TODO: >= 10, real + seeded
        run = solve_issue(spec.url, spec.repo)
        results.append(score_to_taxonomy(run, spec.ground_truth))
    return report(results)                        # success rate + taxonomy + cost/time`,
      explanation:
        "The whole capstone reduces to this glue: sandbox, explore/plan (checkpointed), bounded repair, verify, and an HITL-gated draft PR — every stage wrapped in tracing so cost is attributable per issue and per stage. The `finally: cleanup_sandbox` is not optional — the agent WILL make bad edits, and they must die with the throwaway tree. The evaluate module reuses the exact same pipeline, scored against ground truth you control, producing the numbers your README and interviews need.",
    },
    {
      type: "callout",
      kind: "warning",
      title: "Sandbox and HITL are non-negotiable",
      text: "Never run edits against the real working tree, and never open a PR without explicit human approval of the diff. These two rules are what let you demo an autonomous agent safely and what a senior reviewer checks for first. An agent that edits your real repo or auto-opens PRs is a liability, not a portfolio piece.",
    },
    {
      type: "keypoints",
      points: [
        "This is the portfolio anchor: issue → explore → sandboxed fix → red→green tests → HITL-gated draft PR, fully traced.",
        "Checkpoint the plan; bound the repair loop; verify tests independently of the model's claim.",
        "Sandbox every edit (worktree/container) and gate every PR behind human approval — non-negotiable.",
        "Evaluate on ≥10 issues (real + seeded) with a partial-success taxonomy and cost/time per issue.",
        "Ship a frank limitations doc and a README with architecture, demo, and results.",
        "Convert it all into Gate G4 material: design answers, five STAR stories with numbers, take-home strategy.",
      ],
    },
    {
      type: "heading",
      text: "Ship it to your portfolio",
    },
    {
      type: "paragraph",
      text: "Hiring managers reportedly look at GitHub before the résumé — for the roles this curriculum targets, this capstone **is** the résumé. Package it so a reviewer gets the whole story in under five minutes:",
    },
    {
      type: "list",
      items: [
        "**README with a 60-second demo** — a GIF or short clip of the full path: issue in → agent explores → red→green tests → HITL approval → draft PR out.",
        "**The PR the agent actually opened** — link a real draft PR with the reviewer-ready description, the small focused diff, and CI showing the reproducing test passing.",
        "**Eval results across your issue suite** — success rate, the partial-success taxonomy, and median cost/time per issue, straight from your `report()` output.",
        "**An honest 'Limitations' section** — precise scope, named failure modes from the taxonomy, cost envelope, safety boundaries. Reviewers read it first; it's what makes every other claim credible.",
      ],
    },
  ],
  acceptanceCriteria: [
    "Input: accepts a GitHub issue URL or a local issue file (title, body, repro steps)",
    "Explore: maps the repo, locates relevant code, and states its bug understanding and plan; the plan is checkpointed",
    "Implement: writes the fix in a sandboxed workspace (git worktree or container) — never the real tree",
    "Verify: runs the repo's test suite and writes at least one new test reproducing the issue (red → green); iterates on failures with a hard cap of 5 attempts",
    "Deliver: opens a draft PR (or produces a patch + PR description) gated on HITL approval showing the diff, test results, and cost",
    "Observe: full tracing with a per-issue cost report",
    "Evaluate: runs on ≥10 issues (mix of real and seeded bugs you write) and reports success rate, a partial-success taxonomy, median cost/time per issue, and a failure-analysis table",
    "Document: README with architecture diagram, demo GIF or trace walkthrough, results, and a frank limitations section",
  ],
  stretchGoals: [
    "Support multi-file fixes and measure how the wrong-location rate changes versus single-file issues",
    "Add a cheaper model for exploration (e.g. claude-haiku-4-5) and the stronger model (claude-sonnet-5 / gpt-5.5) only for repair; report the cost/quality trade-off from your traces",
    "Assemble and rehearse the full Gate G4 package: whiteboard the agent loop, RAG+eval, memory, multi-agent trade-offs, and injection defenses in <5 min each, plus five STAR stories anchored in this project",
  ],
};
