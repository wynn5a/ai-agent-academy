import type { Lesson } from "@/lib/types";

export const lesson05: Lesson = {
  slug: "failure-recovery-and-tracing",
  title: "Failure Recovery, Context Discipline & Tracing",
  minutes: 35,
  summary:
    "An agent's quality is defined on the unhappy path: tools fail, outputs balloon, and at 2 a.m. the only witness is your trace log. Error feedback loops, per-tool retry budgets, output truncation, and JSONL tracing turn a demo into a system.",
  sections: [
    {
      type: "paragraph",
      text: "In Module 1 you learned to return tool errors to the model as `tool_result` content instead of raising — because **models usually self-correct when shown the error**. Inside a loop, that mercy becomes a hazard: a model that self-corrects can also *self-repeat*, calling the same failing tool with the same arguments forever, burning budget on a file that will never exist. Recovery inside a loop needs escalating pressure, not infinite patience.",
    },
    {
      type: "list",
      items: [
        '**Defense 1 — feed the error back, specifically.** "FileNotFoundError: docs/setup.md does not exist. Sibling files: docs/setup-guide.md, docs/install.md" gives the model something to correct *toward*. Vague errors ("tool failed") invite identical retries.',
        '**Defense 2 — per-tool failure budgets.** Count failures per tool (or per tool+arguments pair). After N failures, stop executing and return "this tool is disabled for the rest of the run; try a different approach" — the model reroutes surprisingly well when told plainly.',
        '**Defense 3 — detect repetition itself.** Hash each (tool, arguments) call; on an exact repeat of a *failed* call, short-circuit with "you already tried this and it failed" without executing. Combined with the overall budget from lesson 4, the worst case is now bounded on three axes.',
      ],
    },
    {
      type: "code",
      language: "python",
      title:
        "a tool executor that never raises and applies escalating pressure",
      code: `import json
from collections import Counter

class SafeExecutor:
    def __init__(self, impl: dict, max_failures_per_tool: int = 3):
        self.impl = impl
        self.max_failures = max_failures_per_tool
        self.failures = Counter()        # per tool name
        self.failed_calls = set()        # exact (tool, args) repeats

    def execute(self, name: str, args: dict) -> tuple[str, bool]:
        """Returns (content, is_error). Never raises."""
        key = (name, json.dumps(args, sort_keys=True))

        if self.failures[name] >= self.max_failures:
            return (f"Tool '{name}' is disabled after "
                    f"{self.failures[name]} failures this run. "
                    "Use a different tool or approach.", True)
        if key in self.failed_calls:
            return ("You already tried this exact call and it failed. "
                    "Do not repeat it; change the arguments or approach.",
                    True)
        try:
            return (self.impl[name](**args), False)
        except Exception as e:
            self.failures[name] += 1
            self.failed_calls.add(key)
            return (f"{type(e).__name__}: {e}", True)

# in the loop:
#   content, is_error = executor.execute(block.name, block.input)
#   results.append({"type": "tool_result", "tool_use_id": block.id,
#                   "content": content, "is_error": is_error})`,
      explanation:
        "The two escalation paths are checked *before* execution, so a disabled tool costs nothing. Setting `is_error: true` on the result matters on Anthropic's API: it flags the result so the model treats it as a failure to route around rather than data. Keep the failure state per-run (on the executor object), not global — yesterday's flaky tool shouldn't be banned today.",
    },
    {
      type: "heading",
      text: "Context discipline: the loop's silent tax",
    },
    {
      type: "paragraph",
      text: "Every iteration appends an assistant turn and a tool-result turn — and Module 1 taught you that all of it is re-sent, re-processed, and re-billed on every subsequent call. Fifteen iterations with unbounded tool outputs is how a 'max 15 iterations' agent still blows a dollar budget. Three techniques keep it flat: **(1) truncate tool outputs at the source**, with a note telling the model how to get more; **(2) compact old iterations** — after the model has extracted what it needs from a big tool result, replace the old result with a stub; **(3) keep the system prompt lean and cache it** — stable prefix first, per Module 1's caching lesson.",
    },
    {
      type: "code",
      language: "python",
      title: "truncate at the source + compact old results",
      code: `MAX_TOOL_OUTPUT_CHARS = 4000

def truncate(output: str, limit: int = MAX_TOOL_OUTPUT_CHARS) -> str:
    if len(output) <= limit:
        return output
    dropped = len(output) - limit
    return (output[:limit] +
            f"\\n\\n[TRUNCATED: {dropped} more characters not shown. "
            "Narrow your grep pattern, or call read_file with an offset "
            "to view a specific region.]")

def compact_old_results(messages: list, keep_last: int = 2,
                        stub_over: int = 1000) -> list:
    """Replace big tool results from old iterations with short stubs.
    The model already extracted what it needed; the bytes are just rent."""
    compacted = []
    cutoff = len(messages) - keep_last * 2   # each iteration = 2 messages
    for idx, msg in enumerate(messages):
        if idx >= cutoff or msg["role"] != "user" or isinstance(msg["content"], str):
            compacted.append(msg)
            continue
        new_content = []
        for part in msg["content"]:
            if (isinstance(part, dict) and part.get("type") == "tool_result"
                    and len(str(part.get("content", ""))) > stub_over):
                new_content.append({**part, "content":
                    "[old tool result elided to save context - "
                    "re-run the tool if you need it again]"})
            else:
                new_content.append(part)
        compacted.append({**msg, "content": new_content})
    return compacted`,
      explanation:
        "The truncation note is not politeness — it's an **affordance**: the model reads it and issues a narrower grep or an offset read, which is exactly the behavior you want. Compaction trades a risk (the model might need that data again) for a guarantee (context stays bounded); the stub tells it recovery is one tool call away. Warning: compaction rewrites history, so run it on a *copy* used for the API call if your trace log needs the original.",
    },
    {
      type: "paragraph",
      text: "There's a second, sneakier cost to compaction that separates senior answers: **it fights prompt caching**. Module 1 taught that caching is an exact prefix match — and compaction *rewrites early messages*, so every compaction pass invalidates the cached prefix from the first edited byte onward. Compact every iteration and you pay full prefill on the entire history every call, which can cost *more* than the tokens you saved. The resolution: compact **rarely and in batches** (e.g. when context crosses a threshold, compact everything older than the last two iterations at once), eat the one-time cache re-write, then enjoy many cached calls on the new shorter prefix. It's a classic amortization trade — tokens saved per call × calls remaining vs. one full re-prefill — and being able to sketch that inequality on a whiteboard is exactly the bar.",
    },
    {
      type: "exercise",
      kind: "predict",
      prompt:
        "A teammate wires `compact_old_results` to run before **every** API call ('keep context minimal at all times!'). Context length drops as expected — but the per-run cost *rises* 40%. Walk through why, using the usage fields that would prove it.",
      answer:
        "Each compaction pass edits messages near the top of the history, so the request prefix differs from the previous call's — **`cache_read_input_tokens` collapses to ~0** while `input_tokens` (full-price) balloons: every call now re-prefills the whole conversation instead of reading 90%+ of it from cache at ~0.1×. The saved context (a few thousand stub-replaced tokens) is dwarfed by losing the cache discount on everything else. The proof in the trace: before the change, calls show high `cache_read_input_tokens` and small `input_tokens`; after, the reverse. Fix: compact on a *threshold trigger* (context > N tokens), batch the rewrites, and keep everything after the compaction point byte-stable so the cache re-establishes. Bonus senior point: `keep_last` protects the *recent* turns precisely because those are the ones the model still actively references — and stable recent turns are also the next cache extension.",
    },
    {
      type: "heading",
      text: "The trace log: your only witness",
    },
    {
      type: "table",
      headers: ["Field", "Why it matters when debugging"],
      rows: [
        [
          "`run_id`, `iteration`, `ts`",
          "Groups events into one run and orders them — the skeleton every other question hangs on",
        ],
        [
          "Event type (`llm_call` / `tool_call` / `terminate`)",
          'Lets you filter: "show me only the tool calls" or "how did runs end this week?"',
        ],
        [
          "`input_tokens`, `output_tokens`, cumulative `usd`",
          "Finds the iteration where cost spiked — usually a giant unretruncated tool output",
        ],
        [
          "`stop_reason`",
          "Distinguishes 'model answered' from 'model wanted tools' from 'hit max_tokens' (truncated mid-thought!)",
        ],
        [
          "`tool`, `args`, `result_chars`, `is_error`",
          "Reconstructs the model's search path; repeated identical args = the spiral from Defense 3",
        ],
        [
          "`latency_ms` per call",
          "Splits the blame between slow model calls and slow tools when a run blows the deadline",
        ],
        [
          "Termination `reason` + `complete` flag",
          "The first field you check on a bad answer: did it finish, or run out of budget at step 14?",
        ],
      ],
    },
    {
      type: "code",
      language: "python",
      title: "a 20-line JSONL tracer — greppable, diffable, tail-able",
      code: `import json, time, uuid

class Tracer:
    def __init__(self, path: str = "trace.jsonl"):
        self.path = path
        self.run_id = uuid.uuid4().hex[:8]

    def log(self, event: str, **fields) -> None:
        record = {"run_id": self.run_id, "ts": round(time.time(), 3),
                  "event": event, **fields}
        with open(self.path, "a") as f:
            f.write(json.dumps(record, default=str) + "\\n")

# usage inside the loop:
tracer = Tracer()
t0 = time.monotonic()
resp = client.messages.create(model=MODEL, max_tokens=2048,
                              tools=TOOLS, messages=messages)
tracer.log("llm_call", iteration=i,
           input_tokens=resp.usage.input_tokens,
           output_tokens=resp.usage.output_tokens,
           usd_so_far=round(budget.usd, 4),
           stop_reason=resp.stop_reason,
           latency_ms=round((time.monotonic() - t0) * 1000))

content, is_error = executor.execute(block.name, block.input)
tracer.log("tool_call", iteration=i, tool=block.name, args=block.input,
           result_chars=len(content), is_error=is_error)

tracer.log("terminate", reason="finish tool called", complete=True,
           iterations=budget.iterations, total_usd=round(budget.usd, 4))`,
      explanation:
        "JSONL (one JSON object per line) is the right format because it's append-only (crash-safe — you keep everything up to the crash), streamable (`tail -f` during a live run), and trivially queryable with `jq` or pandas. Log *every* LLM call and *every* tool call, not just failures: the question you'll actually ask is \"what was the model seeing when it made this weird choice?\", and that requires the whole path. This log is also the artifact you walk through in the Gate G1 practical.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `import json, time, uuid

class Tracer:
    def __init__(self, path: str = "trace.jsonl"):
        self.path = path
        self.run_id = uuid.uuid4().hex[:8]

    def log(self, event: str, **fields) -> None:
        record = {"run_id": self.run_id, "ts": round(time.time(), 3),
                  "event": event, **fields}
        with open(self.path, "a") as f:
            f.write(json.dumps(record, default=str) + "\\n")

# usage inside the loop:
tracer = Tracer()
t0 = time.monotonic()
resp = client.responses.create(model=MODEL, input=input_items, tools=TOOLS)
calls = [item for item in resp.output if item.type == "function_call"]
tracer.log("llm_call", iteration=i,
           input_tokens=resp.usage.input_tokens,
           output_tokens=resp.usage.output_tokens,
           usd_so_far=round(budget.usd, 4),
           tool_calls=len(calls),        # zero = the model's natural stop
           latency_ms=round((time.monotonic() - t0) * 1000))

for call in calls:
    args = json.loads(call.arguments)
    content, is_error = executor.execute(call.name, args)
    tracer.log("tool_call", iteration=i, tool=call.name, args=args,
               result_chars=len(content), is_error=is_error)

tracer.log("terminate", reason="finish tool called", complete=True,
           iterations=budget.iterations, total_usd=round(budget.usd, 4))`,
          explanation:
            "The Tracer is identical (JSONL doesn't care who you call); what changes is *what you log for termination* — the Responses API has no `stop_reason`, so record the count of `function_call` items instead (zero = natural stop). The `usage` field names match across both SDKs, so cost accounting is unchanged.",
        },
      ],
    },
    {
      type: "heading",
      text: "Traces are assets: regression fixtures and the road to evals",
    },
    {
      type: "paragraph",
      text: "The trace log's second life is the one seniors bring up unprompted: **every interesting failure becomes a test case**. A run where the agent spiraled, hallucinated on empty results, or blew its budget gets its *initial input* checked into a regression suite; after any prompt, tool, or model change, replay those inputs and compare outcomes (did it finish? within budget? citing real files?). That's the embryo of the eval harness Module 5 builds properly — and it's how prompt changes stop being vibes-driven. Two production notes to mention: real deployments usually emit this same data as **spans** through their observability stack (the GenAI conventions in OpenTelemetry, or purpose-built tools like LangSmith/Langfuse) rather than a local file — the *fields* are what matter, not the sink; and traces contain user data and tool outputs, so retention and PII policy apply to them like any other log.",
    },
    {
      type: "callout",
      kind: "career",
      title: "Traces are a portfolio artifact",
      text: "LLM observability tooling — **Langfuse, Arize Phoenix, LangSmith** — sits on the most-requested skills list in 2026 agentic postings, and hiring managers routinely look at your GitHub *before* your résumé. A repo whose README walks through a real trace of the loop — per-step tool choices, tokens, cost, and the termination reason — proves you've *operated* an agent rather than demoed one; the JSONL tracer you just built produces exactly that artifact, and Lab 02 asks you to ship it.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** 2 a.m. page: your agent told a VIP customer their enterprise plan includes a feature it doesn't. You have the JSONL trace. Walk the postmortem, step by step, out loud.",
      answer:
        "Narrate the queries, not just conclusions. (1) `grep run_id trace.jsonl` — pull the run; **check the termination record first**: `complete: true` or a budget kill? A best-effort answer being served as confident fact is its own bug (presentation layer must surface `complete: false`). (2) Walk the tool calls: did the agent *read* the plan-features source, or answer from prior context? If the trace shows **no tool call touching plan data**, the model answered from its head — fix is grounding discipline: require citations via the finish tool and reject finishes whose citations weren't actually read this run. (3) If it *did* read plan data: was the tool result wrong (stale cache upstream — not the agent's bug), truncated (the feature list got cut at 4,000 chars and the model extrapolated — check `result_chars` at the truncation limit), or compacted away before the final answer (stub replaced the data the finish relied on)? (4) Whatever the root cause: **the trace's initial input becomes a regression fixture**, and the class of failure gets a detector (e.g., alert on finishes whose citations don't appear in the run's tool calls). The structure interviewers reward: termination status → grounding path → data integrity → systematize the fix. **Follow-up probe:** \"trace shows the model *did* read correct data and still misstated it\" → that's a synthesis failure: shrink the distance between evidence and answer (quote-then-answer prompting), and it's an eval case now.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Your agent works. Now make changing it safe." — the interviewer wants your path from trace logs to a regression/eval loop.',
      answer:
        "Four moves. (1) **Curate**: mine traces for ~30–50 representative inputs — the common paths, every postmortem'd failure, and the weird tail (budget kills, multi-replan runs). Store input + frozen tool environment (stub the tools with recorded results where determinism matters). (2) **Define checkable outcomes** per case — not 'answer is good' but `complete == true`, `iterations <= 12`, `citations ⊆ files actually read`, `answer mentions X` — assertions a script can run. (3) **Gate changes**: every prompt/tool/model edit runs the suite; diffs in pass-rate, cost, and iteration count are reviewed like test failures. This catches the classic regression — a prompt tweak that fixes one case and silently doubles average iterations. (4) **Close the loop**: production keeps generating traces; failures graduate into the suite; the suite becomes the spec of what the agent must keep doing. Name the limitation honestly: replayed tool stubs drift from reality, so re-record environments periodically and keep a small live-fire subset. That maturity ladder — logs → fixtures → gated evals → continuous curation — is precisely what Module 5 industrializes. **Follow-up probe:** \"how do you eval non-deterministic outputs?\" → assertion-based checks where possible, LLM-judge with concrete rubrics where not, and n-run pass@k for flaky behaviors.",
    },
    {
      type: "keypoints",
      points: [
        "Feed errors back with **specifics** (what failed, what exists instead) — vague errors cause identical retries.",
        "Escalate: per-tool failure budgets disable a tool after N failures; hashing (tool, args) short-circuits exact repeats.",
        "Context grows every iteration and is re-billed every call: truncate outputs at the source, compact old results, keep the prefix stable and cached.",
        "Compaction fights caching — rewriting history invalidates the prefix. Compact rarely, in batches, on a threshold; watch cache_read_input_tokens to verify.",
        "Truncation notes are affordances — tell the model how to get more, and it will.",
        "Trace every LLM call, tool call, and termination to JSONL with tokens, cost, latency, and reason. If it's not in the trace, it didn't happen.",
        "Traces are assets: failures become regression fixtures, fixtures become the eval suite that makes prompt changes safe (Module 5 industrializes this).",
      ],
    },
  ],
};
