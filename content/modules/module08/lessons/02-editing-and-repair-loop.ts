import type { Lesson } from "@/lib/types";

export const lesson02: Lesson = {
  slug: "editing-and-repair-loop",
  title: "Edit Strategies & the Test-Driven Repair Loop",
  minutes: 30,
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
      type: "keypoints",
      points: [
        "Default to search/replace edits: tiny reviewable diffs, cheap, low collateral risk; recover from match failures by re-reading.",
        "Refuse ambiguous edits (zero or multiple matches) rather than guessing.",
        "The repair loop must write a failing test first (red), then fix to green — no reproducing test means no verified fix.",
        "Bound retries (max ~5) so a confused agent fails cleanly instead of burning budget.",
        "Never trust the model's 'done' — run the tests yourself and push failures back.",
        "All edits and test runs happen in a sandbox (worktree/container), never the real tree.",
      ],
    },
  ],
};
