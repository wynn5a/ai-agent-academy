import type { Lesson } from "@/lib/types";

export const lesson04: Lesson = {
  slug: "tracing-and-cost",
  title: "Tracing, Structured Logging & Cost Dashboards",
  minutes: 37,
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
      provider: "claude",
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
        model="claude-sonnet-5", max_tokens=1024,
        tools=SCHEMAS, messages=messages,
    )
    # Report usage so cost/token dashboards populate per generation.
    langfuse.update_current_generation(
        model="claude-sonnet-5",
        usage_details={
            "input": resp.usage.input_tokens,
            "output": resp.usage.output_tokens,
        },
    )
    return resp`,
      explanation:
        "The `@observe` decorator turns ordinary functions into nested spans automatically, so the call tree mirrors your code with no manual plumbing. Marking LLM calls `as_type=\"generation\"` and reporting `usage_details` is what feeds the token and cost views — Langfuse multiplies the reported tokens by the model's list price (`claude-sonnet-5` runs $3/1M input, $15/1M output at list) to fill the dollar columns. Attaching `user_id` and tags at the trace level is what later lets you answer 'which user's runs cost the most?' with a filter instead of a grep.",
      variants: [
        {
          provider: "openai",
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
        calls = [it for it in resp.output if it.type == "function_call"]
        if not calls:
            return resp.output_text
        messages += resp.output              # echo the model's turn back
        messages += run_tools(calls)         # one function_call_output each

@observe(as_type="generation")               # mark LLM calls as generations
def call_model(messages):
    resp = client.responses.create(
        model="gpt-5.5",
        tools=SCHEMAS, input=messages,
    )
    # Report usage so cost/token dashboards populate per generation.
    langfuse.update_current_generation(
        model="gpt-5.5",
        usage_details={
            "input": resp.usage.input_tokens,
            "output": resp.usage.output_tokens,
        },
    )
    return resp`,
          explanation:
            "The Langfuse plumbing is byte-for-byte identical — only the SDK inside `call_model` and the loop's tool-call check change: the Responses API returns `function_call` items in `resp.output` instead of a `stop_reason`, and both SDKs expose the same `resp.usage.input_tokens` / `resp.usage.output_tokens` field names, which is why `usage_details` doesn't change. Langfuse turns those tokens into dollars from list price (`gpt-5.5` runs $5/1M input, $30/1M output at list, versus `claude-sonnet-5` at $3/$15) — exactly the delta the cost views surface if you A/B providers on the same traffic.",
        },
      ],
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
      type: "heading",
      text: "Online monitoring vs. offline evals",
    },
    {
      type: "paragraph",
      text: "Everything in Lessons 1–3 is an **offline eval**: a fixed, curated suite you run against a candidate change *before* it ships, to answer 'does this look safe on the cases we thought to check?' **Online monitoring** is a different discipline that runs *after* shipping, against live, unfiltered traffic, to answer a question offline evals structurally cannot: 'is anything drifting right now, on inputs we never thought to check?' You need both — offline evals catch known failure modes cheaply before rollout; online monitoring catches the unknown-unknowns that only surface at scale or over time: a model provider silently updating behavior behind a pinned version string, a dependency's API response shape changing, or the population of real user requests drifting away from what your suite was built to represent.",
    },
    {
      type: "list",
      items: [
        "**Canary sets:** a small, fixed sample of production-like inputs, replayed against the live system on a schedule (hourly or daily) independent of real user traffic — the same idea as a regression suite, but run continuously to catch drift from anything *other* than your own code change: a provider-side model update, silent config drift, an expired credential quietly degrading a tool. Alert when the canary score moves, not only when it hits zero.",
        "**Drift metrics:** track the distribution of operational signals over time — input token length, tool-call frequency, average iterations per run, cost-per-run — even without an obvious quality drop, a shift in these is worth investigating, because it usually means the input distribution or a dependency changed underneath you before task success visibly suffers.",
        "**User-feedback signals as weak labels:** thumbs up/down, edit distance on a drafted response, regeneration requests, and abandonment are free and high-volume, but they are **weak labels, not ground truth** — they carry heavy selection bias (only unhappy or unusually engaged users click anything), they're individually noisy (a thumbs-down can mean 'wrong,' 'I changed my mind,' or a misclick), and their meaning drifts with UI placement. Treat them as a cheap signal for *what to investigate next*, never as a metric you gate a release on, and periodically validate them against a properly sampled human-labeled set the same way you'd validate a judge.",
      ],
    },
    {
      type: "exercise",
      kind: "predict",
      prompt:
        "A team adds a 👍/👎 button to agent responses and ships a dashboard tracking 'thumbs-down rate' as its primary production quality KPI. Three weeks in, thumbs-down rate is flat at 2%, but support tickets about bad agent answers have tripled. What's wrong with trusting the metric, and what would you add?",
      answer:
        "Classic weak-label selection bias compounding with low engagement. The overwhelming majority of users who get a bad answer never click anything at all — they retry silently, give up, or open a support ticket instead — so the 2% denominator is dominated by the small, self-selected slice of users who bother to react, and that slice's composition can shift independently of true quality (a UI change moved the button, a different user cohort became a larger share of traffic). A flat 2% therefore tells you almost nothing about the other 98% of interactions, which is exactly where the tripled ticket volume is coming from. The fix: stop treating thumbs-down as a KPI and start treating it as one weak, directional signal among several — pair it with a canary set replayed on a fixed schedule for an apples-to-apples quality trend, sampled human review of a **random** slice of live traffic (not just the traffic that complained), and a direct correlation check between ticket volume, thumbs-down rate, and retrieval/tool-error rates pulled from traces to locate the actual regression. The underlying mistake was treating a convenience-sampled, low-volume click as if it were a properly sampled metric — validate feedback signals against a real sample before trusting them, the same discipline Lesson 2 applies to judges.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "You have great offline eval coverage — 95% pass rate, stable for months. Convince me you still need production monitoring."',
      answer:
        "Offline evals only answer questions about inputs you already anticipated; a static 95% on a fixed suite says nothing about live drift outside that suite's coverage. Three concrete ways reality moves without your suite noticing: a provider silently updates the model behind a pinned version string, a partner API you depend on changes its response shape, or real user phrasing shifts as a new customer segment onboards — none of these show up until you replay against **current** reality, and your offline suite by definition only replays against the reality that existed when you wrote it. The structural answer: run a canary set on a schedule so a provider-side change surfaces within hours instead of whenever someone happens to re-run the offline suite; watch drift metrics (token-length distributions, tool-call rates, cost-per-run) as leading indicators, since these often move before task success visibly drops; and treat user-feedback signals as a cheap tripwire for 'go look,' never a KPI to report alongside the eval score. One line for the interview: offline evals prove the system was correct on the day you tested it; online monitoring is the only thing that tells you it's still correct today. **Follow-up probe:** \"your canary score drops 10% overnight with no deploys on your side\" → check upstream first — the model provider's changelog or incident page, then any pinned dependency that could have silently updated — before assuming your own prompt regressed; a canary catching a provider-side change with zero deploys on your end is the canary doing exactly its job.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Design the observability stack for a production agent from scratch — what gets traced, what gets dashboarded, what pages someone at 3am?"',
      answer:
        'Layer it by audience and cost. **Traced** (per-run, per-span, always-on): every LLM call and tool call as a span with tokens, cost, latency, model version, stop_reason, and tool name/args/error — the raw material everything else derives from. **Dashboarded** (aggregated, checked daily or weekly by a human making judgment calls, not paging anyone): cost per run/user/day/tool, p50/p95 latency per stage, offline-suite task success and per-step correctness trended over time, and canary-set score trended over time. **Paged** (alerts on the *derivative*, not the absolute value): cost-per-run up X% versus the 7-day median, canary score down beyond a set threshold, per-tool error rate spiking, p95 latency breaching an SLA — alerting on rate-of-change rather than a fixed threshold, because a fixed threshold either never fires as traffic grows or fires constantly as it fluctuates normally. Explicitly exclude from paging: raw thumbs-down counts (too noisy, no clean action attached) and anything without an obvious runbook step — a page nobody can act on trains the team to ignore pages. **Follow-up probe:** "how do you avoid alert fatigue while still catching real regressions fast?" → tier it: a canary or cost-derivative breach pages immediately, since the blast radius is small and cheap to check; a soft drift in the eval trend or a feedback-signal shift goes to a daily digest for a human to triage rather than an interrupt — reserve pages for the handful of signals where minutes actually matter.',
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
        "Offline evals answer 'is this change safe on cases we anticipated'; online monitoring (canary sets, drift metrics, weak-label feedback) answers 'is anything drifting on cases we didn't' — you need both.",
        "User-feedback signals (thumbs, edits, regenerations) are weak, selection-biased labels — directional for triage, never a release-gating KPI on their own.",
      ],
    },
  ],
};
