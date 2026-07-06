I reviewed all of Module 5 — **Multi-Agent Systems & Frameworks** — against the seven standards: all five lessons plus `quiz.ts`, `lab.ts`, `resources.ts`, and `index.ts`. Full report: `reviews/module05-2026-07-06.md`.

**Overall:** Strong, near-exemplar content — ship-worthy after one real fix. No Blockers: nothing is factually wrong, every LangGraph API is current and correctly hedged, the career/stat claims all match the hiring-research doc's own hedging, the arithmetic checks, and both the mechanical checks (checks.py: 0 findings) and the type-check (`tsc --noEmit`: clean) pass.

**Scorecard:** 1. Factual ✅ · 2. Clarity ✅ · 3. Depth ✅ · 4. Anthropic+OpenAI 🟠 · 5. Interactivity ✅ · 6. Tables/diagrams 🟡 · 7. Role alignment ✅ (one gap)

**Top findings (by severity):**

1. **[Major] The two provider-native multi-agent SDKs are never named.** A module titled "Multi-Agent Systems & Frameworks" teaches "handoffs" and "orchestrator-workers" entirely through LangGraph, but never mentions that `handoffs` and agents-as-tools are the **OpenAI Agents SDK's** flagship primitives, or Anthropic's subagent/Claude Agent SDK approach. There's a concrete difference it misses: OpenAI's handoffs transfer the *full conversation history by default* — exactly the anti-pattern Lesson 4 spends a section warning against. This is the module's biggest gap under both provider-fluency (Std 4) and role alignment (Std 7), and it's real interview exposure for an OpenAI-shop candidate. Fix: a small concept→provider-primitive comparison table + one sentence in L4's handoff section.

2. **[Minor] Over-broad Sonnet-5 sampling claim.** `lesson05:125` says frontier Claude "reject[s] `temperature`/`top_p`/`top_k` entirely," but the exemplar (M1L2) is precise that Sonnet 5 rejects only *non-default* values — and the judge code uses `claude-sonnet-5`. The conclusion holds; the phrasing contradicts the exemplar's own scoping.

3. **[Minor] Fan-out is taught without a diagram.** Dynamic fan-out/map-reduce is the module's signature new concept (L2), but the `multi-agent` animation that visualizes it is used only in the lab. Reuse it in L2.

4. **[Minor] A2A protocol gestured at but never named** in L4's message-passing section (research doc lists it as a requested skill) — though this may be intentionally deferred to Module 6 (MCP & Tool Ecosystems); worth confirming before adding.

Plus one **[Polish]**: resources omit the OpenAI Agents SDK docs.

**Strengths to protect:** the senior unhappy-path exercises (retry×reducer non-idempotency, the exactly-once side-effect trap, the telephone-game constraint-loss fix, the judge-noise-vs-real-delta predict), the error-compounding math + baseline-comparison honesty clause, the disciplined version-churn hedging, and a lab that's a bullseye on the research doc's #1 portfolio project.

Want me to apply the fixes? I'd suggest grouping them: (a) the Major provider-SDK gap — the substantive one, a table/tab-group in L1 or L4 plus the handoff-default sentence; (b) the three minors together (Sonnet-5 wording, the L2 fan-out animation, the A2A clause pending your call on M6); (c) the resources polish. Happy to do any subset.
