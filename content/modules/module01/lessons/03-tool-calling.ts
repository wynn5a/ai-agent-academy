import type { Lesson } from "@/lib/types";

export const lesson03: Lesson = {
  slug: "tool-calling",
  title: "Tool Calling End-to-End",
  minutes: 40,
  summary:
    "The mechanism that turns a text generator into something that can act. Crucial mental model: the model never executes anything — it emits structured JSON, and your code does the work.",
  sections: [
    {
      type: "callout",
      kind: "insight",
      text: "**Tool calling is just structured output plus a convention.** The model generates JSON that matches a schema you provided; you run the corresponding function; you append the result to the messages; the model continues. The model has no network access, no filesystem, no side effects — *you* are its hands.",
    },
    {
      type: "animation",
      name: "tool-calling",
      caption:
        "One complete tool-use round trip: schemas in, tool_use out, tool_result in, final answer out.",
    },
    {
      type: "heading",
      text: "The four-step dance",
    },
    {
      type: "list",
      ordered: true,
      items: [
        "**You send** messages plus `tools`: each tool has a `name`, `description`, and a JSON-schema `input_schema` for its parameters.",
        '**Model decides** it needs a tool: the response contains a `tool_use` block (Anthropic) / `tool_calls` array (OpenAI) with the tool name, generated arguments, and a unique `id`. `stop_reason` is `"tool_use"`.',
        "**You execute** the actual function with those arguments, then append (a) the assistant message verbatim, and (b) a `tool_result` referencing the same `id`, with the output as a string.",
        '**Model continues** — it may answer, or request another tool. Loop until `stop_reason` is `"end_turn"`.',
      ],
    },
    {
      type: "code",
      language: "python",
      title: "complete working tool loop (Anthropic, raw SDK)",
      code: `import json
import anthropic

client = anthropic.Anthropic()

TOOLS = [{
    "name": "get_weather",
    "description": (
        "Get current weather for a city. Use whenever the user asks about "
        "weather, temperature, or outdoor conditions. Returns Celsius."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "city": {"type": "string", "description": "City name, e.g. 'Tokyo'"},
        },
        "required": ["city"],
    },
}]

def get_weather(city: str) -> str:
    return json.dumps({"city": city, "temp_c": 21, "sky": "clear"})  # stub

messages = [{"role": "user", "content": "Should I bike to work in Tokyo today?"}]

while True:
    resp = client.messages.create(
        model="claude-sonnet-5", max_tokens=1024,
        tools=TOOLS, messages=messages,
    )
    if resp.stop_reason != "tool_use":
        print(resp.content[0].text)
        break

    # 1) append the assistant turn EXACTLY as returned
    messages.append({"role": "assistant", "content": resp.content})

    # 2) run every requested tool, append results
    results = []
    for block in resp.content:
        if block.type == "tool_use":
            output = get_weather(**block.input)      # your code acts
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,             # must match!
                "content": output,
            })
    messages.append({"role": "user", "content": results})`,
      explanation:
        "Three invariants trip everyone up: the assistant message containing `tool_use` must be resent **verbatim** (including any thinking blocks that arrived with it — on thinking-enabled models, reasoning and tool calls travel together), and every `tool_result` must reference a real `tool_use_id` from the immediately preceding assistant turn. Return a result for a tool that was never called (or drop one that was) and the API rejects the request with a 400 — the strict pairing is how the model keeps causality straight.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `import json
from openai import OpenAI

client = OpenAI()

TOOLS = [{
    "type": "function",              # flat — no nested "function" wrapper
    "name": "get_weather",
    "description": (
        "Get current weather for a city. Use whenever the user asks about "
        "weather, temperature, or outdoor conditions. Returns Celsius."
    ),
    "parameters": {                  # 'parameters', not 'input_schema'
        "type": "object",
        "properties": {
            "city": {"type": "string", "description": "City name, e.g. 'Tokyo'"},
        },
        "required": ["city"],
    },
}]

def get_weather(city: str) -> str:
    return json.dumps({"city": city, "temp_c": 21, "sky": "clear"})  # stub

input_items = [{"role": "user", "content": "Should I bike to work in Tokyo today?"}]

while True:
    resp = client.responses.create(
        model="gpt-5.5", input=input_items, tools=TOOLS,
    )
    calls = [item for item in resp.output if item.type == "function_call"]
    if not calls:
        print(resp.output_text)
        break

    for call in calls:
        # 1) echo the call item back into the input list, verbatim
        input_items.append(call)
        # 2) run the tool, append the result with the matching call_id
        args = json.loads(call.arguments)        # arrives as a STRING
        input_items.append({
            "type": "function_call_output",
            "call_id": call.call_id,             # must match!
            "output": get_weather(**args),
        })`,
          explanation:
            "The tool schema key is `parameters` (vs Anthropic's `input_schema`), arguments arrive as a JSON string you must parse (vs an already-parsed dict), and results go back as `function_call_output` items appended to the input list rather than `tool_result` blocks inside a user message.",
        },
      ],
    },
    {
      type: "heading",
      text: "OpenAI's shape, for comparison",
    },
    {
      type: "code",
      language: "python",
      title: "same dance, different field names",
      code: `input_list = [{"role": "user", "content": "Should I bike to work in Tokyo today?"}]

resp = openai_client.responses.create(
    model="gpt-5.5",
    input=input_list,
    tools=[{
        "type": "function",              # flat — no nested "function" wrapper
        "name": "get_weather",
        "description": "Get current weather for a city.",
        "parameters": {                  # 'parameters', not 'input_schema'
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    }],
)

for item in resp.output:
    if item.type == "function_call":
        args = json.loads(item.arguments)      # arrives as a STRING — parse it
        input_list.append(item)                # echo the call back, verbatim
        input_list.append({
            "type": "function_call_output",
            "call_id": item.call_id,           # must match!
            "output": get_weather(**args),
        })
# then call responses.create again with the grown input_list`,
      explanation:
        "OpenAI's current primary surface is the **Responses API** (the older Chat Completions API is still everywhere in production — know both). Same four-step dance, different plumbing: tool definitions are flat, arguments arrive as a JSON **string** you must parse, calls and results are items in a growing `input` list, and `call_id` pairing is just as strict as Anthropic's `tool_use_id`.",
      provider: "openai",
      variants: [
        {
          provider: "claude",
          code: `messages = [{"role": "user", "content": "Should I bike to work in Tokyo today?"}]

resp = client.messages.create(
    model="claude-sonnet-5", max_tokens=1024,   # max_tokens is REQUIRED
    tools=[{
        "name": "get_weather",                  # no "type" wrapper at all
        "description": "Get current weather for a city.",
        "input_schema": {                       # 'input_schema', not 'parameters'
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    }],
    messages=messages,
)

if resp.stop_reason == "tool_use":
    messages.append({"role": "assistant", "content": resp.content})  # verbatim
    results = []
    for block in resp.content:
        if block.type == "tool_use":
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,        # must match!
                "content": get_weather(**block.input),  # already a parsed dict
            })
    messages.append({"role": "user", "content": results})
# then call messages.create again with the grown messages list`,
          explanation:
            "Anthropic's mirror image: the schema key is `input_schema`, `block.input` arrives already parsed, results return as `tool_result` blocks inside a **user** message (not standalone items), and `max_tokens` is required on every call.",
        },
      ],
    },
    {
      type: "heading",
      text: "Guaranteed-valid arguments: strict mode",
    },
    {
      type: "paragraph",
      text: 'By default the model *usually* emits arguments matching your schema. Both providers now offer **strict mode** — constrained decoding that makes conformance a guarantee, not a probability. On Anthropic, set `"strict": True` as a top-level field on the tool definition (your schema must set `"additionalProperties": False` and list every property in `required`). On OpenAI, it\'s `"strict": True` in the function definition. Use it for every tool whose arguments feed real side effects.',
    },
    {
      type: "paragraph",
      text: "One more production detail: the model can request **several tools in one turn** (parallel tool calls). Execute them all — concurrently if you like — and return **all** the `tool_result` blocks in a **single** user message. Splitting results across multiple messages malforms the history and quietly teaches the model to stop parallelizing.",
    },
    {
      type: "heading",
      text: "The unhappy path: errors and runaway loops, in code",
    },
    {
      type: "paragraph",
      text: "Two invariants separate a demo loop from a production one. First: **a tool failure is information, not an exception** — return it as `tool_result` content with `is_error: true` and the model will read the error and adapt (retry with fixed arguments, try another tool, or tell the user). Raise instead, and one flaky API call kills the whole session. Second: **the loop needs its own brakes** — a max-iteration guard and duplicate-call detection — because a confused model can request the same failing tool forever, and each iteration resends the ever-growing history at full price.",
    },
    {
      type: "code",
      language: "python",
      title: "error-returning executor + guarded loop",
      code: `MAX_ITERATIONS = 15

def execute_tool(name: str, args: dict) -> tuple[str, bool]:
    """Returns (content, is_error). Never raises into the loop."""
    try:
        return TOOL_IMPLS[name](**args), False
    except KeyError:
        return f"Unknown tool: {name}", True
    except Exception as e:                     # tool bug or bad model args
        return f"{type(e).__name__}: {e}", True

def run_turn(messages: list) -> str:
    seen_calls = set()
    for _ in range(MAX_ITERATIONS):
        resp = client.messages.create(model="claude-sonnet-5",
                                      max_tokens=1024,
                                      tools=TOOLS, messages=messages)
        if resp.stop_reason != "tool_use":
            return resp.content[0].text

        messages.append({"role": "assistant", "content": resp.content})
        results = []
        for block in resp.content:
            if block.type != "tool_use":
                continue
            sig = (block.name, json.dumps(block.input, sort_keys=True))
            if sig in seen_calls:              # loop detection
                results.append({"type": "tool_result",
                                "tool_use_id": block.id, "is_error": True,
                                "content": "Repeated identical call — "
                                           "change approach or answer with "
                                           "what you have."})
                continue
            seen_calls.add(sig)
            content, is_err = execute_tool(block.name, block.input)
            results.append({"type": "tool_result", "tool_use_id": block.id,
                            "content": content, "is_error": is_err})
        messages.append({"role": "user", "content": results})
    raise RuntimeError("agent exceeded max iterations")`,
      explanation:
        "Notice the repeated-call handler still returns a `tool_result` for the block — dropping it would 400. Transient failures (network blips inside a tool) get retried **inside `execute_tool`**, not by re-calling the model: model calls are the expensive resource, tool executions are cheap. In production the iteration cap is joined by a token/dollar budget check (Lesson 5) — count both.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `MAX_ITERATIONS = 15

def execute_tool(name: str, args: dict) -> tuple[str, bool]:
    """Returns (content, is_error). Never raises into the loop."""
    try:
        return TOOL_IMPLS[name](**args), False
    except KeyError:
        return f"Unknown tool: {name}", True
    except Exception as e:                     # tool bug or bad model args
        return f"{type(e).__name__}: {e}", True

def run_turn(input_items: list) -> str:
    seen_calls = set()
    for _ in range(MAX_ITERATIONS):
        resp = client.responses.create(model="gpt-5.5",
                                       input=input_items, tools=TOOLS)
        calls = [i for i in resp.output if i.type == "function_call"]
        if not calls:
            return resp.output_text

        for call in calls:
            input_items.append(call)           # echo the call back
            sig = (call.name, call.arguments)
            if sig in seen_calls:              # loop detection
                output = ("Error: repeated identical call — change approach "
                          "or answer with what you have.")
            else:
                seen_calls.add(sig)
                content, is_err = execute_tool(call.name,
                                               json.loads(call.arguments))
                output = f"Error: {content}" if is_err else content
            input_items.append({"type": "function_call_output",
                                "call_id": call.call_id, "output": output})
    raise RuntimeError("agent exceeded max iterations")`,
          explanation:
            "`function_call_output` has no `is_error` flag (unlike Anthropic's `tool_result`) — signal failure inside the output string itself (e.g. an `Error:` prefix) so the model can still read it and adapt.",
        },
      ],
    },
    {
      type: "heading",
      text: "Designing the tool surface: what seniors get probed on",
    },
    {
      type: "list",
      items: [
        "**Tool results are prompt text you pay for on every subsequent turn.** A tool that returns a 40KB JSON dump doesn't just cost tokens once — it rides in the history for the rest of the session. Return the *minimum useful* result: filter, truncate with a note, or return an id the model can drill into with a follow-up call.",
        "**Few well-scoped tools beat many overlapping ones.** Every schema is prompt space, and near-duplicate tools (`search_users`, `find_user`, `lookup_user_by_email`) cause selection errors. Consolidate with parameters; a good heuristic is that each tool should be explainable to a new engineer in one sentence without mentioning another tool.",
        "**Descriptions carry the *when*, not just the *what*.** 'Get current weather for a city' selects worse than adding 'Use whenever the user asks about weather, temperature, or outdoor conditions. Returns Celsius.' Trigger conditions in the description measurably improve tool choice.",
        "**Mark the safety boundary in the harness, not the prompt.** Reversible read-only tools can run automatically and in parallel; hard-to-reverse ones (send email, delete, pay) get gated behind confirmation in *your code* — the model's judgment is not an access-control mechanism.",
      ],
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "This handles the tool turn. It works in every test — until the model starts making parallel calls in production, and then requests fail with a 400. Why?",
      code: `if resp.stop_reason == "tool_use":
    messages.append({"role": "assistant", "content": resp.content})
    block = next(b for b in resp.content if b.type == "tool_use")
    output = run_tool(block.name, block.input)
    messages.append({"role": "user", "content": [{
        "type": "tool_result",
        "tool_use_id": block.id,
        "content": output,
    }]})`,
      answer:
        "`next(...)` grabs **only the first** `tool_use` block. When the model requests two tools in one turn, the second request goes unanswered — and the API rejects the follow-up because every `tool_use` in the assistant turn must have a matching `tool_result`. Tests passed because simple prompts never triggered parallel calls. Fix: iterate over **all** `tool_use` blocks and return all results in one user message. This bug is common enough that interviewers plant it deliberately.",
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "This loop handles a tool-use turn. It runs once, then the second API call fails with a 400. What's wrong?",
      code: `while True:
    resp = client.messages.create(
        model="claude-sonnet-5", max_tokens=1024,
        tools=TOOLS, messages=messages,
    )
    if resp.stop_reason != "tool_use":
        break
    results = []
    for block in resp.content:
        if block.type == "tool_use":
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": run_tool(block.name, block.input),
            })
    messages.append({"role": "user", "content": results})`,
      answer:
        'It never appends the **assistant turn** before the results. The history must read: assistant message containing the `tool_use` blocks (resent verbatim), *then* a user message with matching `tool_result` blocks. Add `messages.append({"role": "assistant", "content": resp.content})` before appending results — otherwise the `tool_result` references an id that doesn\'t exist in the history, and the API rejects it with a 400.',
    },
    {
      type: "callout",
      kind: "warning",
      title: "Tool descriptions are prompts",
      text: 'The model chooses tools by reading their names and descriptions — nothing else. A bad description (`"weather tool"`) yields wrong tool choices and garbage arguments. A good one says what the tool does, **when to use it**, what it returns, and its units/limits. Anthropic\'s own guidance: extremely detailed descriptions are the single highest-leverage factor in tool-use quality.',
    },
    {
      type: "callout",
      kind: "insight",
      title: "Interview angle",
      text: "\"Whiteboard a tool-calling loop\" is the single most common agent-engineering exercise. The invariants they're checking: loop on `stop_reason`, resend the assistant turn verbatim, strict id pairing, all parallel results in one message, errors returned as `tool_result` content so the model can recover, and a max-iteration guard. If you can also say *why* each invariant exists, you're above the bar.",
    },
    {
      type: "callout",
      kind: "career",
      title: "The most-requested hard skill",
      text: "OpenAI/Anthropic function/tool calling and structured outputs appear **by name** among the most-requested skills in 2026 agent-engineering postings — part of the \"Agentic AI\" cluster that grew ~280% year over year. That's why this lesson teaches both providers' shapes side by side: the job market treats the loop above as table stakes, in either dialect.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Whiteboard a tool-calling loop." Narrate the invariants as you write — and anticipate the probes.',
      answer:
        'Skeleton: loop → call API with `tools` + full history → if `stop_reason != "tool_use"`, return the text → else append the assistant turn **verbatim** → execute every `tool_use` block → append one user message containing all `tool_result`s with matching ids → repeat. Invariants to say *while writing*: (1) resend the assistant turn exactly, including thinking blocks; (2) strict id pairing — every request answered, nothing extra, or 400; (3) all parallel results in one message; (4) errors go back as `is_error: true` content, never exceptions; (5) max-iteration guard plus a token budget; (6) the model never executes anything — your code is the boundary. Probes to expect: "why does the API 400 on a missing result?" (causal record integrity — the model must see an answer for everything it asked), "where do you retry a flaky tool?" (inside the executor, not by re-calling the model), and "what if two tools must run in order?" (the model sequences them across turns; you never reorder within one).',
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** A tool call fails with a transient network error. Walk through exactly where retry logic belongs and why.",
      answer:
        'Three layers, and mixing them up is the failure mode: (1) **inside the tool executor** — retry the HTTP call to the downstream service with backoff; this is cheap and invisible to the model; (2) **as a `tool_result` with `is_error: true`** once executor retries are exhausted — the model decides whether to try differently or degrade gracefully; (3) **around the model API call itself** — backoff for 429/5xx (Lesson 5), completely separate from tool errors. What you never do: throw away the turn and re-call the model hoping for a different tool call (expensive, non-deterministic), or retry a side-effectful tool without an idempotency key (you might send the email twice). **Follow-up probe:** "the tool is `charge_customer` — now what?" → idempotency key derived from the `tool_use_id`, which is unique per request and stable across your executor retries.',
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** How do you stop a runaway agent? List the brakes in the order they should fire.",
      answer:
        "(1) **Duplicate-call detection** — same tool + identical arguments twice means the model is stuck; return an `is_error` result telling it to change approach. (2) **Max iterations** per turn (10–20) — a hard ceiling on loop passes. (3) **Token/dollar budget** per session, checked against accumulated `usage` after every call — this is the one that caps cost even when each iteration looks 'new'. (4) **Wall-clock timeout** for the whole turn. (5) **Human escalation** as the terminal state: return what you have with an explanation, don't just die. Senior nuance: the guards must fire *gracefully* — a budget-exhausted agent should append a final message asking the model to conclude with available information, not throw mid-conversation. **Follow-up probe:** \"which guard catches a model alternating between two different failing calls?\" → not duplicate detection (arguments differ) — the iteration cap and budget are the backstop; smarter harnesses track failure *rate*, not just identity.",
    },
    {
      type: "keypoints",
      points: [
        "The model **requests**; your code **executes**. All side effects are yours.",
        'Loop on `stop_reason == "tool_use"`; resend assistant turns verbatim; match `tool_use_id` exactly.',
        "Multiple tool calls can arrive in one turn — answer all of them.",
        "Tool errors go back as `tool_result` content (with `is_error: true` on Anthropic) so the model can recover; loops need iteration caps, duplicate-call detection, and budgets.",
        "Tool results are prompt text you re-pay for every turn — return the minimum useful result.",
        "Invest in tool descriptions like you invest in prompts — they are prompts. Say *when* to use the tool, not just what it does.",
      ],
    },
  ],
};
