Good to ship. I verified `content/modules/module01/lessons/02-sampling-and-streaming.ts` against all seven Academy standards, ran the mechanical checker (0 findings), confirmed it type-checks (`tsc --noEmit` clean), and fact-checked the volatile API claims against current provider docs. Full report: `reviews/module01-lesson02-sampling-and-streaming-2026-07-06.md`.

**Scorecard:** Factual accuracy 🟡 · Clarity ✅ · Depth ✅ · Anthropic+OpenAI ✅ · Interactivity ✅ · Tables/diagrams/animations ✅ · Role alignment ✅. **No Blockers, no Majors** — this reads like the exemplar it is.

The fact-check held up well: Opus 4.7/4.8 rejecting sampling params, the five-level `output_config.effort` ladder (low/medium/high/xhigh/max, default `high`), the OpenAI reasoning-model rejection + exact error string, the whole `stop_reason` enum, the SSE lifecycle, and both providers' streaming event names all verified against current docs. `gpt-5.5` is a real API model. That's the hard part done right.

Three small things worth a look before you commit (all Minor/Polish, none blocking):

1. **Verify the "omit `thinking`" defaults (`:75`).** The lesson says omitting `thinking` makes Sonnet 5 run adaptive automatically but Opus 4.7/4.8 run with *no thinking at all*. Current sources actually conflict on the Opus default (one says adaptive is off-by-default, another says Opus 4.7+ "always use adaptive"), possibly an API-vs-Claude-Code split I couldn't pin to one primary statement. The teaching point (be explicit about `thinking`) is fine — just confirm or soften the specific per-tier default.

2. **The `GPT-5.2 → reasoning_effort:"none"` example (`:79`) is the wrong version.** The documented default-`none` release is **GPT-5.1** (gpt-5.5 defaults to `medium`). The claim is well-hedged with "check the docs," so it's not wrong in spirit — just swap the example to 5.1.

3. **Two effort-value comments lag their model (`:89`, `:106`).** `xhigh` is Opus-4.7-exclusive so listing it on a Sonnet-5 call is slightly off, and the gpt-5.5 comment lists `minimal` where 5.1+ uses `none` (the prose at `:79` already says "minimal/none" correctly).

Optional polish: all four exercises are `kind: "concept"` — the streaming JSON accumulator is begging for a `spot-the-bug`; and there's no `career`/"Hiring signal" callout despite heavy interview framing (the `stop_reason`-completeness point is a natural one).

Want me to apply the three factual/precision fixes (findings 1–3) and leave the polish suggestions to you? I'll match the lesson's voice and only touch content after your go-ahead.
