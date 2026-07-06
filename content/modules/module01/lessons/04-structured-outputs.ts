import type { Lesson } from "@/lib/types";

export const lesson04: Lesson = {
  slug: "structured-outputs",
  title: "Structured Outputs & JSON Schema",
  minutes: 30,
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
          "A forced tool call with `strict: true` set on the tool",
          "Same guarantee — but only when `strict` is set. Plain forced calls (no `strict`) aren't grammar-enforced and can still deviate.",
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
      provider: "claude",
      variants: [
        {
          provider: "openai",
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

resp = client.responses.create(
    model="gpt-5.5",
    input=[{"role": "user", "content": f"Classify this ticket: {ticket_text}"}],
    text={"format": {"type": "json_schema", "name": "ticket",
                     "schema": TICKET_SCHEMA, "strict": True}},
)
data = json.loads(resp.output_text)   # guaranteed to match the schema`,
          explanation:
            "OpenAI nests the schema under `text.format` with a required `name` and an explicit `strict: True` (vs Anthropic's `output_config.format`); the constrained-decoding guarantees and limits are the same.",
        },
      ],
    },
    {
      type: "callout",
      kind: "warning",
      title: "OpenAI strict mode has no true optional field",
      text: 'OpenAI\'s `strict: true` requires **every** property in `properties` to also appear in `required` — there\'s no way to just omit an optional one. To fake it, make the type nullable (`{"type": ["string", "null"]}`) and keep it in `required`; the model returns `null` when it has nothing to say. Anthropic\'s `output_config.format` doesn\'t have this restriction — a property left out of `required` is genuinely optional there. It\'s a real asymmetry, and the one OpenAI structured-outputs gotcha every team hits once (Pydantic\'s `Optional[...]` and Zod\'s `.optional()`/`.nullish()` both produce schemas OpenAI rejects — use a plain nullable type instead).',
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
            "additionalProperties": False,     # required for strict tool use
        },
        "strict": True,     # opts into the same constrained-decoding guarantee
    }],
    tool_choice={"type": "tool", "name": "record_ticket"},   # MUST call it
    messages=[{"role": "user", "content": f"Classify this ticket: {ticket_text}"}],
)
data = next(b for b in resp.content if b.type == "tool_use").input
# data is a dict matching the schema — no parsing prose`,
      explanation:
        "`tool_choice` forces the call, so the 'tool' is really just an output mold — but the schema guarantee only kicks in with `strict: true` on the tool (Anthropic's *strict tool use*, a separate opt-in from `output_config.format`, with the same `additionalProperties: false` + fully-`required` preconditions). Without `strict`, a forced call can still emit arguments that miss the schema. Before native structured outputs shipped, plain forced tool calls (no `strict`) *were* the standard pattern — reliable in practice, but not grammar-enforced — and that best-effort version remains the fallback for providers whose tool calling doesn't support schema-constrained decoding at all.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `# Define your desired OUTPUT as a tool schema, then force the model to "call" it.
