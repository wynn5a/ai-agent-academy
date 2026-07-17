# Verification report — M2L2 "ReAct & Planning"
_Date: 2026-07-17 · Files: content/modules/module02/lessons/02-react-and-planning.ts_

## Verdict at a glance
| Standard | Verdict | One-line reason |
|---|---|---|
| 1. Factual accuracy | ✅ Strong | ReAct lineage correct; API mechanics precise and version-scoped |
| 2. Clarity & fluency | ✅ Strong | Clean build: ReAct → tricks → typed tool calling → 3 layers → planning → drift → re-plan → externalized plans |
| 3. Comprehensive depth | ✅ Strong | Failure modes (hallucinated obs, plan drift, thrash), telemetry, drills — senior depth |
| 4. Anthropic + OpenAI | 🟡 Adequate | Both variants present and differences named; one intra-lesson API inconsistency unexplained |
| 5. Engaging interactivity | ✅ Strong | 2 runnable blocks, 3 exercises, table, animation, keypoints |
| 6. Tables/diagrams/animations | ✅ Strong | Planning table and react-pattern animation both load-bearing |
| 7. Role alignment | 🟡 Adequate | Deeply interview-framed, but no `career`/Hiring-signal callout like sibling M2L1 |

**Overall:** Ship-quality. No blockers, no factual errors, code type-checks and (with the recent quote-strip fix) runs. Three Minor findings are worth doing because two of them touch the lesson's own central theme (grounding) and its sibling-lesson consistency, not because anything is broken.

## Findings (most severe first)

### [Minor] The ReAct demo's `search` models the exact anti-pattern the lesson teaches against
- **Where:** `content/modules/module02/lessons/02-react-and-planning.ts:58` (and the OpenAI twin at `:147`)
- **Standard:** 3 (depth / internal consistency), 1 (consistency with M1L1)
- **Issue:** On a miss, `search` returns `f"No titles match {query!r}."` — a dead end. This lesson's own predict exercise (`:208`) teaches that "the Observation must come from the world" and that empty results invite hallucination; M1L1's predict exercise (`01-…:389`) explicitly says *return what does exist, not `[]`*. A learner who runs this cell (as one just did) watches the model exhaust searches on empty results and then `finish` from parametric memory — the ungrounded-finish failure the lesson is about. The demo silently teaches the bad habit the prose warns against.
- **Why it matters:** Self-inconsistency is corrosive on a senior-track platform — the runnable artifact contradicts the lesson's thesis, and the learner's first hands-on experience is the failure mode, not the intended search→lookup→finish grounding.
- **Suggested fix:** One line, in both variants:
  ```python
  return "Titles: " + ", ".join(hits) if hits else (
      "No match. The KB contains: " + ", ".join(KB))
  ```
  Keeps the "fragile text protocol" teaching intact (this is orthogonal to regex-vs-JSON) while making the demo model good tool design and converge reliably.

### [Minor] OpenAI ReAct variant switches to Chat Completions with no explanation, and the text protocol is shakier on a reasoning model
- **Where:** `content/modules/module02/lessons/02-react-and-planning.ts:170` (`client.chat.completions.create`), explanation at `:198`
- **Standard:** 4 (provider compatibility), 2 (clarity)
- **Issue:** Every other OpenAI example in this lesson and in M2L1 uses the Responses API; this one alone uses Chat Completions. The choice is defensible (Chat Completions is the natural home for the `stop` + free-text protocol, and it fits the "old technique" framing), but the explanation never says *why* it differs, so a sharp learner wonders if it's a mistake. Separately: on a reasoning model (`gpt-5.5`), Chat Completions may route through reasoning and the `stop`-sequence + `message.content` parsing story is less reliable than the prose implies.
- **Why it matters:** Interviewers probe exactly these provider seams; an unexplained API switch reads as sloppiness, and "does `stop` + content-parsing hold on a reasoning model?" is a fair follow-up the lesson leaves unanswered.
- **Suggested fix:** Add one clause to the `:198` explanation, e.g. *"We use Chat Completions here because this text protocol predates the Responses API and pairs naturally with `stop`; on a reasoning model you'd normally reach for the Responses API — this block is deliberately the legacy shape."*

