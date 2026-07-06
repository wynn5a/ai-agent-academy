I fact-checked Lessons 3 (Tool Calling) and 4 (Structured Outputs) of Module 1 and audited their Anthropic/OpenAI coverage, verifying the volatile API claims against current official docs.

**Verdict: both lessons are accurate and current, and provider coverage is strong and balanced. No factual corrections needed** — only a couple of minor polish items.

**Volatile claims I verified against live documentation (all held up):**
- Anthropic native structured outputs `output_config: {format: {type: "json_schema", schema}}` (GA), plus the `client.messages.parse()` helper — correct.
- Anthropic strict tool use: `"strict": True` top-level, requiring `additionalProperties: false` + all props in `required` — correct.
- OpenAI Responses API shapes: `text.format` structured outputs with `strict: True`; tool calling via flat `type:"function"` / `parameters`, `function_call` items in `resp.output`, `call.arguments` as a JSON string, `function_call_output` with `call_id`; no `is_error` flag on OpenAI outputs — all correct.
- Constrained decoding does not enforce `minimum`/`maximum`/`maxLength`/recursion; schema compiled on first request and cached ~24h — correct.
- Model IDs `claude-sonnet-5` and `gpt-5.5` are both real, current models as of today.
- The career-callout stat ("Agentic AI" skill cluster grew ~280% YoY, Stanford HAI 2026 AI Index) — verified correct.

**Minor polish items (optional, not errors):**
1. Lesson 3, step 2 of "the four-step dance" calls the OpenAI response a `tool_calls` array — that's Chat Completions terminology, but all the OpenAI code uses the Responses API (`function_call` items in `resp.output`). One clause bridging the two would remove the mixed-surface confusion.
2. Lesson 3 career callout says tool calling / structured outputs appear "by name" among the most-requested skills — the Stanford dataset's named clusters are actually "Agentic AI", "AI Agents", "LangGraph". The 280% figure is right; the "by name" phrasing slightly over-claims.
3. Lesson 3's two spot-the-bug exercises and the whiteboard drills use Anthropic-only syntax (`tool_use`/`tool_result`). The code blocks already teach both dialects, so this is defensible, but the exercises do lean one way.

**Provider coverage:** In Lesson 3, all three code blocks ship both dialects via `variants`, with the field-name differences called out correctly each time. Lesson 4's two main code blocks and the intro table also cover both providers. Representation is accurate for Anthropic and OpenAI throughout; the only asymmetry is the Anthropic-flavored exercises noted above.

Full details with file:line locations are in `fact-check-report.md`.
