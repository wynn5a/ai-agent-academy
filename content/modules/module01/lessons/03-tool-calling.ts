import type { Lesson } from "@/lib/types";

export const lesson03: Lesson = {
  slug: "tool-calling",
  title: "Tool Calling End-to-End",
  minutes: 30,
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
      type: "keypoints",
      points: [
        "The model **requests**; your code **executes**. All side effects are yours.",
        'Loop on `stop_reason == "tool_use"`; resend assistant turns verbatim; match `tool_use_id` exactly.',
        "Multiple tool calls can arrive in one turn — answer all of them.",
        "Tool errors go back as `tool_result` content (with `is_error: true` on Anthropic) so the model can recover.",
        "Invest in tool descriptions like you invest in prompts — they are prompts.",
      ],
    },
  ],
};
