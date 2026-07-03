import type { Lab } from "@/lib/types";

export const lab01: Lab = {
  title: "Tool-Calling CLI Assistant",
  objective:
    "Build a CLI assistant from scratch — raw SDK only, no frameworks — that answers questions using three tools: calculator, get_current_time, and read_file. This is the atom every later lab is built from. Starter code lives in labs/lab01-agent-loop/.",
  sections: [
    {
      type: "heading",
      text: "What you're building",
    },
    {
      type: "paragraph",
      text: 'A terminal REPL: the user types a question, your loop calls the model with three tool schemas, executes whatever the model requests, feeds results back, and prints the final answer — plus a running token/cost report. It must survive multi-step questions like *"what\'s 3 more than the number in numbers.txt?"* (read_file → calculator → answer).',
    },
    {
      type: "animation",
      name: "agent-loop",
      caption: "Your lab in one picture: loop until stop_reason is end_turn.",
    },
    {
      type: "heading",
      text: "Suggested structure",
    },
    {
      type: "code",
      language: "python",
      title: "skeleton (fill in the TODOs)",
      code: `# tools.py — implementations + schemas
def calculator(expression: str) -> str:
    # SAFELY evaluate arithmetic. No eval() on raw input —
    # use ast.literal_eval-style parsing or a tiny recursive parser.
    ...

def get_current_time(timezone: str = "UTC") -> str: ...
def read_file(path: str) -> str:
    # constrain to the working directory; return a clear error string
    # (not an exception) when the file doesn't exist
    ...

# agent.py — the loop
def run_turn(messages, budget):
    while True:
        resp = call_with_retries(lambda: client.messages.create(
            model=MODEL, max_tokens=1024, tools=SCHEMAS, messages=messages))
        budget.add(resp.usage)                 # track every call
        if resp.stop_reason != "tool_use":
            return resp
        messages.append({"role": "assistant", "content": resp.content})
        messages.append({"role": "user", "content": execute_all(resp.content)})`,
      explanation:
        "Design decisions that matter: tool errors are **returned as strings** (with `is_error: true`) so the model can recover; the calculator must not `eval()` arbitrary input; the loop needs a max-iteration guard so a confused model can't spin forever.",
    },
  ],
  acceptanceCriteria: [
    "Raw SDK only (anthropic or openai package) — no LangChain or agent frameworks",
    'Multi-turn tool use works: a question requiring two sequential tool calls succeeds ("what\'s 3 more than the number in numbers.txt?")',
    "Tool errors (file not found, division by zero) are returned to the model, which recovers gracefully — the loop never crashes",
    "Prints total tokens + estimated cost per session (rates pulled into one constant you can update)",
    "Retries API errors with exponential backoff + jitter (max 3 attempts), never retries 400s",
    "test_agent.py passes",
  ],
  stretchGoals: [
    "Stream the final answer token-by-token while still handling tool-use turns",
    "Add prompt caching with a cache breakpoint after the system prompt + tools, and log cache-read savings",
    "Add a --think flag that enables adaptive thinking (thinking={'type': 'adaptive'}) and prints the model's reasoning summary before the final answer",
    "Practical test: re-implement the minimal one-tool loop from memory in under 30 minutes",
  ],
};