resp = client.responses.create(
    model="gpt-5.5",
    tools=[{
        "type": "function",
        "name": "record_ticket",
        "description": "Record the classified support ticket.",
        "strict": True,     # opts into schema-enforced arguments
        "parameters": {
            "type": "object",
            "properties": {
                "category": {"type": "string",
                             "enum": ["billing", "bug", "feature_request", "other"]},
                "severity": {"type": "integer", "minimum": 1, "maximum": 5},
                "summary":  {"type": "string"},
            },
            "required": ["category", "severity", "summary"],
            "additionalProperties": False,     # required for strict mode
        },
    }],
    tool_choice={"type": "function", "name": "record_ticket"},   # MUST call it
    input=[{"role": "user", "content": f"Classify this ticket: {ticket_text}"}],
)
call = next(i for i in resp.output if i.type == "function_call")
data = json.loads(call.arguments)
# data is a dict matching the schema — no parsing prose`,
          explanation:
            'Same trick, OpenAI plumbing: `tool_choice={"type": "function", "name": ...}` forces the call, the schema key is `parameters`, and `arguments` arrives as a JSON string to parse (vs Anthropic\'s already-parsed `block.input`). The `strict: true` here is OpenAI\'s own function-calling strict mode — the same flag structured outputs uses — and it carries the same `additionalProperties: false` + fully-`required` precondition as Anthropic\'s strict tool use.',
        },
      ],
    },
    {
      type: "heading",
      text: "How constrained decoding actually works",
    },
    {
      type: "paragraph",
      text: "This is the 'why' interviewers dig for. Your JSON schema is **compiled into a grammar** — effectively a state machine over token sequences. At every decoding step, before sampling, the logits of all tokens that would violate the grammar are **masked out** (set to −∞). The model *cannot physically emit* an invalid token: after `\"category\": \"` in our ticket schema, only tokens that begin one of the four enum values are even candidates. The guarantee isn't the model 'trying hard' — it's the sampler being fenced.",
    },
    {
      type: "paragraph",
      text: 'Understanding the mechanism makes the limits obvious. Structure, types, `enum`, `required`, string formats — all expressible as *which token can come next*, so all enforceable. But `"minimum": 1, "maximum": 5` on a number? When the model has emitted `1`, is that the value 1 (valid), or the start of 15 (invalid)? Value-level constraints aren\'t decidable token-by-token, so **numeric ranges, string lengths, and recursive schemas are not enforced** by constrained decoding. That is exactly why the validation layer below still exists, even with a \'guaranteed\' schema.',
    },
    {
      type: "animation",
      name: "schema-masking",
      caption:
        "Constrained decoding on the ticket schema: grammar-invalid tokens get their logits masked to −∞ before softmax, no matter how high their raw score was.",
    },
    {
      type: "callout",
      kind: "tip",
      text: "Two practical mechanics worth naming in an interview: schema **compilation** happens on the first request (a one-time latency hit; the compiled grammar is cached for ~24h — so keep schemas stable rather than generating them dynamically per request), and `additionalProperties: false` on every object is a *precondition* for `output_config.format` — the schema must be closed for the grammar to be finite. A complete `required` list is **not** required there — a property left out of `required` is genuinely optional and Claude can omit it. (Strict tool use and OpenAI's strict mode are stricter: both require every property in `required`, faking 'optional' with a nullable type — previous section.) The SDK helpers (`parse()` with Pydantic/Zod) quietly strip unsupported constraints from what's sent to the API and enforce them client-side.",
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
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "A teammate ships this extraction schema with native structured outputs and deletes the Pydantic validation layer — 'the API guarantees the schema now.' Weeks later, prod has tickets with `severity: 9`. Why, and what's the minimal correct setup?",
      code: `SCHEMA = {
    "type": "object",
    "properties": {
        "category": {"type": "string",
                     "enum": ["billing", "bug", "feature_request", "other"]},
        "severity": {"type": "integer", "minimum": 1, "maximum": 5},
        "summary":  {"type": "string", "maxLength": 200},
    },
    "required": ["category", "severity", "summary"],
    "additionalProperties": False,
}`,
      answer:
        "Constrained decoding enforces structure, types, enums, and required — but **not `minimum`/`maximum` or `maxLength`**, because value-level constraints aren't decidable token-by-token. Depending on the path, those constraints are either rejected or silently stripped before decoding (the SDK's `parse()` helper strips them and validates client-side — which is why the bug only appeared after the validation layer was deleted). So `severity: 9` is schema-valid as far as the grammar is concerned. Minimal correct setup: keep the ranges in the schema as documentation, **keep the Pydantic/Zod validator** for value constraints, and retry with the error fed back on the rare violation. 'Guaranteed structure' never meant 'guaranteed values.'",
    },
    {
      type: "callout",
      kind: "insight",
      title: "Interview angle",
      text: "A favorite systems question: \"the model returns JSON that fails validation in production — walk me through your mitigation ladder.\" The ladder: (1) constrain harder (native structured outputs / strict mode, enums, required); (2) validate with Pydantic/Zod and retry **with the validation error fed back**; (3) fall back to a stronger model or deterministic parser; (4) never silently regex-fix. Bonus points for knowing constrained decoding can't enforce numeric ranges — that's the validator's job.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Your extractor returns syntactically valid, schema-conforming JSON — but the `category` is wrong 15% of the time. Is structured output the fix?"',
      answer:
        'No — and recognizing that is the point of the question. Constrained decoding guarantees **structure, not semantics**: it fences *which tokens can be emitted*, not *whether the answer is right*. A 15% misclassification rate is an accuracy problem, attacked with: better prompts (clear category definitions with boundary examples), few-shot examples of the confusable cases, tightening the enum (are two categories genuinely ambiguous? — merge or add a tiebreaker field), asking the model for a confidence field and routing low-confidence items to a stronger model or a human, and above all **an eval set** so you can measure whether any change helps. Reaching for more schema when the problem is semantics is a junior tell; naming the structure-vs-correctness distinction unprompted is a senior one. **Follow-up probe:** "how do you build that eval set?" → label a few hundred real tickets, stratified by category — Module 5 territory.',
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** For each, tool call or structured output — and defend it in one sentence: (a) sentiment-score 50K reviews, (b) an assistant that files a Jira ticket when asked, (c) a router that picks which of 4 pipelines handles a document, (d) an agent that must check inventory *and then* propose an order.",
      answer:
        "(a) **Structured output** — pure extraction, no action, one schema'd call per review (and batch it — Lesson 5). (b) **Tool call** — filing the ticket is a side effect your code performs; the model requests `create_ticket` and your harness gates it. (c) **Structured output with an enum** — routing is classification wearing a trench coat; no mid-task information need. (d) **Tool calling** — the model needs data your code fetches (`check_inventory`) *before* it can decide, so there's a genuine mid-task dependency; the final proposal can then be a forced structured output. The test, every time: *does the model need my code to do something mid-task?* **Follow-up probe:** \"could (d) be one structured call if you fetch inventory first yourself?\" → yes, and that's often better — orchestrate in code when the workflow is fixed; give the model tools when the workflow varies.",
    },
    {
      type: "keypoints",
      points: [
        "Native structured outputs (constrained decoding) are the default; the forced tool call is the portable fallback; JSON mode only guarantees syntax.",
        "Mechanism: the schema compiles to a grammar that masks invalid tokens' logits at every step — the model *can't* emit invalid structure.",
        "That's also the limit: value-level constraints (numeric ranges, string lengths) aren't decidable token-by-token — the validator's job, always.",
        "Validate with Pydantic/Zod even when 'guaranteed'; retry with the validation error fed back.",
        "Structure ≠ semantics: schema conformance says nothing about the answer being right — that takes prompts, evals, and routing.",
        "Extraction ≠ agent. No action needed → one forced structured call.",
      ],
    },
  ],
};
