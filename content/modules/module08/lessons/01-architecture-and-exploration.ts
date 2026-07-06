import type { Lesson } from "@/lib/types";

export const lesson01: Lesson = {
  slug: "architecture-and-exploration",
  title: "Architecture & Codebase Exploration",
  minutes: 40,
  summary:
    "The capstone is the sum of every prior module: the agent loop from Lab 02, RAG-style retrieval, memory, evals, tracing, and HITL. First the architecture and scope; then the hardest sub-problem — finding the few relevant files in a repo far too large for the context window.",
  sections: [
    {
      type: "paragraph",
      text: "Hiring research is blunt about this: an issue-to-PR coding agent is the single strongest portfolio piece you can build. It exercises everything — planning, retrieval, tool use, sandboxing, test-driven iteration, evaluation, cost accounting, and human oversight — in one artifact that a reviewer can actually run. This module builds it, then converts it into interview capital.",
    },
    {
      type: "callout",
      kind: "career",
      title: "The capstone-tier project",
      text: "Hiring guides describe exactly one portfolio project as capstone-tier: an autonomous software-development agent that takes a GitHub issue, understands the codebase, implements a fix, writes tests, and opens a PR with human review before merge. That is this module, verbatim. The context that makes the effort worth it: LinkedIn's Jobs on the Rise 2026 ranks AI Engineer the #1 fastest-growing US job title, and the 'agentic AI' skill cluster grew roughly 280% year over year (~90K US postings). The most-requested skills in those postings — Anthropic/OpenAI tool calling and structured outputs, Docker/E2B-style sandboxing, evals, HITL approval before merge — are exactly what this build exercises.",
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
        [
          "Model choice",
          "One flagship everywhere vs. cheap-explore + strong-repair split",
          "Start with one strong generalist (`claude-sonnet-5` or `gpt-5.5`); once traces show exploration dominates cost, route it to a cheaper model like `claude-haiku-4-5`. OpenAI's `gpt-5.3-codex` line is specialized for agentic coding and worth benchmarking for the repair stage",
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
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "A teammate reviews `list_dir` / `read_file` and 'simplifies' the containment check to a plain string comparison, arguing `pathlib` is overkill for a sandbox that never sees untrusted input:",
      code: `def list_dir(rel: str = ".") -> str:
    target = str((REPO / rel).resolve())
    if not target.startswith(str(REPO)):
        return "error: path escapes the repo"
    ...`,
      language: "python",
      answer:
        "String-prefix containment is a classic near-miss for path traversal. `startswith` treats `/sandbox/repo` and `/sandbox/repo-internal-secrets` as related, because the string `/sandbox/repo-internal-secrets` literally starts with the characters `/sandbox/repo`. Any sibling directory whose name happens to share that prefix — `repo2`, `repo-backup`, `repo-old` — passes the check and hands the agent read/list access outside the sandbox. This isn't hypothetical for coding-agent setups: CI runners routinely check out multiple repos side by side, or keep a `-bak`/`-old` copy next to the working tree, for exactly this reason. The correct check compares path *objects*, not string prefixes: `REPO in target.parents or target == REPO` (the original tools) walks the resolved parent chain, so `/sandbox/repo-internal-secrets` is never in `/sandbox/repo`'s parent chain no matter how similar the string looks. The general rule: **never validate a filesystem boundary with string operations** — resolve to a real path first (collapsing `..` and symlinks) and compare structurally. The same bug class shows up in web-app path-traversal checks and container mount validation; it's worth having memorized cold.",
    },
    {
      type: "code",
      language: "python",
      title: "the exploration loop producing a checkpointed plan",
      provider: "claude",
      code: `import json, pathlib
import anthropic

client = anthropic.Anthropic()
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
        resp = client.messages.create(
            model="claude-sonnet-5", max_tokens=4096,
            system=system, tools=EXPLORE_TOOLS,   # search/list/read/record_plan
            messages=messages,
        )
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
      variants: [
        {
          provider: "openai",
          code: `import json, pathlib
from openai import OpenAI

client = OpenAI()
PLAN_PATH = pathlib.Path("/sandbox/plan.json")

def explore_and_plan(issue_text: str) -> dict:
    instructions = (
        "You are a senior engineer triaging a bug. Use search_symbol, "
        "list_dir, and read_file to locate the relevant code. Do NOT guess "
        "at file contents — read them. When confident, call record_plan with "
        "the files you will edit, your understanding of the bug, and the fix "
        "approach. Read only what you need; the repo is large."
    )
    input_items = [{"role": "user", "content": f"Issue:\\n{issue_text}"}]
    while True:
        resp = client.responses.create(
            model="gpt-5.5", instructions=instructions,
            input=input_items, tools=EXPLORE_TOOLS,   # search/list/read/record_plan
        )
        calls = [item for item in resp.output if item.type == "function_call"]
        if not calls:
            continue
        plan = None
        for call in calls:
            args = json.loads(call.arguments)   # arguments arrive as a JSON string
            if call.name == "record_plan":
                plan = args                     # {"files":[...], "bug":"...", "fix":"..."}
            else:
                input_items.append(call)        # echo the call back into the input
                input_items.append({
                    "type": "function_call_output",
                    "call_id": call.call_id,
                    "output": run_explore_tool(call.name, args),
                })
        if plan is not None:
            # Checkpoint: survives a crash so W22's implement stage can resume.
            PLAN_PATH.write_text(json.dumps(plan, indent=2))
            return plan`,
          explanation:
            "Same checkpointed-plan design, Responses API mechanics: the system prompt travels as `instructions`, tool schemas use `parameters` (not `input_schema`), tool arguments arrive as a JSON *string* on `item.arguments` (parse them), and results go back as `function_call_output` items keyed by `call_id` — after echoing the `function_call` item itself into the input. The 'still exploring' signal is the presence of `function_call` items in `resp.output`, where the Messages API checks `stop_reason == \"tool_use\"`.",
        },
      ],
    },
    {
      type: "heading",
      text: "Why on-demand search wins in practice",
    },
    {
      type: "paragraph",
      text: "It's tempting to reach for infrastructure: chunk the repo once, embed it, keep a semantic index warm, and query it like RAG. In production coding agents this mostly lost to on-demand agentic search (grep/glob/read), for reasons that generalize past this capstone. **Freshness:** a repo changes every commit; an index is stale the moment someone merges, and staleness in code search is worse than in prose — a stale hit sends the agent to code that no longer exists. Keeping an index current means a background re-embed job, versioning, and a new class of bugs ('index says line 40, file says line 55'). On-demand search reads the live working tree, so it's correct by construction. **Infrastructure cost:** an index is a service — storage, an embedding pipeline, a latency budget, a thing that pages someone at 3am. `rg` is a binary that ships with the OS. For a tool a single engineer or a CI job runs, the infra tax often costs more than it saves. **Model capability:** frontier models got good enough at iterative, targeted search — grep an error string, read the hit, follow the import — that the coordination overhead of maintaining an index stopped paying for itself for exactly this workload: symbol- and error-string-level bug hunts, not broad conceptual questions.",
    },
    {
      type: "table",
      headers: ["Approach", "Freshness", "Infra cost", "Best fit"],
      rows: [
        [
          "On-demand grep/glob/read",
          "Always current — reads the live tree",
          "None — ships with the OS",
          "Most repos; symbol- and error-string-level bug hunts (this capstone)",
        ],
        [
          "Pre-built semantic index",
          "Stale until re-embedded",
          "Embedding pipeline + storage + re-index jobs",
          "Very large/monorepo scale, or cross-repo conceptual search",
        ],
      ],
    },
    {
      type: "callout",
      kind: "insight",
      text: "The honest caveat: at a scale most companies never reach — multi-million-LOC monorepos — a maintained index earns its keep, because even agentic grep chokes on result volume. Pick the retrieval strategy for the repo size and change frequency you actually have, not the one that sounds more sophisticated.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Your grep-and-read exploration works great on a 10k-LOC repo. Now point it at a 2M-LOC monorepo with 40 services — `search_symbol` for a common name returns thousands of hits. What changes?"',
      answer:
        "Treat exploration itself as a bounded, staged search, not a single flat grep. **Narrow before you search:** use issue metadata — a stack trace, a file path in the repro steps, the service named in the ticket — to scope to one service directory before grepping anything; `list_dir` at the service level first, grep within scope second. **Rank and cap results explicitly:** cut `max_results` hard and prefer matches in source over generated/vendor paths (heuristics: skip `node_modules/`, `vendor/`, `dist/`, `*.min.*`), since undifferentiated hit volume is worse than no hits — the model wastes turns skimming junk. **Escalate only past a threshold:** this is where the earlier trade-off flips — if narrowing plus ranking still returns unusable volume, that's the signal a lightweight per-service index (or even a coarse file-level embedding pass) starts earning its keep, so build the escalation as a measured trigger, not a default. **Bound the exploration loop itself:** more services means more plausible-looking dead ends, so cap exploration iterations and cost the same way Module 2 caps the repair loop — a monorepo doesn't get an exemption from termination discipline just because it's bigger. **Follow-up probe:** \"the issue gives no service hint at all\" → then the first move is a cheap classification step — ask a small/cheap model call to guess the likely service from the issue text and repo's top-level directory names — before spending real exploration budget; misrouting the search is cheaper to fix early than to discover after 30 unproductive grep calls.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Walk me through what happens end-to-end when your `read_file` tool is asked to read a 50,000-line generated file — a lockfile or a minified bundle."',
      answer:
        "Windowing alone isn't the fix — it's a partial mitigation for the wrong problem. `read_file(start=1, end=400)` happily returns 400 lines of a lockfile's alphabetized package hashes, which costs real context tokens and returns zero signal; the model has to spend a turn reading it, decide it's useless, and try again. The actual fix is upstream: detect generated/vendored files *before* reading them and refuse or redirect — heuristics like path prefixes (`vendor/`, `node_modules/`, `dist/`, `.lock` extensions, `.min.js`), a 'longest line' check (minified code has absurd line lengths), or a leading auto-generated-file banner comment. Return `\"error: <path> looks generated/vendored — search for the specific symbol you need instead of reading the whole file\"` rather than truncated content, which nudges the model back toward `search_symbol`. This is the same discipline Module 2 teaches for termination budgets: iterations aren't the resource, tokens are, and a single bad read can burn as much context as ten good ones. **Follow-up probe:** \"what if the actual bug genuinely lives inside a generated or vendored file?\" → then don't read the whole thing at all — grep for the specific symbol or error string inside it first, and read only a tight windowed region around the hit; the file being large and machine-authored doesn't change the retrieval discipline, it just makes skipping the naive full read more important.",
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