### [Minor] No `career`/Hiring-signal callout despite the most interview-dense framing in the module
- **Where:** whole lesson (no `kind: "career"` callout); contrast sibling `01-…:400` ("This loop is the job description")
- **Standard:** 7 (role alignment), 5 (interactivity)
- **Issue:** The lesson says "name in interviews," "interview relevance," "the failure mode to name in interviews," and "the default for serious agents" repeatedly — but never crystallizes it into the platform's dedicated Hiring-signal callout the way M2L1 does. The signal is in prose, not in the affordance built for it.
- **Why it matters:** The `career` callout is the platform's way of telling the learner "this specific thing gets screened." Plan-drift and the ReAct→typed-tool-calling lineage are genuinely common senior-screen questions; leaving them un-flagged wastes the affordance and reads as less deliberate than the neighboring lesson.
- **Suggested fix:** Add one `callout` with `kind: "career"` near the planning drills, honest to the research doc — e.g. that "design an agent that plans and re-plans on multi-step tasks" is a recurring senior-round design prompt, and that naming plan drift + the re-plan-as-tool-call fix unprompted is the senior tell.

### [Polish] `react_step` example comment references a non-existent KB title
- **Where:** `:90` / `:179` — comment `# e.g. ("search", "agent loops")`
- **Standard:** 2 (clarity)
- **Issue:** `"agent loops"` isn't one of the KB titles (`ReAct`, `Agent loop`, `Exponential backoff`). Harmless, but a reader mapping the comment to the demo hits a tiny snag.
- **Suggested fix:** Change the example to `("search", "ReAct")` so it lines up with what the demo actually does.

## Fact-check log
| Claim | Location | Status | Source |
|---|---|---|---|
| ReAct paper: Yao et al., "ReAct: Synergizing Reasoning and Acting in Language Models," 2022 | `:12` | verified | arXiv 2210.03629 (ICLR 2023) |
| Anthropic forced tool: `tool_choice={"type":"tool","name":…}` | `:322` | verified | Anthropic tool-use docs |
| OpenAI Responses forced tool: `tool_choice={"type":"function","name":…}`; forced call arrives as `function_call` with JSON-string `arguments` | `:449`,`:455` | verified | OpenAI Responses API docs |
| Chat Completions `stop` caps at 4 sequences | `:198` | verified | OpenAI Chat Completions reference |
| Reasoning models require `max_completion_tokens` (not `max_tokens`) on Chat Completions | `:171`,`:198` | verified | OpenAI reasoning-model docs |
| Echo whole `resp.output` so reasoning items ride along or the next request 400s | `:474`,`:495` | verified (consistent w/ M2L1) | OpenAI Responses reasoning-item requirement |
| Model IDs `claude-sonnet-5`, `gpt-5.5` | `:41`,`:130` | consistent with project convention | matches M1L2 exemplar + M2L1; not independently re-verified |

## Mechanical pass
`checks.py`: no mechanical issues. Profile — paragraph=5, heading=2, code=2, table=1, animation=1, exercise=3 (predict=1, concept=2), callout=1 (warning), keypoints=1; providers claude=2/openai=2, variant-blocks=2; animation `react-pattern` valid. `pnpm exec tsc --noEmit`: clean (exit 0).

## Strengths worth keeping
- The three-layer framing (text-protocol ReAct → typed tool calling → interleaved thinking) is exactly the senior mental model and ties back to Module 1 correctly.
- Provider-difference explanations are real differences, not parallel code: `stop_sequences` vs `stop`+4-cap+`max_completion_tokens`, `tool_choice` `"tool"` vs `"function"`, JSON-string args, whole-`resp.output` echo.
- Re-planning-as-a-tool-call + the "require which observation invalidated which step" damping (`:527`) is a genuinely senior insight rarely written down.
- Externalized todo-list plans (`:501`) correctly names the coding-agent production pattern.
- Both whiteboard drills include a graded "follow-up probe," mirroring the exemplar.
