import type { Lesson } from "@/lib/types";

export const lesson04: Lesson = {
  slug: "termination-and-budgets",
  title: "Termination, Budgets & Graceful Degradation",
  minutes: 25,
  summary:
    "Never trust the model alone to stop. Production agents layer termination conditions — an explicit finish tool, iteration caps, dollar budgets, wall-clock deadlines — and when a budget trips, they degrade gracefully instead of raising.",
  sections: [
    {
      type: "paragraph",
      text: "The loop from lesson 1 has a dirty secret: it terminates when `stop_reason != \"tool_use\"` — i.e., **whenever the model feels done**. Models sometimes stop early with a half-answer, and sometimes never feel done: re-grepping the same pattern, re-reading the same file, chasing a lead in circles. A model deciding 'one more tool call' 30 times in a row is not a hypothetical; it's a Tuesday. Termination must be **layered**: the model's own signal, plus hard limits the model cannot override.",
    },
    {
      type: "table",
      headers: [
        "Condition",
        "Trigger",
        "Who controls it",
        "What it protects against",
      ],
      rows: [
        [
          "Natural stop",
          '`stop_reason` is `"end_turn"` — model answered without tools',
          "Model",
          "Nothing — it IS the happy path (and sometimes a premature one)",
        ],
        [
          "Explicit `finish` tool",
          "Model calls `finish(answer, citations)`",
          "Model, but on your schema",
          "Ambiguous endings; forces a structured, complete final answer",
        ],
        [
          "Max iterations",
          "Loop counter hits N (e.g. 15)",
          "Your code",
          "Infinite tool spirals",
        ],
        [
          "Cost budget",
          "Accumulated dollars from `usage` exceed the cap",
          "Your code",
          "Expensive iterations — 15 cheap calls fine, 15 huge-context calls not",
        ],
        [
          "Wall-clock deadline",
          "`time.monotonic()` passes the deadline",
          "Your code",
          "Slow tools and long generations; the user is still waiting",
        ],
      ],
    },
    {
      type: "paragraph",
      text: "Why isn't max-iterations enough on its own? Because **iterations are not the resource — tokens, dollars, and seconds are.** One iteration that stuffs a 200KB file into context can cost more than fourteen normal ones; a tool that hangs for 40 seconds burns your latency budget in two iterations. Bound each real resource separately: count of calls, cumulative cost, and elapsed time — and check them **before** each LLM call, not after, so you never pay for a call whose result you'd discard.",
    },
    {
      type: "code",
      language: "python",
      title: "a Budget object the loop consults before every call",
      code: `import time

class Budget:
    # Pull current per-MTok prices from your provider's pricing page.
    # Never hardcode from memory; keep them in one place so tests can pin them.
    PRICE_IN_PER_MTOK = 0.0   # TODO: fill from pricing page
    PRICE_OUT_PER_MTOK = 0.0  # TODO: fill from pricing page

    def __init__(self, max_iterations: int = 15,
                 max_usd: float = 0.50, max_seconds: float = 60.0):
        self.max_iterations = max_iterations
        self.max_usd = max_usd
        self.deadline = time.monotonic() + max_seconds
        self.iterations = 0
        self.usd = 0.0

    def add_call(self, usage) -> None:
        self.iterations += 1
        self.usd += (usage.input_tokens * self.PRICE_IN_PER_MTOK +
                     usage.output_tokens * self.PRICE_OUT_PER_MTOK) / 1_000_000

    def exhausted(self) -> str | None:
        """Return a human-readable reason, or None if we may continue."""
        if self.iterations >= self.max_iterations:
            return f"iteration cap ({self.max_iterations}) reached"
        if self.usd >= self.max_usd:
            return f"cost budget exceeded ({self.usd:.3f} USD)"
        if time.monotonic() >= self.deadline:
            return "wall-clock deadline passed"
        return None`,
      explanation:
        "Small but deliberate: `exhausted()` returns a *reason string* rather than a boolean, because that reason goes into the trace log and into the degraded answer's metadata (\"incomplete: cost budget exceeded\"). `time.monotonic()` instead of `time.time()` because wall-clock time can jump (NTP adjustments); monotonic never goes backward. Prices live in named constants so a test can assert they're non-zero before you ship.",
    },
    {
      type: "heading",
      text: "The finish tool and graceful degradation",
    },
    {
      type: "code",
      language: "python",
      title: "loop with finish tool + best-effort fallback — never raises",
      code: `FINISH_TOOL = {
    "name": "finish",
    "description": (
        "Submit your final answer. Call exactly once, when you have enough "
        "evidence. Every claim must cite a file path you actually read."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
            "citations": {"type": "array", "items": {"type": "string"},
                          "description": "file paths supporting the answer"},
        },
        "required": ["answer", "citations"],
    },
}

def run(question: str, budget: Budget) -> dict:
    messages = [{"role": "user", "content": question}]
    while True:
        reason = budget.exhausted()
        if reason is not None:                    # check BEFORE paying
            return best_effort(messages, reason)

        resp = client.messages.create(
            model=MODEL, max_tokens=2048,
            tools=TOOLS + [FINISH_TOOL], messages=messages,
        )
        budget.add_call(resp.usage)

        finish = next((b for b in resp.content
                       if b.type == "tool_use" and b.name == "finish"), None)
        if finish is not None:
            return {"answer": finish.input["answer"],
                    "citations": finish.input["citations"],
                    "complete": True}

        if resp.stop_reason != "tool_use":
            # model stopped talking without calling finish — nudge once
            messages.append({"role": "assistant", "content": resp.content})
            messages.append({"role": "user", "content":
                "Call the finish tool with your answer and citations."})
            continue

        messages.append({"role": "assistant", "content": resp.content})
        messages.append({"role": "user",
                         "content": execute_all(resp.content)})  # lesson 5

def best_effort(messages, reason: str) -> dict:
    """Budget is gone. One last cheap call, NO tools, to salvage an answer."""
    wrap_up = messages + [{"role": "user", "content":
        "Budget exhausted (" + reason + "). Using only what you have "
        "already found, give your best answer and state explicitly what "
        "you could not verify."}]
    resp = client.messages.create(model=MODEL, max_tokens=1024,
                                  messages=wrap_up)
    return {"answer": resp.content[0].text, "citations": [],
            "complete": False, "stop_reason": reason}`,
      explanation:
        "Three design points. (1) The `finish` tool turns 'the model went quiet' into a structured, citation-bearing artifact — and lets you *reject* endings that lack citations. (2) The budget check sits at the **top** of the loop, so exhaustion is detected before spending. (3) `best_effort` makes one final tool-free call — a caller gets `{complete: false, stop_reason: ...}` instead of a stack trace. One subtlety: the message array must end in an API-legal state (every `tool_use` answered) before the wrap-up call, which the loop guarantees since results are appended in the same iteration.",
    },
    {
      type: "callout",
      kind: "tip",
      title: "Budget the tools too",
      text: 'The LLM call isn\'t the only thing that burns time — a `grep` over a huge repo or a slow network tool can eat the deadline while the budget object sleeps. Give each tool execution its own timeout (a few seconds), and return "tool timed out" as an error result so the model can adapt. Latency budget = LLM time + tool time; meter both.',
    },
    {
      type: "keypoints",
      points: [
        "Layer termination: model's natural stop **plus** finish tool **plus** iteration cap **plus** cost budget **plus** wall-clock deadline. Never trust the model alone.",
        "Iterations aren't the resource — tokens, dollars, seconds are. Bound each separately.",
        "Check the budget *before* the LLM call; return a reason string, not a boolean.",
        "An explicit `finish(answer, citations)` tool forces structured, verifiable endings.",
        "On exhaustion: one final tool-free wrap-up call → best-effort answer flagged `complete: false`. Exceptions are for bugs, not budgets.",
      ],
    },
  ],
};
