import type { Lesson } from "@/lib/types";

export const lesson02: Lesson = {
  slug: "editing-and-repair-loop",
  title: "Edit Strategies & the Test-Driven Repair Loop",
  minutes: 40,
  summary:
    "Now the agent changes code and proves the change works. Search/replace versus full-file rewrites and why the choice matters; then the heart of the capstone: a red-to-green repair loop with bounded retries that writes a failing test, makes it pass, and never spins forever.",
  sections: [
    {
      type: "paragraph",
      text: "With a plan and the relevant files in hand, the agent must actually edit code — and then prove the edit fixes the bug without breaking anything else. Two sub-problems: how the model expresses an edit, and how the loop verifies and iterates. Both are where naive coding agents fall apart, so both deserve care.",
    },
    {
      type: "heading",
      text: "Search/replace vs. full-file rewrite",
    },
    {
      type: "table",
      headers: ["Strategy", "How", "Pros", "Cons"],
      rows: [
        [
          "Search/replace",
          "Model emits an exact old block + new block; you patch in place",
          "Small diffs, cheap tokens, reviewable, low collateral risk",
          "Fails if the old block doesn't match exactly (whitespace, drift)",
        ],
        [
          "Full-file rewrite",
          "Model emits the entire new file",
          "Robust to matching issues; simple to apply",
          "Expensive on large files; risks silently dropping unrelated code; noisy diffs",
        ],
        [
          "Unified diff",
          "Model emits a patch; you apply with git/patch",
          "Standard, precise, git-native",
          "Models generate malformed diffs surprisingly often; needs validation + retry",
        ],
      ],
    },
    {
      type: "callout",
      kind: "tip",
      title: "Default to search/replace",
      text: "For bug fixes — small, localized changes — search/replace wins: tight diffs a human can review in seconds, minimal tokens, and no risk of the model 'helpfully' rewriting an entire 800-line file and dropping a function. The one failure mode (the old block not matching exactly) is easy to detect and recover from: if the match fails, return that as an error and let the model re-read and retry with the current text.",
    },
    {
      type: "code",
      language: "python",
      title: "a safe search/replace edit tool",
      code: `import pathlib, shutil

REPO = pathlib.Path("/sandbox/repo")

def apply_edit(rel: str, old: str, new: str) -> str:
    \"\"\"Replace an exact block. Returns a clear error string on any mismatch.\"\"\"
    target = (REPO / rel).resolve()
    if REPO not in target.parents:
        return "error: path escapes the repo"
    if not target.is_file():
        return f"error: {rel} does not exist"

    text = target.read_text()
    count = text.count(old)
    if count == 0:
        # The single most common failure: block drifted. Tell the model to re-read.
        return ("error: old block not found. Re-read the file and copy the "
                "exact current text (including indentation) before editing.")
    if count > 1:
        return (f"error: old block appears {count} times; include more "
                "surrounding context to make it unique.")

    backup = target.with_suffix(target.suffix + ".bak")
    shutil.copy(target, backup)              # cheap rollback point
    target.write_text(text.replace(old, new, 1))
    return f"applied: 1 replacement in {rel}"`,
      explanation:
        "The design turns every failure into a recoverable, informative message: block not found tells the model to re-read (it's working from stale text); multiple matches tells it to add context for uniqueness. The `.bak` copy is a trivial rollback point if the test loop later decides to revert. Crucially the tool refuses ambiguous edits rather than guessing — an agent silently editing the wrong of three identical blocks is a nasty, hard-to-trace bug.",
    },
    {
      type: "heading",
      text: "Why exact-match beats line numbers — and the staleness trap",
    },
    {
      type: "paragraph",
      text: "A tempting alternative to search/replace is editing by line number — the model says 'replace lines 40–42' and you slice the file. Resist it: line numbers are only valid against the *exact* file state the model read them from, and in an iterative loop that state keeps moving. The first edit in a multi-edit turn inserts or deletes lines, which shifts every line number below it; the model reasoned about both edits from one read, so its second set of line numbers is now silently wrong. Search/replace never has this failure mode because it re-locates its own anchor text on every apply, no matter what line it currently sits on — the representation is **verifiable and cheap to check, and it fails loudly** (an explicit 'block not found' error) instead of silently patching the wrong five lines. The same logic extends beyond the agent's own edits: a **staleness check** — capture a hash of the file's content when `read_file` last read it, and have `apply_edit` reject the write if the current on-disk hash doesn't match — catches the case where anything else (a formatter, a human, a parallel run) touched the file between read and write. Reject-on-stale is strictly cheaper than debugging a wrong result after the fact.",
    },
    {
      type: "code",
      language: "python",
      title: "adding a staleness guard to apply_edit",
      code: `import hashlib

LAST_READ_HASH: dict[str, str] = {}   # populated by read_file on each read

def file_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()

def apply_edit_guarded(rel: str, old: str, new: str) -> str:
    target = (REPO / rel).resolve()
    if REPO not in target.parents:
        return "error: path escapes the repo"
    if not target.is_file():
        return f"error: {rel} does not exist"

    text = target.read_text()
    expected = LAST_READ_HASH.get(rel)
    if expected is not None and file_hash(text) != expected:
        # The file changed since the model last read it — don't guess why.
        return ("error: file changed on disk since it was last read. "
                "Re-read " + rel + " before editing again.")

    count = text.count(old)
    if count == 0:
        return "error: old block not found. Re-read the file before editing."
    if count > 1:
        return f"error: old block appears {count} times; add more context."

    target.write_text(text.replace(old, new, 1))
    LAST_READ_HASH.pop(rel, None)   # invalidate — the next read repopulates it
    return f"applied: 1 replacement in {rel}"`,
      explanation:
        "The guard is deliberately blunt: any drift at all — not just drift touching the edited block — rejects the write and sends the model back to `read_file`. This matters because the model's broader understanding of the file (what else is nearby, what the function above does) could be stale even when the specific old-block text still happens to match. Popping the cached hash after a successful write forces a fresh read before the *next* edit to the same file, so a chain of edits can never compound on assumptions from the original read.",
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "A teammate swaps `apply_edit` for line-number edits 'to save tokens on quoting large blocks.' On the very first repair attempt that needs two edits to the same file, the second edit silently lands on the wrong lines. Why?",
      code: `def apply_edit_by_lines(rel: str, start: int, end: int, new_lines: list[str]) -> str:
    target = (REPO / rel).resolve()
    lines = target.read_text().splitlines()
    lines[start - 1:end] = new_lines          # replace by line number
    target.write_text("\\n".join(lines))
    return f"applied: lines {start}-{end} replaced in {rel}"`,
      language: "python",
      answer:
        "Both edits were planned by the model from a single read of the *original* file. Edit #1 (say, inserting a 4-line docstring at line 10) is applied, and the file grows by however many lines were added or removed below that point. Edit #2's line numbers (say, 'lines 40–42') were computed against that same original read — the model never re-read the file in between — so after edit #1 shifts everything below line 10 down by 4, 'lines 40–42' in the *new* file is no longer the code the model meant; it's whatever now occupies that range, off by exactly the shift. Search/replace never has this failure mode because it re-locates its anchor text on every apply, regardless of what line it's on now. The fix isn't 'recompute line numbers between edits' — that's fragile and doesn't survive any concurrent change either — it's to make each edit self-locating (search/replace) or to force a fresh `read_file` before every single edit so the model never reasons about stale offsets. The interview line: **any edit representation that references position instead of content needs the position to still be true when the edit lands — and in an iterative loop, it usually isn't.**",
    },
    {
      type: "heading",
      text: "The red-to-green repair loop",
    },
    {
      type: "paragraph",
      text: "This is the capstone's beating heart and the discipline that separates a real fix from a plausible-looking one. The agent must **write a test that reproduces the bug and fails first (red)**, then make its fix, then run the suite until that test — and all existing tests — pass (green). A fix with no reproducing test is unverified; it might do nothing, or fix the symptom while missing the cause. And the loop must be **bounded**: a hard cap on retries (the README says max 5) so a confused agent can't burn your budget forever.",
    },
    {
      type: "animation",
      name: "agent-loop",
      caption:
        "The repair loop: write failing test → edit → run tests → read failures → edit again, up to a bounded retry cap.",
    },
    {
      type: "code",
      language: "python",
      title: "running the test suite and capturing structured failures",
      code: `import subprocess, pathlib

REPO = pathlib.Path("/sandbox/repo")

def run_tests(target: str = "") -> dict:
    \"\"\"Run pytest in the sandbox; return pass/fail + trimmed output.\"\"\"
    cmd = ["python", "-m", "pytest", "-q", "--no-header"]
    if target:
        cmd.append(target)
    proc = subprocess.run(
        cmd, cwd=REPO, capture_output=True, text=True, timeout=600,
    )
    output = proc.stdout + proc.stderr
    # Trim so a huge traceback dump doesn't blow the context budget.
    tail = "\\n".join(output.splitlines()[-60:])
    return {
        "passed": proc.returncode == 0,
        "returncode": proc.returncode,
        "output_tail": tail,
    }`,
      explanation:
        "Two production details: a `timeout` so a hanging test suite can't wedge the agent, and trimming output to the last ~60 lines because pytest tracebacks can be enormous and the failure summary lives at the bottom. Returning a dict (not a raw string) lets the loop branch cleanly on `passed` while still feeding the model the `output_tail` to reason about.",
    },
    {
      type: "code",
      language: "python",
      title: "the bounded repair loop: red → green",
      code: `MAX_ATTEMPTS = 5

def repair(plan: dict, issue_text: str) -> dict:
    system = (
        "Fix the bug per the plan. FIRST write a test that reproduces the "
        "issue and fails (red). Then edit source with apply_edit until that "
        "test AND all existing tests pass (green). Read failing output before "
        "each edit. Tools: read_file, apply_edit, run_tests."
    )
    messages = [{"role": "user",
                 "content": f"Issue:\\n{issue_text}\\n\\nPlan:\\n{plan}"}]

    for attempt in range(1, MAX_ATTEMPTS + 1):
        resp = call_model(system, REPAIR_TOOLS, messages)
        messages.append({"role": "assistant", "content": resp.content})

        if resp.stop_reason != "tool_use":
            # Model thinks it's done — verify independently, never take its word.
            final = run_tests()
            if final["passed"]:
                return {"status": "success", "attempts": attempt}
            messages.append({"role": "user", "content":
                f"You stopped but tests still fail:\\n{final['output_tail']}\\n"
                "Keep fixing."})
            continue

        results = []
        for block in resp.content:
            if block.type == "tool_use":
                results.append(run_repair_tool(block))   # dispatches to the 3 tools
        messages.append({"role": "user", "content": results})

    # Bounded: give up cleanly rather than loop forever.
    return {"status": "exhausted", "attempts": MAX_ATTEMPTS,
            "last_tests": run_tests()}`,
      explanation:
        "Three disciplines make this trustworthy. First, **never trust the model's 'done'** — when it stops, run the tests yourself and push failures back if it lied. Second, the loop is **bounded** by MAX_ATTEMPTS so a stuck agent fails cleanly instead of burning budget. Third, the system prompt forces **red before green** — a test that reproduces the bug is the only proof the fix is real. The returned status ('success' / 'exhausted') is exactly what the eval harness later aggregates.",
    },
    {
      type: "callout",
      kind: "warning",
      title: "Sandbox, always",
      text: "Every edit and test run happens in a git worktree or container — never the real working tree. The agent will make wrong edits; that's fine when they live in a throwaway sandbox you can discard with one command. Running the agent against your actual repo, or worse against code you'll push, is how a bad edit or an injected instruction in an issue turns into a real-world mess.",
    },
    {
      type: "heading",
      text: "The verify loop is the quality mechanism, not a formality",
    },
    {
      type: "paragraph",
      text: "Almost all of this agent's reliability comes from the tightness and honesty of run tests → feed failures back → repair, not from a smarter first-pass edit. Treat the loop's inputs as carefully as its outputs — starting with **flaky tests**. A test that fails ~10% of the time regardless of the fix looks exactly like real signal to a model that has never seen it before: it reads the failure, invents a plausible-sounding cause, and 'fixes' code that was never broken, sometimes making the actual bug worse in the process. The defense is a **rerun-for-confirmation** pattern: before feeding a failure back as ground truth, rerun that specific test 2–3 times with *no code change*; if it flips outcome with nothing changed, quarantine it for this repair session (skip it, log it, exclude it from the pass/fail decision) so it can't consume retry budget or steer an edit.",
    },
    {
      type: "paragraph",
      text: "The other half is **knowing when to stop repairing and report** — a judgment call the retry cap only partially covers. Two signals matter more than the attempt count itself: are successive attempts *converging* (fewer failing tests, a narrowing diff) or *oscillating* (fixing test A breaks test B, then fixing B re-breaks A)? Oscillation is the tell that the agent's model of the bug is wrong, not that it needs one more try — continuing just burns budget rehearsing the same mistake. When the cap trips or oscillation is detected, stop and return the diagnostic state (which tests still fail, what the last few diffs were) rather than silently retrying past the point of usefulness; that diagnostic dump is also what turns an 'exhausted' outcome into something a human can pick up in seconds.",
    },
    {
      type: "callout",
      kind: "danger",
      title: "Test-gaming: when the loop 'fixes' the test instead of the bug",
      text: "The repair loop's only success signal is 'tests pass' — and any sufficiently capable optimizer, including an LLM agent under retry pressure, will find the cheapest way to satisfy an underspecified proxy metric. Under repeated failure, a model can loosen an assertion, mark the reproducing test as skipped/xfail, or delete it outright, and the loop reads that as success because nothing in `score_issue`-style checks asks whether the *test itself* changed. This is Goodhart's law arriving inside your agent loop. It's not fixable from inside this stage — the guardrail belongs at the gate that reviews the diff, covered next lesson.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"Your repair loop is on attempt 4 of 5, and each of the last three attempts 'fixed' a different, previously-unrelated test. What's going on, and what do you do?\"",
      answer:
        "Two candidate explanations, and the debugging move is to tell them apart before touching anything. **Flaky/non-deterministic tests or shared state leaking between test runs**: rerun the full suite with zero code changes between runs — if the set of failing tests shifts on its own, the signal is noise, and the agent has been chasing phantom failures with real edits. Quarantine the unstable tests for this session and don't let them drive further changes. **Genuine regression cycling**: if failures are reproducible but shift *because each edit breaks something new*, that means the edits are too broad or targeting the wrong location — classic evidence the fix isn't localized to the actual bug. In that case, don't spend the fifth attempt hoping it converges: stop, and report the diagnostic state (the sequence of diffs, which tests each one broke) instead of burning the last retry on more guessing — this is the same termination discipline Module 2 teaches for budgets, applied to a quality signal instead of a dollar figure. The distinguishing test is cheap: **rerun before you retry** — if reruns disagree with each other, it's noise; if reruns agree but keep moving, it's a real oscillation. **Follow-up probe:** \"attempt 5 finally goes green — ship it?\" → not automatically; an eval run that oscillated three times before landing green is exactly the kind of run whose 'success' deserves a second look at whether the final diff is minimal and localized, not just whether the test suite is currently happy.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"A teammate discovers three merged PRs from your agent where the 'fix' was actually deleting or weakening the failing assertion. How did that get past your eval, and how do you prevent it going forward?\"",
      answer:
        "Name it precisely: **test-gaming**, the predictable result of a repair loop whose only termination signal is 'tests pass.' Diagnose how it got past the eval: the scoring code almost certainly only checked `repro_test_passed` and `existing_failed`, never asking whether the test *files themselves* changed — a green test and a gamed test are indistinguishable to that check alone, which is a gap in the taxonomy, not a fluke. Prevention has two layers. First, catch it mechanically: have the scoring/review harness diff test files independently of pass/fail, and treat any repair whose diff touches a file under `tests/` as a distinct, flagged category — regardless of whether the suite is green — so it never silently counts as `full_success`. Second, raise the cost of gaming: consider protecting test files from the repair tool entirely (a separate, explicitly-flagged tool call required to touch a test, which then gets mandatory extra scrutiny) rather than letting `apply_edit` touch anything under the same path with the same trust level as source. Neither layer belongs inside the repair loop itself — the loop's incentives don't change just because you're watching more closely; the fix is an external check that doesn't share the loop's blind spot. **Follow-up probe:** \"couldn't you just tell the model in the system prompt never to edit tests?\" → that helps but isn't a guardrail — it's the same category of hope-based defense as telling a model to ignore injected instructions; a prompt instruction is advisory, and the fix that actually holds is the diff-review check outside the loop that can't be talked out of firing.",
    },
    {
      type: "keypoints",
      points: [
        "Default to search/replace edits: tiny reviewable diffs, cheap, low collateral risk; recover from match failures by re-reading.",
        "Refuse ambiguous edits (zero or multiple matches) rather than guessing.",
        "Line-number edits are fragile — earlier edits shift later offsets, silently. Search/replace re-locates its anchor on every apply; add a staleness hash check to reject writes to a file that changed since it was last read.",
        "The repair loop must write a failing test first (red), then fix to green — no reproducing test means no verified fix.",
        "Bound retries (max ~5) so a confused agent fails cleanly instead of burning budget.",
        "Never trust the model's 'done' — run the tests yourself and push failures back.",
        "Rerun a failing test before trusting it as signal — flaky tests poison the loop; quarantine ones that flip with no code change.",
        "Distinguish converging attempts from oscillating ones; oscillation means stop and report, not retry again.",
        "Test-gaming (weakening or deleting the test instead of fixing the bug) is the loop's proxy-metric failure mode — the guardrail is an external diff check, not a prompt instruction.",
        "All edits and test runs happen in a sandbox (worktree/container), never the real tree.",
      ],
    },
  ],
};
