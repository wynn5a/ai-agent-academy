import type { Lesson } from "@/lib/types";

export const lesson04: Lesson = {
  slug: "structured-outputs",
  title: "Structured Outputs & JSON Schema",
  minutes: 20,
  summary:
    "When you need data, not prose: forcing model output to conform to a schema, and what to do when it doesn't.",
  sections: [
    {
      type: "paragraph",
      text: "Half of real-world LLM use isn't chat — it's **extraction and classification**: pull fields from an email, route a ticket, score a document. Downstream code needs types, not vibes. There are three levels of rigor for getting JSON out of a model.",
    },
    {
      type: "table",
      headers: ["Approach", "How", "Guarantee"],
      rows: [
        [
          "Prompt & pray",
          '"Respond only with JSON…"',
          "None. Fine for prototypes only.",
        ],
        [
          "JSON mode",
          '`response_format: {type: "json_object"}` (OpenAI)',
          "Syntactically valid JSON — but **any** shape.",
        ],
        [
          "Native structured outputs",
          'Anthropic: `output_config: {format: {type: "json_schema", schema}}` (or `client.messages.parse()`); OpenAI: structured outputs with `strict: true`',
          "Conforms to your schema via constrained decoding. **The current default choice.**",
        ],
        [
          "Forced tool call",
          "A forced tool call whose `input_schema` is your output schema",
          "Same guarantee — the portable fallback for any tool-calling model.",
        ],
      ],
    },
    {
      type: "code",
      language: "python",
      title: "native structured outputs (Anthropic) — the current default",
      code: `TICKET_SCHEMA = {
    "type": "object",
    "properties": {
        "category": {"type": "string",
                     "enum": ["billing", "bug", "feature_request", "other"]},
        "severity": {"type": "integer"},
        "summary":  {"type": "string"},
    },
    "required": ["category", "severity", "summary"],
    "additionalProperties": False,     # required for constrained decoding
}

resp = client.messages.create(
    model="claude-sonnet-5", max_tokens=1024,
    output_config={"format": {"type": "json_schema", "schema": TICKET_SCHEMA}},
    messages=[{"role": "user", "content": f"Classify this ticket: {ticket_text}"}],
)
data = json.loads(resp.content[0].text)   # guaranteed to match the schema`,
      explanation:
        "The SDKs also ship a convenience wrapper (`client.messages.parse()` with a Pydantic/Zod model) that validates for you. One catch: constrained decoding supports enums, `required`, and types — but **not** numeric `minimum`/`maximum` or string-length limits. Keep those in your schema for documentation, but enforce them client-side (next section).",
    },
    {
      type: "code",
      language: "python",
      title: "the tool-call trick — the portable fallback",
      code: `# Define your desired OUTPUT as a tool schema, then force the model to "call" it.
resp = client.messages.create(
    model="claude-sonnet-5", max_tokens=1024,
    tools=[{
        "name": "record_ticket",
        "description": "Record the classified support ticket.",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {"type": "string",
                             "enum": ["billing", "bug", "feature_request", "other"]},
                "severity": {"type": "integer", "minimum": 1, "maximum": 5},
                "summary":  {"type": "string"},
            },
            "required": ["category", "severity", "summary"],
        },
    }],
    tool_choice={"type": "tool", "name": "record_ticket"},   # MUST call it
    messages=[{"role": "user", "content": f"Classify this ticket: {ticket_text}"}],
)
data = next(b for b in resp.content if b.type == "tool_use").input
# data is a dict matching the schema — no parsing prose`,
      explanation:
        "`tool_choice` forces the call, so the 'tool' is really just an output mold. Before native structured outputs shipped, this *was* the standard Anthropic pattern — and it remains the portable one: it works on any tool-calling model, any provider, any API version. Conceptually it's also what structured outputs desugar to: constrained generation against a schema.",
    },
    {
      type: "heading",
      text: "Validate anyway — and repair",
    },
    {
      type: "code",
      language: "python",
      title: "validate with Pydantic, repair with a feedback retry",
      code: `from pydantic import BaseModel, ValidationError, conint

class Ticket(BaseModel):
    category: str
    severity: conint(ge=1, le=5)
    summary: str

def extract(text: str, max_retries: int = 2) -> Ticket:
    prompt = f"Classify this ticket: {text}"
    for attempt in range(max_retries + 1):
        raw = call_model(prompt)            # your API call
        try:
            return Ticket.model_validate(raw)
        except ValidationError as e:
            # feed the error BACK to the model — it usually self-corrects
            prompt = (f"Classify this ticket: {text}\\n"
                      f"Your previous output failed validation:\\n{e}\\n"
                      f"Return corrected JSON only.")
    raise RuntimeError("extraction failed after retries")`,
      explanation:
        "Order of mitigations for malformed output: (1) validate and **retry with the error message included** — cheapest fix, works most of the time; (2) tighten the schema/prompt (enums, `strict` mode, lower temperature); (3) fall back to a stronger model or a deterministic parser. Never silently `json.loads` and hope.",
    },
    {
      type: "callout",
      kind: "tip",
      text: "Tool calling vs. structured output — when to use which? **Tool = the model needs information or effects mid-task** (search, DB query), possibly several times. **Structured output = you need the final answer in a shape** (classification, extraction). If there's no action to perform, don't dress extraction up as an agent loop — force one schema'd output and be done.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "You're building (a) a ticket classifier that outputs `{category, severity}`, and (b) an assistant that must look up order status in a database before answering. Which mechanism fits each — structured output or tool calling — and why?",
      answer:
        "(a) **Structured output**: there's no action to perform, you just need the answer in a shape — one schema-constrained call, no loop. (b) **Tool calling**: the model needs information mid-task that only your code can fetch; it requests `get_order_status`, you execute and return the result, and the model continues. The test is 'does the model need my code to *do* something mid-task?' — if no, don't dress extraction up as an agent.",
    },
    {
      type: "callout",
      kind: "insight",
      title: "Interview angle",
      text: "A favorite systems question: \"the model returns JSON that fails validation in production — walk me through your mitigation ladder.\" The ladder: (1) constrain harder (native structured outputs / strict mode, enums, required); (2) validate with Pydantic/Zod and retry **with the validation error fed back**; (3) fall back to a stronger model or deterministic parser; (4) never silently regex-fix. Bonus points for knowing constrained decoding can't enforce numeric ranges — that's the validator's job.",
    },
    {
      type: "keypoints",
      points: [
        "Native structured outputs (constrained decoding) are the default; the forced tool call is the portable fallback; JSON mode only guarantees syntax.",
        "Constrain aggressively: enums, min/max, `required` — every constraint removes a failure mode.",
        "Validate with Pydantic/Zod even when 'guaranteed'; retry with the validation error fed back.",
        "Extraction ≠ agent. No action needed → one forced structured call.",
      ],
    },
  ],
};
