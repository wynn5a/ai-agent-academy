import type { Lesson } from "@/lib/types";

export const lesson05: Lesson = {
  slug: "failure-recovery-and-tracing",
  title: "Failure Recovery, Context Discipline & Tracing",
  minutes: 25,
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
    },
    {
      type: "keypoints",
      points: [
        "Feed errors back with **specifics** (what failed, what exists instead) — vague errors cause identical retries.",
        "Escalate: per-tool failure budgets disable a tool after N failures; hashing (tool, args) short-circuits exact repeats.",
        "Context grows every iteration and is re-billed every call: truncate outputs at the source, compact old results, keep the prefix stable and cached.",
        "Truncation notes are affordances — tell the model how to get more, and it will.",
        "Trace every LLM call, tool call, and termination to JSONL with tokens, cost, latency, and reason. If it's not in the trace, it didn't happen.",
      ],
    },
  ],
};
