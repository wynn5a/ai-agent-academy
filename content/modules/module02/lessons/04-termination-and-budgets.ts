import type { Lesson } from "@/lib/types";

export const lesson04: Lesson = {
  slug: "termination-and-budgets",
  title: "Termination, Budgets & Graceful Degradation",
  minutes: 35,
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
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `import json

FINISH_TOOL = {
    "type": "function",
    "name": "finish",
    "description": (
        "Submit your final answer. Call exactly once, when you have enough "
        "evidence. Every claim must cite a file path you actually read."
    ),
    "parameters": {
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
    input_items = [{"role": "user", "content": question}]
    while True:
        reason = budget.exhausted()
        if reason is not None:                    # check BEFORE paying
            return best_effort(input_items, reason)

        resp = client.responses.create(
            model=MODEL, input=input_items, tools=TOOLS + [FINISH_TOOL],
        )
        budget.add_call(resp.usage)

        calls = [item for item in resp.output if item.type == "function_call"]
        finish = next((c for c in calls if c.name == "finish"), None)
        if finish is not None:
            args = json.loads(finish.arguments)
            return {"answer": args["answer"],
                    "citations": args["citations"],
                    "complete": True}

        if not calls:
            # model stopped talking without calling finish — nudge once
            input_items += resp.output
            input_items.append({"role": "user", "content":
                "Call the finish tool with your answer and citations."})
            continue

        input_items += resp.output                # echo the calls back
        for call in calls:                        # then answer every one
            input_items.append({
                "type": "function_call_output",
                "call_id": call.call_id,
                "output": execute(call),          # lesson 5
            })

def best_effort(input_items, reason: str) -> dict:
    """Budget is gone. One last cheap call, NO tools, to salvage an answer."""
    wrap_up = input_items + [{"role": "user", "content":
        "Budget exhausted (" + reason + "). Using only what you have "
        "already found, give your best answer and state explicitly what "
        "you could not verify."}]
    resp = client.responses.create(model=MODEL, input=wrap_up)
    return {"answer": resp.output_text, "citations": [],
            "complete": False, "stop_reason": reason}`,
          explanation:
            "The loop structure, top-of-loop budget check, nudge, and best-effort fallback are identical; what inverts is termination detection — no `function_call` items in `resp.output` means 'model went quiet' (there is no `stop_reason`) — and `budget.add_call(resp.usage)` works unchanged because both SDKs name the fields `usage.input_tokens`/`usage.output_tokens`. The same legality rule applies: every echoed `function_call` needs its `function_call_output` before the next call.",
        },
      ],
    },
    {
      type: "heading",
      text: "Tell the model about the budget",
    },
    {
      type: "paragraph",
      text: "Hard enforcement and model awareness are **complementary, not alternatives** — and interviewers probe whether you know the difference. Everything above is enforcement: the model can't override it, but it also can't *see* it coming, so exhaustion always lands as a surprise mid-investigation. The refinement: inject the remaining budget into context as it shrinks (\"You have ~4 tool calls left; prioritize and start converging\") — the model paces itself, wraps up threads instead of opening new ones, and best-effort answers get dramatically better because the model *chose* what to sacrifice. Newer frontier models formalize exactly this as a native task-budget parameter: the server shows the model a countdown it self-moderates against. Either way, the invariant stands: **the model's awareness is advisory; your harness's enforcement is the guarantee.** An agent told to wrap up may still try one more call — the top-of-loop check is what makes the budget real.",
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "A teammate 'optimizes' the loop by moving the budget check to right after the API call — 'why loop around again just to check?' On budget-exhausted runs, `best_effort` itself now fails with a 400. Why?",
      code: `while True:
    resp = client.messages.create(
        model=MODEL, max_tokens=2048,
        tools=TOOLS + [FINISH_TOOL], messages=messages,
    )
    budget.add_call(resp.usage)

    reason = budget.exhausted()
    if reason is not None:
        messages.append({"role": "assistant", "content": resp.content})
        return best_effort(messages, reason)     # 400 in here. why?

    # ... finish check, tool execution, append results ...`,
      answer:
        "When the budget trips on a turn where the model requested tools, the history now ends with an assistant message containing **unanswered `tool_use` blocks** — and `best_effort` appends a plain user text message after it. Module 1's pairing rule fires: every `tool_use` must be answered by a matching `tool_result` in the next user message, so the wrap-up call is rejected with a 400. Fixes, in order of preference: keep the check at the **top** of the loop (never pay for a result you'll discard — the original design); or if you must bail after a tool-use response, first append synthetic `tool_result`s for every requested call (`\"Not executed: budget exhausted\"`, `is_error: true`) so the array is API-legal before the wrap-up. The meta-lesson: *any* code path that abandons the loop mid-iteration must leave the message array in a legal state — this bites in exception handlers too.",
    },
    {
      type: "callout",
      kind: "tip",
      title: "Budget the tools too",
      text: 'The LLM call isn\'t the only thing that burns time — a `grep` over a huge repo or a slow network tool can eat the deadline while the budget object sleeps. Give each tool execution its own timeout (a few seconds), and return "tool timed out" as an error result so the model can adapt. Latency budget = LLM time + tool time; meter both.',
    },
    {
      type: "callout",
      kind: "career",
      title: "What separates senior candidates",
      text: 'Anyone can demo the loop; **termination and budget discipline is what separates senior candidates in agent system-design interviews**. When an interviewer sketches an agent and asks "what stops it?" or "what does a run cost?", volunteering the layered guards unprompted — finish tool, iteration cap, dollar budget, wall-clock deadline, all checked *before* each call — and then defending the actual numbers from trace percentiles is the difference between a mid-level and a senior read. The drills below are rehearsal for exactly that exchange.',
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "How do you pick the actual numbers — 15 iterations, $0.50, 60 seconds? Defend them."',
      answer:
        "Never from intuition — **from trace percentiles**. Run the agent on a representative task set (or the first weeks of production traffic), plot iterations/cost/latency for *successful* runs, and set each cap at roughly p95–p99 of success plus margin. The reasoning to say out loud: a cap below p95 truncates runs that were about to succeed (you pay most of the cost and throw away the answer — the worst outcome); a cap far above p99 only bounds pathology, which is fine — that's its job. Different budgets serve different masters: the *deadline* comes from the product SLA (a user waiting tolerates 30s; a nightly job tolerates 30min), the *dollar cap* from unit economics (cost per resolved ticket must beat the human alternative), the *iteration cap* is the cheap backstop behind both. And they're per-task-shape, not global — 'summarize this file' and 'find the regression' deserve different envelopes. Close with the operational bit: log which guard fired in every termination record, and **alert when the exhaustion *rate* shifts** — a jump in budget-kills after a deploy means the task got harder or a tool got slower, and the budget just told you. **Follow-up probe:** \"a cap trips on 20% of runs — raise it?\" → first split those runs by outcome; if they were converging, raise it, but if they were spiraling, the fix is Lesson 5's defenses, and raising the cap just buys the spiral more rope.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** Same agent core, two products: (a) an interactive assistant a user watches, (b) an overnight batch analyst processing 500 jobs. Design the termination envelope for each and name what changes.",
      answer:
        "The guards are identical in kind; every *number and degradation path* changes. **(a) Interactive:** deadline dominates — ~30–60s wall-clock, modest iteration cap, per-turn dollar budget in cents; degrade by streaming partial findings and offering 'keep digging?' — the user is the escalation path, and a fast honest 'here's what I found so far' beats a slow complete answer. Tell the model its budget so it converges early. **(b) Overnight batch:** dollars dominate — generous per-job time (minutes), but a strict per-job dollar cap *plus a fleet-level budget* ($200 for the batch), because at 500 jobs the tail risk is systemic: one poisoned input pattern can spiral every job that hits it. Degrade by marking jobs `complete: false` with reasons, finishing the rest, and surfacing the failure *distribution* in the morning report; also add a circuit breaker — N consecutive budget-kills means stop the batch, something is broken. The interview point: budgets aren't properties of the agent, they're properties of the **product contract around it** — same loop, different envelope. **Follow-up probe:** \"where does the fleet budget live?\" → outside any single run — a shared counter the per-job harness checks before starting, which is also your defense against a retry storm re-running expensive failures.",
    },
    {
      type: "keypoints",
      points: [
        "Layer termination: model's natural stop **plus** finish tool **plus** iteration cap **plus** cost budget **plus** wall-clock deadline. Never trust the model alone.",
        "Iterations aren't the resource — tokens, dollars, seconds are. Bound each separately.",
        "Check the budget *before* the LLM call; return a reason string, not a boolean.",
        "An explicit `finish(answer, citations)` tool forces structured, verifiable endings.",
        "Tell the model its remaining budget so it self-paces — but awareness is advisory; harness enforcement is the guarantee.",
        "Any early exit must leave the message array API-legal: answer or stub every pending tool_use before the wrap-up call.",
        "Pick budget numbers from trace percentiles of *successful* runs (p95–p99 + margin), per task shape; alert on exhaustion-rate shifts.",
        "On exhaustion: one final tool-free wrap-up call → best-effort answer flagged `complete: false`. Exceptions are for bugs, not budgets.",
      ],
    },
  ],
};
