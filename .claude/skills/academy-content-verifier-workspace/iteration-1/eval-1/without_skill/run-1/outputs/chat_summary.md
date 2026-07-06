I reviewed all of Module 5 ("Multi-Agent Systems & Frameworks") — the index, all 5 lessons, the 17-question quiz, the lab, and resources — against our quality bar. **It's a strong module, close to shippable. Two blocking defects (both ~10-min fixes), one should-fix parity gap, two minor polish items.**

Full write-up with exact `file:line` locations: `module05-review.md` in the outputs folder.

**Blocking — fix before ship**

1. **Broken quiz cross-reference** — `lessons/02-state-nodes-and-edges.ts:125`. The "design the schema before the graph" tip says that exercise "is also checkpoint-quiz question 10," but Q10 (`quiz.ts:122`) is actually the parallel-searcher reducer/clobbering question. No quiz question tests the field-owner/reader schema design the tip points to, so the reference has no valid target. (Lesson 3's "question 1" reference, by contrast, is correct.) Fix: drop the number or add a matching question.

2. **Dead lab starter-code path** — `lab.ts:7` and the skeleton tell learners "Starter code lives in `labs/lab05-multi-agent/`" and to "fill in the TODOs," but that directory doesn't exist (only `labs/lab01-agent-loop/` does). Either scaffold it or soften the wording. Note: labs 02/03/06 are also missing, so this looks like repo-wide pending work rather than a module-5-only slip.

**Should-fix — provider parity**

3. Model-level Anthropic/OpenAI parity is handled well (the `init_chat_model("anthropic:..." / "openai:...")` one-string swap, used consistently). But Lesson 4 teaches handoffs and orchestrator-workers entirely through LangGraph and never names the **OpenAI Agents SDK** — whose headline primitives are literally `handoffs` and agents-as-tools, the most on-topic OpenAI counterpart. AutoGen and CrewAI get name-dropped in Lesson 1's career callout but are never explained. A short comparison note or tab in Lesson 4 would pay off both the parity promise and that callout.

**Minor polish**

4. Lesson 5 (`:125`) says Claude models reject `temperature` "entirely," but the same block names `claude-sonnet-5` as the judge, and Module 1 establishes Sonnet 5 only rejects a *non-default* temperature. The point stands; the wording overstates it (Module 7 has the same phrasing, so align all three if you touch it).
5. `resources.ts:19` — the Cognition "Don't Build Multi-Agents" URL 301-redirects `.ai`→`.com`; update to the canonical link.

**Worth calling out as strengths:** the technical accuracy is high and correctly hedges LangGraph's version churn; the spot-the-bug + whiteboard-drill exercises (with interviewer follow-up probes) are the best in the course so far; cross-module callbacks (Module 1 idempotency, Module 3 judges, Module 4 context pollution) are accurate; the career claims match the hiring research doc; all three animations exist and dispatch; and the single-agent-baseline "honesty clause" is exactly the senior-role signal we're aiming for.

I didn't change any content — flagging only, per the default. Want me to apply the two blocking fixes (and optionally the polish items)?
