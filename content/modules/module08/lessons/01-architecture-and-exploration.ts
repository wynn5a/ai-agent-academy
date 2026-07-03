import type { Lesson } from "@/lib/types";

export const lesson01: Lesson = {
  slug: "architecture-and-exploration",
  title: "Architecture & Codebase Exploration",
  minutes: 30,
  summary:
    "The capstone is the sum of every prior module: the agent loop from Lab 02, RAG-style retrieval, memory, evals, tracing, and HITL. First the architecture and scope; then the hardest sub-problem — finding the few relevant files in a repo far too large for the context window.",
  sections: [
    {
      type: "paragraph",
      text: "Hiring research is blunt about this: an issue-to-PR coding agent is the single strongest portfolio piece you can build. It exercises everything — planning, retrieval, tool use, sandboxing, test-driven iteration, evaluation, cost accounting, and human oversight — in one artifact that a reviewer can actually run. This module builds it, then converts it into interview capital.",
    },
    {
      type: "callout",
      kind: "insight",
      title: "Scope is the senior move",
      text: "Do not promise general autonomy. 'Handles simple, well-specified bug-fix issues in Python repos under 10k LOC' is an honest, impressive scope — and stating it that precisely is itself a seniority signal. An agent that reliably does a narrow thing beats one that flakily attempts everything. Your limitations doc starts as this one sentence.",
    },
    {
      type: "animation",
      name: "capstone-pipeline",
      caption:
        "The end-to-end pipeline: issue in → explore → plan → implement in sandbox → test loop → HITL-gated PR out.",
    },
    {
      type: "heading",
      text: "The six stages",
    },
    {
      type: "list",
      ordered: true,
      items: [
        "**Input:** a GitHub issue URL (or a local issue file) — title, body, and any repro steps.",
        "**Explore:** map the repo, locate the relevant code, and state your understanding of the bug plus a plan. Checkpoint the plan.",
        "**Implement:** write the fix in a **sandboxed** workspace — a git worktree or container, never the real tree.",
        "**Verify:** run the repo's test suite, write at least one new test reproducing the issue (red → green), iterate on failures up to a bounded retry cap.",
        "**Deliver:** open a draft PR (or produce a patch + PR description) — gated on HITL approval showing the diff, test results, and cost.",
        "**Observe & evaluate:** full tracing and a per-issue cost report; run across an eval set and report results.",
      ],
    },
    {
      type: "heading",
      text: "Architecture decisions worth defending",
    },
    {
      type: "table",
      headers: ["Decision", "Options", "Sensible default"],
      rows: [
        [
          "Orchestration",
          "Hand-rolled agent loop vs. a graph framework (e.g. LangGraph)",
          "Checkpointed plan either way; a framework earns its keep once you need durable resume across stages",
        ],
        [
          "Plan durability",
          "In-memory vs. persisted checkpoints",
          "Persist — a crash mid-fix shouldn't discard exploration work",
        ],
        [
          "Sandbox",
          "Git worktree vs. container",
          "Worktree for speed and simplicity on trusted repos; container when running untrusted code",
        ],
        [
          "Edit strategy",
          "Search/replace vs. full-file rewrite",
          "Search/replace by default (cheaper, safer diffs); covered next lesson",
        ],
      ],
    },
    {
      type: "callout",
      kind: "warning",
      title: "The context window is the binding constraint",
      text: "A 10k-LOC repo is far larger than any context window. You cannot paste the codebase in. Exploration is therefore a **retrieval problem**: find the handful of files that matter and feed only those. Get this wrong and everything downstream degrades — the model plans against files it never saw.",
    },
    {
      type: "heading",
      text: "Exploration strategy: agentic search over dumping",
    },
    {
      type: "paragraph",
      text: "There are two ways to locate relevant code, and the agentic one usually wins for this task. **Embedding-based retrieval** (chunk the repo, embed, semantic search on the issue text) is fine for concept-level 'where is auth handled?' queries. But bugs are often about specific symbols, error strings, and call sites — where **agentic grep-and-read** shines: give the agent tools to search for symbols, list a directory, and read a file, and let it navigate the way a human engineer does. In practice you combine them: semantic search to seed candidates, then grep/read to confirm and expand.",
    },
    {
      type: "code",
      language: "python",
      title: "exploration tools — the agent's eyes on the repo",
      code: `import subprocess, pathlib

REPO = pathlib.Path("/sandbox/repo")

def search_symbol(pattern: str, max_results: int = 40) -> str:
    \"\"\"Grep the repo for a symbol or error string. Ripgrep if available.\"\"\"
    try:
        out = subprocess.run(
            ["rg", "-n", "--max-count", "3", pattern, str(REPO)],
            capture_output=True, text=True, timeout=20,
        ).stdout
    except FileNotFoundError:
        out = subprocess.run(
            ["grep", "-rn", pattern, str(REPO)],
            capture_output=True, text=True, timeout=20,
        ).stdout
    lines = out.splitlines()[:max_results]
    return "\\n".join(lines) or "no matches"

def list_dir(rel: str = ".") -> str:
    target = (REPO / rel).resolve()
    # Constrain to the repo — never let the agent wander the filesystem.
    if REPO not in target.parents and target != REPO:
        return "error: path escapes the repo"
    entries = sorted(p.name + ("/" if p.is_dir() else "") for p in target.iterdir())
    return "\\n".join(entries)

def read_file(rel: str, start: int = 1, end: int = 400) -> str:
    target = (REPO / rel).resolve()
    if REPO not in target.parents and target != REPO:
        return "error: path escapes the repo"
    if not target.is_file():
        return f"error: {rel} is not a file"
    text = target.read_text(errors="replace").splitlines()
    window = text[start - 1:end]
    # Line numbers help the model reference and later edit precisely.
    return "\\n".join(f"{i + start:>5}  {ln}" for i, ln in enumerate(window))`,
      explanation:
        "These three tools — search, list, read — are enough for an agent to navigate a repo like an engineer: grep an error string, list the module it points to, read the function, follow the call site. Two safety essentials: every path is resolved and constrained to the repo (no filesystem escape), and reads are windowed so a huge file can't blow the context budget. Return errors as strings so the model can recover, per the Module 1 convention.",
    },
    {
      type: "code",
      language: "python",
      title: "the exploration loop producing a checkpointed plan",
      code: `import json, pathlib

PLAN_PATH = pathlib.Path("/sandbox/plan.json")

def explore_and_plan(issue_text: str) -> dict:
    system = (
        "You are a senior engineer triaging a bug. Use search_symbol, "
        "list_dir, and read_file to locate the relevant code. Do NOT guess "
        "at file contents — read them. When confident, call record_plan with "
        "the files you will edit, your understanding of the bug, and the fix "
        "approach. Read only what you need; the repo is large."
    )
    messages = [{"role": "user", "content": f"Issue:\\n{issue_text}"}]
    while True:
        resp = call_model(system, EXPLORE_TOOLS, messages)   # search/list/read/record_plan
        if resp.stop_reason != "tool_use":
            continue
        messages.append({"role": "assistant", "content": resp.content})
        results = []
        plan = None
        for block in resp.content:
            if block.type != "tool_use":
                continue
            if block.name == "record_plan":
                plan = block.input          # {"files":[...], "bug":"...", "fix":"..."}
            else:
                results.append(run_explore_tool(block))
        if plan is not None:
            # Checkpoint: survives a crash so W22's implement stage can resume.
            PLAN_PATH.write_text(json.dumps(plan, indent=2))
            return plan
        messages.append({"role": "user", "content": results})`,
      explanation:
        "The plan is a forced structured output (record_plan is a tool schema, per Module 1) so downstream stages get a typed object, not prose. Persisting it to disk is the checkpoint the README requires: exploration is the expensive part, and a crash during implementation should resume from the plan rather than re-explore. The system prompt's 'do NOT guess, read them' instruction is load-bearing — hallucinated file contents are a top failure mode for coding agents.",
    },
    {
      type: "keypoints",
      points: [
        "An issue-to-PR agent is the strongest single portfolio piece; it exercises every prior module.",
        "Scope narrowly and honestly ('simple bug-fix issues, Python repos <10k LOC') — precise scoping signals seniority.",
        "Six stages: input → explore → implement (sandboxed) → verify → deliver (HITL) → observe/evaluate.",
        "The context window can't hold the repo; exploration is a retrieval problem.",
        "Prefer agentic grep-and-read (seeded by optional semantic search) — bugs are about specific symbols and call sites.",
        "Constrain all file paths to the repo, window reads, and checkpoint the plan so implementation can resume.",
      ],
    },
  ],
};
