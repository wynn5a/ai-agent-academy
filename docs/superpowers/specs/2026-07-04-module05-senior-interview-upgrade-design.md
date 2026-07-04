# Module 5 Senior-Interview Upgrade — Design

**Date:** 2026-07-04
**Goal:** Same four-axis pass as Modules 1–3 (drills, gaps, exercises, deeper why) applied to Module 5 "Multi-Agent Systems & Frameworks", under the user's standing approval.

## Per-lesson changes

1. **01 what-frameworks-actually-buy-you** — "The abstraction tax, itemized" section: debugging-through-layers, prompt opacity ("can't fix what you can't see the model receiving"), lock-in, version churn, each with a mitigation; spot-the-bug exercise (loosely-pinned LangGraph upgrade breaks `interrupt_before` in production, missed by unit-only tests); drills (when a framework is actually worth its tax vs. ramp-speed cargo-culting; defeating prompt opacity against a framework you don't control). 25 → 35 min.
2. **02 state-nodes-and-edges** — "Reducers are a state-machine choice, not a syntax detail" section: cycles-vs-DAG framing, reducer semantics table (default/`operator.add`/custom) with failure modes; spot-the-bug (per-node retry policy + additive reducer double-counts findings — retries assume idempotency, accumulation is the opposite); drills (schema-first design for a 4-node triage graph; when to write a custom reducer, and the purity/order-independence contract it must satisfy). 30 → 40 min.
3. **03 checkpoints-resume-and-hitl** — "What's actually in a checkpoint, and the exactly-once trap": checkpoint contents beyond the state dict (pending-node bookkeeping), resumed-node side-effect double-fire, idempotency-key fix cross-referenced to Module 1; "Designing the human gate: placement and payload": interrupt before the irreversible action (not end-of-pipeline), structured/validated approval payloads vs. raw state dumps; spot-the-bug (OOM after a successful send, before the checkpoint write — email re-sent on resume); drills (full safety checklist for a week-long paused HITL thread; interrupt placement for a payment-dispatch graph, incl. the follow-up that the interrupt doesn't make the downstream call itself safe). 25 → 35 min.
4. **04 orchestrators-workers-and-handoffs** — "Shared state vs. message passing" section: LangGraph's shared-schema model vs. an actor/message-passing model, comparison table (debuggability, coupling, isolation, best fit), and the hybrid framing (`HandoffBrief` as message-passing discipline layered on shared-state infrastructure); "The telephone game: why chains lose information" — multi-hop summarization loses hard constraints even when each hop looks locally correct; hard-constraints-channel fix; spot-the-bug (3-hop support chain drops a refund eligibility condition because each hop summarizes the *previous brief*, not the original ticket); drills (shared state vs. message passing for a fraud-review pipeline; debugging a quality regression after adding a 4th pipeline stage). 25 → 35 min.
5. **05 when-multi-agent-is-worth-it** — model/temperature-in-judge-comment fix (canon: current frontier Claude models reject `temperature`; determinism comes from rubric + structured schema, not a sampling knob); "Cost multiplication, worked": a concrete 8-iteration single-agent vs. 19-agent-iteration five-role pipeline example showing the real 2–4x multiplier comes from re-sent context, not agent count; "Debugging multiplication": surface-area/masking/combinatorial-interaction mechanisms and the resulting non-negotiable node+handoff instrumentation bar; "Escalate on evidence, not vibes": a measurement protocol (table) replacing "does this feel like it needs a team" with concrete signals per legitimate justification; predict exercise (baseline numbers where quality delta is judge noise, cost/latency deltas are real — ship single-agent); drills (redirecting an org-chart-driven multi-agent mandate to evidence; the three mechanisms behind bug multiplication and the chronological-trace debugging procedure). 25 → 35 min.

## Quiz

+5 questions (12 → 17): prompt opacity as a structural framework cost, retry-policy + additive-reducer interaction, checkpoint exactly-once/idempotency on resume, HITL interrupt placement before irreversible actions, evidence-based read of a baseline comparison with judge-noise vs. real cost/latency deltas.

## Consistency

Confirmed no stale `claude-sonnet-4-5`/`claude-3` ids, no `temperature=`/`top_p`/`top_k` params in code, and no `content[0].text` extraction anywhere in `content/modules/module05/`. Fixed one prose reference to "temperature 0" in Lesson 5's judge explanation and code comment — replaced with "structured output, JSON schema" and an explicit canon note (current frontier Claude models reject sampling params; rubric + schema drive judge consistency instead).

## Non-goals

Lab structure, resources, index outcomes, rendering, schema.
