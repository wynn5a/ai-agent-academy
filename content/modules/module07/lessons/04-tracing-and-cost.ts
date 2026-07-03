import type { Lesson } from "@/lib/types";

export const lesson04: Lesson = {
  slug: "tracing-and-cost",
  title: "Tracing, Structured Logging & Cost Dashboards",
  minutes: 27,
  summary:
    "When an agent misbehaves in production you cannot attach a debugger to a probability distribution. You need traces: every run tagged with an ID, every LLM and tool call a span carrying tokens, cost, and latency. Then a cost regression becomes a query, not a guess.",
  sections: [
    {
      type: "paragraph",
      text: "An agent run is a tree of nested calls — the top-level task, its LLM turns, the tools each turn fires, the sub-calls those tools make. When something goes wrong, 'the agent gave a bad answer' is useless; you need to see *which* turn chose *which* tool with *which* arguments, how many tokens it burned, and how long it took. That structured, nested record is a **trace**, and instrumenting for it is not optional at production scale.",
    },
    {
      type: "animation",
      name: "agent-loop",
      caption:
        "Every iteration of the loop emits spans: the LLM call and each tool call, each carrying tokens, cost, and latency under one trace ID.",
    },
    {
      type: "heading",
      text: "The vocabulary: traces and spans",
    },
    {
      type: "list",
      items: [
        "**Trace:** one complete run of your agent, start to finish, under a single `trace_id`. Everything about handling one user request lives here.",
        "**Span:** one unit of work inside a trace — an LLM call, a tool call, a retrieval step. Spans nest to form the call tree, and each records start/end time, inputs, outputs, and metadata.",
        "**Metadata worth attaching to every span:** input and output tokens, dollar cost, latency, model name and version, and on tool spans the tool name and whether it errored.",
      ],
    },
    {
      type: "paragraph",
      text: "Tracing tools built for LLM apps — **Langfuse** is a common, well-documented open-source choice — give you this call tree, per-span token and cost accounting, and a UI to click through a failing run, nearly for free once wired in. The concepts below are portable; the SDK specifics change, so always confirm against current Langfuse docs before you rely on an exact signature.",
    },
    {
      type: "code",
      language: "python",
      title: "tracing an agent run with Langfuse (decorator + spans)",
      code: `# Patterns shown are the stable, documented shape; confirm signatures
# against the current Langfuse docs for your installed version.
from langfuse import observe, get_client

langfuse = get_client()

@observe()                                   # wraps the whole run in a trace
def handle_request(user_id: str, prompt: str) -> str:
    # Attach identifiers so you can slice traces by user/session later.
    langfuse.update_current_trace(user_id=user_id, tags=["support-agent"])
    messages = [{"role": "user", "content": prompt}]
    return agent_loop(messages)

@observe()                                   # each loop turn nests as a span
def agent_loop(messages) -> str:
    while True:
        resp = call_model(messages)          # itself observed (below)
        if resp.stop_reason != "tool_use":
            return resp.text
        messages.append({"role": "assistant", "content": resp.content})
        messages.append({"role": "user", "content": run_tools(resp.content)})

@observe(as_type="generation")               # mark LLM calls as generations
def call_model(messages):
    resp = client.messages.create(
        model="claude-sonnet-4-5", max_tokens=1024,
        tools=SCHEMAS, messages=messages,
    )
    # Report usage so cost/token dashboards populate per generation.
    langfuse.update_current_generation(
        model="claude-sonnet-4-5",
        usage_details={
            "input": resp.usage.input_tokens,
            "output": resp.usage.output_tokens,
        },
    )
    return resp`,
      explanation:
        "The `@observe` decorator turns ordinary functions into nested spans automatically, so the call tree mirrors your code with no manual plumbing. Marking LLM calls `as_type=\"generation\"` and reporting `usage_details` is what feeds the token and cost views. Attaching `user_id` and tags at the trace level is what later lets you answer 'which user's runs cost the most?' with a filter instead of a grep.",
    },
    {
      type: "heading",
      text: "Structured logging underneath",
    },
    {
      type: "paragraph",
      text: "Even with a tracing UI, keep structured logs — machine-parseable key/value records, not free-text `print`s. When your tracing backend is down or you need to reconstruct an incident from raw logs, a line of JSON with `trace_id`, `span`, `tool`, `tokens`, and `cost_usd` is queryable; a sentence of English is not. The two are complementary: traces for interactive debugging, structured logs for durable, greppable history.",
    },
    {
      type: "code",
      language: "python",
      title: "structured logs correlated by trace_id",
      code: `import json, logging, time

log = logging.getLogger("agent")

def log_event(trace_id: str, span: str, **fields):
    # One JSON object per line — ships cleanly to any log aggregator.
    record = {"ts": time.time(), "trace_id": trace_id, "span": span, **fields}
    log.info(json.dumps(record))

# Emit at every tool call so cost/latency are reconstructable from logs alone.
def run_tool(trace_id, name, args, fn):
    start = time.time()
    try:
        out = fn(**args)
        log_event(trace_id, "tool_call", tool=name, ok=True,
                  latency_ms=round((time.time() - start) * 1000))
        return out
    except Exception as e:
        log_event(trace_id, "tool_call", tool=name, ok=False,
                  error=type(e).__name__, latency_ms=round((time.time() - start) * 1000))
        raise`,
      explanation:
        "The key discipline is one JSON object per line, always carrying the `trace_id` so logs and traces reconcile. With this you can answer operational questions — error rate per tool, p95 latency, cost per user per day — by querying logs, even when the fancy UI is unavailable. Never log secrets or full user PII into these records.",
    },
    {
      type: "heading",
      text: "Diagnosing a cost regression from traces",
    },
    {
      type: "paragraph",
      text: "Here is the payoff scenario from the checklist: your agent's cost doubled week-over-week with flat traffic. Without traces this is a panicked afternoon of guessing. With them it's a sequence of filters: is cost-per-run up, or run-count up (traffic is flat, so cost-per-run)? Then slice per-span: which span's token count grew? Common culprits surface immediately — a retrieval step now stuffing far more context, prompt caching silently breaking so the whole prefix re-bills every turn, or the loop taking more turns because a tool started erroring and the agent keeps retrying.",
    },
    {
      type: "table",
      headers: ["Symptom in traces", "Likely cause", "Fix"],
      rows: [
        [
          "Input tokens per generation jumped",
          "Cache misses (prefix reordered/edited), or retrieval returning more chunks",
          "Restore stable cache prefix; cap retrieved context",
        ],
        [
          "More turns per trace than before",
          "A tool started erroring; agent retries in a loop",
          "Fix the tool; add a max-iteration guard and error-aware backoff",
        ],
        [
          "Output tokens ballooned",
          "Prompt change encouraged verbosity, or max_tokens raised",
          "Constrain the prompt; lower the cap",
        ],
        [
          "One user's traces dominate cost",
          "Abuse, or a pathological input hitting a slow path",
          "Per-user budget/rate limit; investigate the input",
        ],
      ],
    },
    {
      type: "callout",
      kind: "tip",
      title: "Dashboards you actually check",
      text: "A cost dashboard is only useful if it's aggregated the way you make decisions: cost per run, cost per user, cost per day, and cost per tool. Add an alert on the derivatives — 'cost per run up 50% versus 7-day median' — so a regression pages you instead of waiting for the monthly invoice. The trace data already carries everything these need.",
    },
    {
      type: "keypoints",
      points: [
        "A trace is one run under one ID; spans are the nested LLM/tool calls, each carrying tokens, cost, latency.",
        "Langfuse (or similar) gives the call tree and cost accounting nearly free once instrumented — confirm SDK specifics against current docs.",
        "Mark LLM calls as generations and report usage so token/cost views populate.",
        "Keep structured (JSON-per-line) logs correlated by trace_id for durable, greppable history — never log secrets/PII.",
        "Cost regression with flat traffic → slice per-span: cache misses, extra turns, verbosity, or one heavy user.",
        "Dashboard by run/user/day/tool and alert on derivatives, not absolute monthly totals.",
      ],
    },
  ],
};
