# Verification report — Module 2, Lesson 3 ("Workflows vs. Agents: The Taxonomy")
_Date: 2026-07-07 · File: `content/modules/module02/lessons/03-workflows-vs-agents.ts`_

## Verdict at a glance
| Standard | Verdict | One-line reason |
|---|---|---|
| 1. Factual accuracy | 🟠 Needs work | Core taxonomy verified word-for-word against Anthropic's own essay; but one hard internal-consistency error (wrong module number for a forward reference) |
| 2. Clarity & fluency | ✅ Strong | Clean single-line thesis, builds table → code → boundary case → drills in a sensible order |
| 3. Comprehensive depth | 🟡 Adequate | Chaining/routing get full code; orchestrator-workers/evaluator-optimizer get prose only (partly by design — deferred to Module 5) |
| 4. Anthropic + OpenAI | ✅ Strong | Both code examples tabbed with real API differences named and verified against current docs |
| 5. Engaging interactivity | ✅ Strong | 3 concept exercises incl. 2 whiteboard drills with follow-up probes, keypoints, 2 callouts |
| 6. Tables/diagrams/animations | ✅ Strong | Table and animation both verified against their actual implementation and content |
| 7. Role alignment | ✅ Strong | This is literally the most-cited interview taxonomy; drills are interview-shaped and probe past the naive answer |

**Overall:** Ship after fixing the one factual error (Module 7 → Module 5). Everything else — the taxonomy definitions, the API-level code, the tables and animation — checks out against primary sources. The depth gap on two of five patterns is a defensible design choice (explicitly deferred), not an oversight, so it's a Minor note rather than a Major one.

## Findings (most severe first)

### [Blocker] Wrong module number for the orchestrator-workers forward reference
- **Where:** `content/modules/module02/lessons/03-workflows-vs-agents.ts:220`
- **Standard:** 1. Factual accuracy (internal consistency)
- **Issue:** The lesson says *"It's the pattern behind most 'multi-agent' systems you'll meet, and Module 7 builds one."* Module 7 is "Evals, Observability & Safety" (`content/modules/module07/index.ts`) — nothing about orchestrator-workers. The lesson that actually builds this pattern is **Module 5, Lesson 4**: `content/modules/module05/lessons/04-orchestrators-workers-and-handoffs.ts`, inside "Multi-Agent Systems & Frameworks" (module05), whose stated outcome is literally *"Implement orchestrator-worker and handoff patterns with structured briefs, not raw transcripts."*
- **Why it matters:** A learner who takes this forward reference at face value and jumps ahead to check will land on the wrong module and conclude either the course is disorganized or their own understanding is wrong. It's a small thing to get right and cheap to fix — exactly the kind of internal-consistency slip the standard exists to catch.
- **Suggested fix:** Change `"Module 7 builds one"` → `"Module 5 builds one"`.

### [Minor] "Module 8 returns to it" (reward hacking) is a loose, unnamed connection
- **Where:** `content/modules/module02/lessons/03-workflows-vs-agents.ts:226`
- **Standard:** 1. Factual accuracy (internal consistency)
- **Issue:** The evaluator-optimizer reward-hacking callout ends with *"This is the same failure family as RL reward hacking — Module 8 returns to it."* Module 8 (the capstone) never uses the term "reward hacking." It does cover a closely related failure — an agent "gaming" its own test suite (`module08/lessons/03-pr-gating-and-evaluation.ts:119,290`, "test-gaming," "a gamed agent") — which is the same underlying failure family (an optimized system finding a shortcut around the true objective) but under different vocabulary.
- **Why it matters:** Lower stakes than the Blocker above since the thematic link is real, but a learner searching Module 8 for "reward hacking" verbatim won't find it, which slightly oversells the forward reference.
- **Suggested fix:** Either soften to *"Module 8 revisits this failure family under 'test-gaming'"* or leave as-is if the author intends `03-pr-gating-and-evaluation.ts` to eventually name reward hacking explicitly — a judgment call for the content owner, not a hard error.

