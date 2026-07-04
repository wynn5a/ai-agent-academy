# Module 8 Senior-Interview Upgrade — Design

**Date:** 2026-07-04
**Goal:** Same four-axis pass as Modules 1–3 (drills, gaps, exercises, deeper why) applied to Module 8 "Capstone," under the user's standing approval. Module 8 has 4 lessons (not 5); its final lesson was already interview-focused, so the task there was to sharpen it into a genuine mock-interview gauntlet rather than add a first drill pass.

## Per-lesson changes

1. **01 architecture-and-exploration** — spot-the-bug (`startswith` string-prefix path-containment bypass vs. resolved-path containment); "Why on-demand search wins in practice" (freshness, infra cost, model capability, with the monorepo-scale exception named); drills (scaling exploration to a 2M-LOC/40-service monorepo, the generated/vendored-file read-budget problem). 30 → 40 min.
2. **02 editing-and-repair-loop** — "Why exact-match beats line numbers — and the staleness trap" with a staleness-guard code sample (content hash captured at read, checked at write); spot-the-bug (naive line-number edit tool corrupted by a prior edit's line-shift); "The verify loop is the quality mechanism, not a formality" (flaky-test rerun-for-confirmation + quarantine; converging vs. oscillating repair attempts; when to stop and report); a danger callout introducing test-gaming as the loop's proxy-metric failure mode; drills (diagnosing oscillating repair attempts, how test-gaming slipped past the eval and how to close it). 30 → 40 min.
3. **03 pr-gating-and-evaluation** — "Why small, reviewable diffs beat big ones" (reviewer trust, bisectability, PR as unit of accountability); "Layered gates: from fast fail to human" with an independent-review code sample (narrow JSON rubric, flags test-file edits, self-preference-bias-aware); "What SWE-bench-style numbers do and don't tell you" (pass@1 vs pass@k, env-setup brittleness, contamination, benchmark-vs-real-repo gap); spot-the-bug (pass@5-on-10-issues misreported as matching a published pass@1 SWE-bench figure); drills (naming every gate and what a determined agent could still slip past, same-family independent reviewer and its self-preference bias). 30 → 40 min.
4. **04 limitations-and-interview-readiness** — "Known failure modes, named" table (long-horizon drift, context exhaustion on big repos, hallucinated APIs, over-eager refactoring, test-gaming, with test-gaming's guardrail pointing back to Lesson 3's diff review); spot-the-bug (a diff that "fixes" a bug by weakening the test's assertion instead, scored `full_success` by the naive taxonomy); the closing whiteboard drills replaced with a three-part mock-interview loop — system-design (design the coding agent end-to-end, weaving budgets/caching/evals/tool-design/context-discipline from Modules 1, 2, 4, 7), debugging (a production incident: 40 spurious overnight PRs, diagnosed via traces, staleness guards, and HITL-under-volume), and judgment (when NOT to point the agent at a payments repo, escalation when overruled). 28 → 38 min.

## Quiz

+5 questions (12 → 17): on-demand search vs. pre-built index trade-offs, staleness checks for edits, test-gaming and its external guardrail, same-family independent-reviewer self-preference bias, pass@1 vs. pass@k misreporting.

## Consistency

Module 8 had no stale `claude-sonnet-4-5` ids, no `temperature`/`top_p`/`top_k` usage, and no `content[0].text` extraction to begin with — audited and confirmed clean. The one new raw Anthropic SDK call added (Lesson 3's `independent_review`) uses `model="claude-sonnet-5"` and extracts text via `next(b.text for b in resp.content if b.type == "text")`, matching course canon.

## Non-goals

Lab structure, resources, index outcomes, rendering, schema.
