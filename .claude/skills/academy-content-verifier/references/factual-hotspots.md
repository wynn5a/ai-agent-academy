# Factual hotspots — what rots, and where to check it

Factual accuracy is the hardest standard because most of the *dangerous* claims
are the ones that drift. Timeless facts (what softmax does, what a vector
embedding is) don't need re-checking. Spend your fact-checking budget on the
categories below — these are what go stale between the time content is written
and the time a learner repeats them in an interview.

For each risky claim in scope, resolve it to one of three states and log it:
- **verified** — a current primary source confirms it.
- **contradicted** — a current primary source disagrees; cite it, this is a Blocker.
- **unverifiable** — you couldn't confirm from an authoritative source in
  reasonable time. Say exactly that. Do **not** promote "I couldn't confirm it"
  into "it's wrong."

## The hotspot categories

1. **Model IDs and availability** — model names/versions (`claude-opus-4-8`,
   `gpt-5.5`, `claude-sonnet-5`, etc.), which tier exists, what's deprecated.
   These change constantly. Verify the model referenced actually exists and the
   behavior described is attributed to the right version.

2. **Sampling / reasoning parameter behavior** — the whole "which models accept
   `temperature`/`top_p` vs 400 on them", `thinking: {"type": "adaptive"}`,
   `output_config.effort`, `reasoning_effort` / `reasoning: {"effort": ...}`,
   default values (e.g. effort defaulting to `"high"`). This is the single most
   version-sensitive area and the content makes very specific claims about it —
   check each against current docs, and confirm claims are scoped to a version,
   not stated as a permanent per-family rule.

3. **Error / stop signals** — `stop_reason` values (Anthropic), `finish_reason`
   (OpenAI Chat Completions), `status` + `incomplete_details.reason` (OpenAI
   Responses API), refusal-as-HTTP-200 behavior, which field lives on which API.
   Field names and their possible values drift; verify the enum values quoted.

4. **API surface shape** — endpoint/method names (`messages.create`,
   `messages.stream`, `responses.create`, `responses.stream`), streaming event
   names (`content_block_delta`, `input_json_delta`,
   `response.output_text.delta`, `response.function_call_arguments.delta`),
   request/response field names. A wrong event name is a Blocker — the code
   won't work.

5. **Pricing, limits, context windows** — token prices, context-window sizes,
   rate limits, concurrent-connection caps. Almost always stale; treat any hard
   number here as suspect unless a current source backs it.

6. **Market / hiring statistics** — salary ranges, YoY growth figures,
   framework market-share percentages, "#1 fastest-growing" claims. Cross-check
   against `../ai-agent-engineer-hiring-research-2026.md`, which is the repo's
   own source of truth **and** flags which of its own figures are single-source
   or low-confidence. A finding here is often "the content hardened a hedged stat
   into a fact" — mirror the research doc's hedging.

7. **Framework / tool specifics** — LangChain/LangGraph, AutoGen, CrewAI, vector
   DBs (Pinecone, Qdrant, Weaviate), RAGAS, Langfuse/Phoenix/LangSmith, MCP, A2A.
   APIs and positioning move fast; verify version-specific API claims against
   current docs (Context7 is good for library APIs).

## Where to check (prefer primary sources)

- **Anthropic** — docs.anthropic.com (Messages API, models overview, streaming,
  tool use). Use Context7 (`/anthropics/...`) or WebFetch the docs pages.
- **OpenAI** — platform.openai.com/docs (Responses API, Chat Completions,
  reasoning models, streaming). WebFetch or Context7.
- **Libraries/frameworks** — Context7 `resolve-library-id` → `query-docs` for
  LangChain, LangGraph, RAGAS, MCP SDKs, vector DBs, etc.
- **Microsoft/Azure specifics** — `microsoft_docs_search` / `microsoft_docs_fetch`.
- **Stats/market claims** — the in-repo research doc first; then the original
  sources it cites (LinkedIn Jobs on the Rise, Stanford HAI AI Index) if you need
  to confirm a number the content states more confidently than the doc does.

## How to be efficient

- Batch the risky claims from a lesson, then check them together rather than
  interrupting the read per-claim.
- If the content already hedges toward "check the model's current docs" (the
  exemplar does this repeatedly), that claim is *lower* risk — the content is
  teaching the right instinct. Reserve Blockers for confident, specific, and
  wrong.
- A claim you can neither confirm nor refute is **unverifiable**, logged as such,
  and left for the user to judge — that's a legitimate and useful outcome, not a
  gap in the review.
