import type { Lab } from "@/lib/types";

export const lab02: Lab = {
  title: "Lab 02 — File-System Research Agent",
  portfolio: true,
  objective:
    "Build an agent that answers natural-language questions about any local codebase or folder: it plans, lists, greps, and reads files across the repo, then synthesizes an answer with file-path citations — under hard iteration, cost, and time budgets, with a full JSONL trace and graceful degradation. Raw SDK only; starter code lives in labs/lab02-research-agent/.",
  sections: [
    {
      type: "heading",
      text: "What you're building",
    },
    {
      type: "paragraph",
      text: 'A CLI: `python research_agent.py "Which module covers prompt injection, and what lab does it require?" --root ../..` — the agent explores the repo with `list_dir`, `grep`, and `read_file`, then calls `finish(answer, citations)`. Every LLM call and tool call lands in `trace.jsonl`. If any budget trips (15 iterations, $0.50, 60 seconds), it returns a best-effort answer flagged incomplete — **never an exception**. This lab is the Gate G1 artifact: Claude will pick a novel question about an unfamiliar repo, and you\'ll walk through the trace explaining every decision.',
    },
    {
      type: "animation",
      name: "agent-loop",
      caption:
        "Lab 02 is lesson 1's loop plus every guardrail from lessons 4–5: finish tool, layered budgets, safe executor, truncation, tracing.",
    },
    {
      type: "heading",
      text: "Suggested structure",
    },
    {
      type: "code",
      language: "python",
      title: "skeleton (fill in the TODOs)",
      code: `# tools.py — implementations with output caps baked in
MAX_OUTPUT_CHARS = 4000

def list_dir(path: str) -> str:
    # names + sizes, directories marked; refuse paths outside --root
    ...

def grep(pattern: str, path: str = ".") -> str:
    # regex over text files under path; return "file:line: text" rows;
    # cap at ~50 matches, then a truncation note ("narrow your pattern")
    ...

def read_file(path: str, offset: int = 0, limit: int = 200) -> str:
    # numbered lines from offset; truncation note says how to read more
    ...

# agent.py — the loop with all guardrails
SYSTEM = (
    "You are a code-research agent. Explore with list_dir/grep/read_file, "
    "then call finish exactly once. Every claim in your answer must cite "
    "a file path you actually read. Before each tool call, state in one "
    "sentence what you expect to learn."
)

def answer(question: str, root: str) -> dict:
    budget = Budget(max_iterations=15, max_usd=0.50, max_seconds=60)
    tracer = Tracer("trace.jsonl")
    executor = SafeExecutor(IMPL, max_failures_per_tool=3)
    messages = [{"role": "user", "content": question}]

    while True:
        reason = budget.exhausted()
        if reason is not None:
            tracer.log("terminate", reason=reason, complete=False)
            return best_effort(messages, reason)      # never raises

        resp = timed_llm_call(messages, tracer, budget)   # logs usage+latency
        # TODO: finish-tool check -> validate citations -> return complete
        # TODO: end_turn without finish -> nudge once
        # TODO: execute tools via executor, truncate(), trace, append`,
      explanation:
        "Assemble, don't invent: `Budget`, `SafeExecutor`, `truncate`, and `Tracer` come straight from lessons 4–5. Decisions that matter: all three tools clamp their own output (never trust the loop to remember); `read_file` takes `offset`/`limit` so truncation notes are actionable; path arguments are resolved and checked against `--root` (the model must not read your home directory); and validate `finish` citations against the set of files actually read this run — reject and nudge if the model cites something it never opened.",
    },
    {
      type: "callout",
      kind: "tip",
      title: "Test the unhappy paths on purpose",
      text: "Before calling it done, force each failure: ask an unanswerable question (budget exhaustion path), point `--root` at a huge repo (truncation path), ask about a file that doesn't exist (error-feedback path), and set max_iterations=2 (degradation path). Each should produce a clean incomplete answer and a trace that tells the story. `jq .event trace.jsonl | sort | uniq -c` is your friend.",
    },
    {
      type: "heading",
      text: "Ship it to your portfolio",
    },
    {
      type: "paragraph",
      text: "This is a portfolio lab: hiring managers look at your GitHub before your résumé, and 2–3 deep, evaluated projects beat a pile of shallow demos. Package the repo so a reviewer gets the whole story in five minutes:",
    },
    {
      type: "list",
      items: [
        "**README with a 60-second demo** — one command to install and run, plus a short recording (GIF or asciinema) of a real question → exploration → cited answer, so a reviewer sees it working without cloning anything.",
        "**Committed traces of the loop** — check in a redacted `trace.jsonl` from a real run and annotate two or three interesting lines in the README (a tool choice, a truncation, the termination record). Hiring managers specifically want to see the inter-step traces, not just the final answer.",
        "**An honest Limitations section** — where it breaks (huge repos, ambiguous questions, deep dependency chains that blow the budget) and what you'd fix next. Stated limitations read as senior; hidden ones read as demo-ware.",
        "**Eval/verification evidence** — a small results table (e.g. 10 questions × complete?, iterations, cost, citations valid?) plus the forced unhappy-path runs from the callout above, so every acceptance criterion is demonstrated in the repo, not just claimed.",
      ],
    },
  ],
  acceptanceCriteria: [
    "Tools: `list_dir`, `grep`, `read_file` (all with output size caps) and `finish(answer, citations)` — raw SDK only, no frameworks",
    "Hard limits enforced: max 15 iterations, max $0.50/query (tracked from usage, checked before each call), 60s wall-clock",
    "Large file/tool outputs are truncated with a note telling the model how to get more (narrower pattern, offset read)",
    "On budget exhaustion the agent returns a best-effort answer flagged as incomplete — never raises an exception",
    "Structured JSONL trace log captures every LLM call and tool call with tokens, cost, latency, and the termination reason",
    'Works on this repo: "Which module covers prompt injection, and what lab does it require?" is answered correctly with file-path citations',
  ],
  stretchGoals: [
    "Execute multiple tool calls from a single assistant turn concurrently (they arrived together, so they're independent) and measure the wall-clock savings in the trace",
    "Add an upfront `submit_plan` step with explicit re-planning (lesson 2) and compare traces with/without it on three questions — does planning reduce iterations?",
    "Gate G1 rehearsal: have someone pick a repo you've never seen and a question; answer within budget, then narrate the full trace decision-by-decision",
  ],
};
