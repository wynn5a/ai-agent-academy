# Module 5 Review — "Multi-Agent Systems & Frameworks"

Reviewed: `content/modules/module05/` (index, 5 lessons, quiz, lab, resources) against the
Academy quality bar — factual accuracy, clarity, depth, Anthropic+OpenAI parity, interactivity,
tables/diagrams/animations, and Senior-AI-Agent-Engineer role alignment.

**Verdict: strong module, close to ship. Two blocking defects (both quick fixes), one
should-fix parity gap, two minor polish items.**

---

## What's already excellent (don't touch)

- **Technical accuracy is high and correctly version-hedged.** LangGraph APIs are right:
  `StateGraph/START/END`, `Annotated[list, operator.add]` reducers, `MemorySaver` from
  `langgraph.checkpoint.memory`, `interrupt()` / `Command(resume=...)`, `get_state()` →
  `.values`/`.next`, `invoke(None, config)` resume, `RetryPolicy`. The fan-out (`Send`) and
  interrupt surfaces are explicitly flagged as version-volatile ("exact signature varies by
  version — check your installed version") — exactly the right hedge, and lesson 1 even makes
  that churn a spot-the-bug exercise.
- **The math checks out.** `0.9^5 ≈ 0.59` (quiz Q3, lesson 5); the worked cost multiplication
  (19 agent-iterations, "2–4× realistic") is self-consistent and honestly hedged.
- **Exercises are the module's standout feature.** Every lesson pairs a `spot-the-bug` with
  `concept` whiteboard drills that include interviewer follow-up probes — this is precisely the
  senior-role signal the course targets.
- **Cross-module callbacks are tight and correct:** Module 1 idempotency (resumed side effects),
  Module 3 tracing + LLM-judge discipline, Module 4 context pollution. Lesson 3's keypoint
  cross-reference "(Checkpoint-quiz question 1.)" is accurate — Q1 is the three-capability
  question.
- **Career callouts are backed by evidence.** Lesson 1's LinkedIn "#1 fastest-growing," ~40%
  LangChain-ecosystem, and AutoGen/CrewAI claims match
  `../ai-agent-engineer-hiring-research-2026.md` lines 23/46 (including the "single-source
  estimate" hedge).
- **The honesty-clause / single-agent-baseline framing** (lesson 5 + lab) is the exact
  differentiator the module promises, and the LLM-judge harness correctly randomizes order and
  uses a rubric.
- **Resource URLs resolve.** Anthropic essay loads (title "How we built our multi-agent research
  system"); the others are live. (One redirect — see minor item 5.)

---

## BLOCKING — fix before ship

### B1. Broken quiz cross-reference in Lesson 2
`content/modules/module05/lessons/02-state-nodes-and-edges.ts:125` — the "Design the schema
before the graph" tip says the field-owner/reader table exercise "is also **checkpoint-quiz
question 10**." But quiz **Q10** (`quiz.ts:122`) is the *parallel-searcher `findings` reducer /
clobbering* question — a different topic. In fact **no** quiz question covers the
field-owner/reader schema-design exercise the tip points at, so the reference has no valid target.
- Fix: either drop the specific number ("…and interviewers ask exactly this") or add a quiz
  question that actually tests schema field-ownership and point to it. Hard-coded question numbers
  are brittle; prefer topic references over numbers unless you keep them in sync.

### B2. Dead lab starter-code reference
`lab.ts:7` (objective) and the skeleton block (`lab.ts:31`) tell the learner "Starter code lives
in **labs/lab05-multi-agent/**" and to "fill in the TODOs" — but that directory **does not exist**
in the repo (`../labs/` contains only `lab01-agent-loop/`). A learner following the lab hits a
missing path.
- Note: labs 02/03/06 dirs are also absent, so this is a repo-wide pending-scaffolding condition,
  not unique to module 5. But for module 5 to be "ready," either scaffold
  `labs/lab05-multi-agent/` with the `state.py / handoff.py / graph.py / baseline.py / compare.py`
  stubs the skeleton implies, or soften the wording to "suggested structure" until the starter
  exists.

---

## SHOULD-FIX — quality / provider parity

### S1. Framework-level Anthropic+OpenAI parity gap (Lesson 4)
The module nails **model**-provider parity: the `init_chat_model("anthropic:claude-sonnet-5")` /
`"openai:gpt-5.5"` one-string swap is shown consistently (lesson 1, lesson 5, lab), which is the
right call for a LangGraph-centric module. But **framework**-level parity is missing where it
matters most:
- Lesson 4 teaches **handoffs** and **orchestrator-workers** entirely through LangGraph and never
  names the **OpenAI Agents SDK**, whose *headline primitives are literally `handoffs` and
  agents-as-tools (orchestrator-workers)* — the single most on-topic OpenAI counterpart to this
  exact lesson.
- Lesson 4:146 gestures at "frameworks built around an actor or agent-to-agent messaging model"
  without naming any (AutoGen is the obvious one).
- Lesson 1's career callout name-drops **AutoGen and CrewAI** as interview-relevant, but the body
  never says what they are — so the learner is told they matter and never taught them.
- Recommendation: add a short comparison note or a `tab-group` in lesson 4 mapping the LangGraph
  patterns to the OpenAI Agents SDK (`handoff()`, agents-as-tools), plus one line each on AutoGen
  (actor/message-passing) and CrewAI (role-based). This pays off both the parity promise and the
  career callout, and reinforces the module's own "shared state vs. message passing" section with
  concrete named frameworks.

---

## MINOR — polish

### M1. Over-precise temperature claim contradicts Module 1's own nuance
`lessons/05-when-multi-agent-is-worth-it.ts:125` says "current frontier Claude models reject
`temperature`/`top_p`/`top_k` **entirely**" — but the same code block names **`claude-sonnet-5`**
as the judge, and Module 1 (`module01/lessons/02-sampling-and-streaming.ts:71`) establishes that
Sonnet 5 only 400s on a *non-default* temperature (default is accepted); "entirely" is true for
Opus 4.7/4.8, not Sonnet 5. The pedagogical point (temperature isn't a determinism lever)
survives, but the wording overstates it. Module 7 uses the same blanket phrasing, so if you tighten
it, align all three call sites.

### M2. Resource URL redirect
`resources.ts:19` — `https://cognition.ai/blog/dont-build-multi-agents` 301-redirects to
`cognition.com/blog/...`. It still works, but update to the canonical `.com` to avoid the hop.

---

## Coverage snapshot

| Standard | Assessment |
|---|---|
| Factual accuracy | Strong; version churn hedged well. Only nuance: M1. |
| Clarity / fluency | Excellent — dense but readable, strong analogies (telephone game, org charts). |
| Depth (senior bar) | Excellent — exactly-once trap, reducers-as-state-machine, debugging multiplication all go past surface level. |
| Anthropic + OpenAI parity | Model level: strong. Framework level: gap (S1). |
| Interactivity | Best-in-class — spot-the-bug + concept drills with follow-up probes throughout. |
| Tables / diagrams / animations | All 3 animations (`agent-loop`, `workflow-patterns`, `multi-agent`) exist and dispatch; tables are used well and non-redundantly. |
| Role alignment | Excellent — the "is multi-agent even worth it" judgment call and honest baseline are the exact interview signal. |

**Bottom line:** fix B1 and B2 (both ~10-minute edits) and the module is shippable. S1 is the
highest-value content improvement; M1/M2 are cleanup.