### [Minor] Two of five patterns get no code, only a paragraph
- **Where:** `content/modules/module02/lessons/03-workflows-vs-agents.ts:219-227`
- **Standard:** 3. Comprehensive depth
- **Issue:** Prompt chaining and routing each get a full runnable code example with an Anthropic/OpenAI variant (lines 62-217). Orchestrator-workers and evaluator-optimizer get one paragraph plus, for evaluator-optimizer, a warning callout about reward hacking — no code for either.
- **Why it matters:** Against the exemplar's bar (every hard mechanism gets shown, not just named), a reader can't see what an orchestrator-workers loop or an evaluator-optimizer loop actually looks like in code from this lesson alone. That said, this looks like a deliberate scoping choice rather than an oversight: the lesson explicitly defers orchestrator-workers to Module 5's dedicated lesson, and it compensates on evaluator-optimizer by going deep on the reward-hacking failure mode instead of showing boilerplate generate-critique-revise code (which is fairly self-explanatory from the table row). It's the right call for a taxonomy-overview lesson, but worth naming so it isn't mistaken for a gap in review.
- **Suggested fix:** No action needed if the deferral is intentional (recommended reading). If you want to close the gap without adding two more full code blocks, a single short evaluator-optimizer snippet (generate → judge → loop with a round cap) would match the "show the mechanism" bar most cheaply.

## Fact-check log
| Claim | Location | Status | Source |
|---|---|---|---|
| Workflows = "predefined code paths"; Agents = "LLM dynamically directs its own process and tool usage" | :12 | verified | anthropic.com/engineering/building-effective-agents |
| Five patterns named and defined: prompt chaining, routing, parallelization (sectioning/voting), orchestrator-workers, evaluator-optimizer | :27-60, :219-220 | verified | anthropic.com/engineering/building-effective-agents |
| Anthropic tool-forcing shape: `tool_choice={"type": "tool", "name": "route"}`, schema under `input_schema`, parsed dict on `block.input` | :135-168 | verified (consistent with Anthropic Messages API tool-use conventions already confirmed in this repo's module01 lesson02) | docs.anthropic.com (Messages API / tool use) |
| OpenAI Responses API function tool shape: `{"type": "function", "name": ..., "parameters": {...}}`, forced via `tool_choice={"type": "function", "name": ...}`, output item `{"type": "function_call", "arguments": "<json string>"}` | :172-216 | verified | developers.openai.com/api/docs/guides/function-calling |
| "Module 7 builds one" (orchestrator-workers) | :220 | **contradicted** | `content/modules/module05/lessons/04-orchestrators-workers-and-handoffs.ts` + `module05/index.ts` outcomes — this is Module 5, not 7 |
| "Module 8 returns to it" (RL reward hacking) | :226 | unverifiable as literally stated | `module08/lessons/03-pr-gating-and-evaluation.ts` covers the same failure family as "test-gaming," not under the name "reward hacking" |
| animation `workflow-patterns` shows exactly the five named patterns in the caption | :21-25 | verified | `components/animations/ScaleAnims.tsx:89-95` (`PATTERNS` array matches names 1:1) |

## Mechanical pass
`checks.py`: 0 findings — no invalid animation names, no malformed markdown, section profile is `paragraph=2, heading=1, code=2, table=1, animation=1, exercise=3, list=1, callout=2, keypoints=1`, both code blocks carry Anthropic+OpenAI variants.
`pnpm exec tsc --noEmit`: clean, no output.

## Strengths worth keeping
- The taxonomy statement and all five pattern definitions are essentially verbatim-accurate to Anthropic's own essay — rare for a paraphrase this confident to survive a direct source check untouched.
- The four-question decision framework ("can the path be enumerated / blast radius / programmatic success check / cost-latency variance") is genuinely reusable and gets applied live in both whiteboard drills rather than just stated — that's the depth the exemplar rewards.
- The evaluator-optimizer reward-hacking callout is a real senior-level addition most taxonomy explainers skip entirely.
- Both code examples' explanations name an actual API difference (parsed dict vs. JSON string; required vs. optional `max_tokens`) rather than restating the code.
