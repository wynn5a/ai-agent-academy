---
name: academy-content-verifier
description: >-
  Quality verifier for Agent Engineering Academy course content. Use this
  whenever the user wants to verify, review, check, audit, QA, proofread, or
  "grade" Academy learning content — a single lesson, a whole module, a few
  lessons, or any combination — against the Academy's eight quality standards:
  factual accuracy, clarity/fluency, comprehensive depth, Anthropic+OpenAI
  compatibility, engaging interactivity, effective tables/diagrams/animations,
  Senior AI Agent Engineer role alignment, and native-level prose quality (no
  AI-slop tells). Trigger it for requests like "is
  this lesson accurate?", "review module 5", "check the provider coverage
  here", "does this meet our bar?", "fact-check the streaming lesson", or right
  before shipping/committing new or edited files under content/modules/. It
  reports prioritized findings with exact file:line locations and only edits
  content when you explicitly ask it to fix.
---

# Academy Content Verifier

You are reviewing content for the **Agent Engineering Academy** — an interactive
platform whose entire purpose is to make a learner hireable as a **Senior AI
Agent Engineer** (see the goal memory and `../ai-agent-engineer-hiring-research-2026.md`,
one level above the repo). Content lives as typed data literals under
`content/modules/moduleNN/` (`lessons/NN-*.ts`, `quiz.ts`, `lab.ts`,
`resources.ts`, `index.ts`), validated against `lib/types.ts`. Read `CLAUDE.md`
first if you haven't — it explains the content schema, dual-provider tabs, and
conventions.

Your job is to hold that content to eight standards and report where it falls
short — precisely, honestly, and with the reasoning a senior reviewer would
give. You are a reviewer, not an editor: **report by default, fix only when the
user explicitly asks.**

## The one exemplar to calibrate against

Before judging anything, skim `content/modules/module01/lessons/02-sampling-and-streaming.ts`.
It is the quality bar this Academy already hits: it derives a concept from first
principles (logits → softmax → sampling), states volatile API facts with
precision (which models 400 on `temperature`, exact error strings), shows both
Anthropic and OpenAI code with explanations of the *difference*, uses an
animation and comparison tables where prose would blur, and ends every hard idea
with an interview drill. When you rate other content, rate it against *this*, not
against "is it fine." Content that would look thin next to this lesson has a real
finding, even if nothing is wrong.

## Workflow

### 0. Resolve scope

The user provides a lesson, a module, several lessons, or a combination. Map it
to concrete files. A "module" review includes its lessons **and** `quiz.ts`,
`lab.ts`, `resources.ts`, `index.ts` (outcomes/description) — the learning
experience is the whole unit, not just prose. State exactly which files you're
reviewing before you start so the user can correct the scope.

### 1. Mechanical pass (cheap, run first)

Run the deterministic checker to get a structural x-ray and catch the dumb stuff
before spending judgment on prose:

```bash
python .claude/skills/academy-content-verifier/scripts/checks.py <file-or-dir> [more files...]
```

It reports invalid animation names, malformed markdown links, quiz `correct`
indices out of range, ragged tables (row width ≠ header width), and a content
profile (section-type counts, code blocks by provider and how many carry the
other provider's variant, animations used, exercise/callout counts). Also
confirm the content still type-checks — it's the schema gate the repo relies on:

```bash
pnpm exec tsc --noEmit    # or `pnpm lint` if tsc isn't wired up
```

Fold anything these surface into the report, but they are a floor, not the
review. The eight standards below are the review.

### 2. Deep read

Read every target file fully. Hold the whole thing in your head — clarity and
depth are judged across a lesson, not sentence by sentence. Note the claims that
would need checking (step 3) as you go.

### 3. Fact-check the volatile claims (live sources allowed)

Fast-moving facts drift and are the most damaging when wrong — a learner who
repeats a stale API fact in an interview looks junior. Read
`references/factual-hotspots.md` for the catalogue of claim types that go stale
(model IDs, parameter/default behavior, error codes, pricing, market stats) and
the authoritative sources to check them against. For each risky claim in scope,
verify it against a current primary source (provider docs via Context7 or
`microsoft_docs_search`, official docs via WebFetch/WebSearch). Report each as
**verified**, **contradicted** (with the source), or **unverifiable** (say so —
don't assert it's wrong just because you couldn't confirm it). Don't burn time
re-checking timeless facts (what softmax is); concentrate on what actually rots.

### 4. Score against the eight standards

Judge each standard using the rubric below. For each, give a verdict
(✅ Strong / 🟡 Adequate / 🟠 Needs work / 🔴 At risk) and the specific evidence
behind it. A verdict without a file:line example is not a finding — it's an
opinion. Explain *why* each finding matters for a learner heading into senior
interviews, because that "why" is what tells the user whether to act on it.

### 5. Write the report + chat summary

Write the full report to `reviews/<scope>-<YYYY-MM-DD>.md` (create `reviews/` if
needed; it's a scratch folder, not shipped content). Use the template below.
Then in chat, give a tight summary: the overall read, the scorecard line, and the
top 3–5 findings by severity — enough to act on without opening the file.

### 6. Offer to fix

End by offering to apply fixes, grouped so the user can accept selectively (e.g.
"want me to fix the 3 factual issues and leave the depth suggestions to you?").
Only edit content files after an explicit go-ahead. When you do fix, match the
surrounding voice and section idiom exactly — this content has a distinctive
register (direct, senior, interview-aware); a fix that reads as generic is a
regression even if it's accurate.

## The eight standards

Each has a *why* (what it protects), *what good looks like*, and *smells* (what a
finding looks like). Use judgment — these describe the intent, they aren't a
checklist to pattern-match.

### 1. Factual accuracy
**Why:** the Academy's credibility, and the learner's, rest on it. One confidently
wrong API fact repeated in an interview reads as "hasn't actually built this."
**Good:** claims are precise and current; version-specific behavior is scoped to
the version ("Opus 4.7/4.8 reject `temperature`", not "Claude rejects
temperature"); volatile facts are hedged toward "check the docs" where they
genuinely drift; internal consistency across lessons/labs/types holds.
**Smells:** absolute claims about things that vary by model version; invented
parameter names, error codes, or model IDs; stats stated as fact without the
source's own hedging (compare against how the hiring-research doc flags
single-source figures); a lesson contradicting another lesson or `lib/types.ts`.

### 2. Clarity & fluency
**Why:** a confused reader can't reach the depth; clarity is the delivery vehicle
for everything else.
**Good:** each concept is introduced before it's used; jargon is defined on first
appearance; ideas build in a sensible order; a strong reader gets it on one pass;
analogies illuminate rather than decorate.
**Smells:** forward references to undefined terms; a term used three ways; a
paragraph you have to re-read to parse; a leap where a step is missing; padding
that dilutes the point.

### 3. Comprehensive depth
**Why:** the whole differentiator is *senior* depth — the failure modes, edge
cases, and "why" that separate someone who's shipped this from someone who read a
blog post.
**Good:** the concept is covered end to end, including the unhappy path (errors,
truncation, refusals, races); the hard part is explained, not waved past; a
reader could implement or whiteboard it afterward; senior nuances are surfaced
(the exemplar's "two senior nuances" / interview-angle callouts).
**Smells:** happy-path only; the genuinely hard mechanism summarized in one vague
sentence; a topic that stops right where it gets interesting; no failure modes.

### 4. Anthropic + OpenAI compatibility
**Why:** postings name both providers; a learner must be fluent in both and
know where they *differ*, which is exactly what interviewers probe.
**Good:** provider-specific mechanics show both sides via per-block `variants` or
a `tab-group`; the explanation names the actual *difference* (e.g. Anthropic
`stop_reason` vs OpenAI `finish_reason`/`status`), not just parallel code;
genuinely provider-neutral concepts stay neutral (no forced tabs); model IDs and
API shapes are current for both.
**Smells:** provider-specific code shown for only one side; "both work the same"
where they don't; an OpenAI variant that's a lazy find-replace of the Anthropic
one and misses a real API difference; stale model IDs on one side.

### 5. Engaging interactivity
**Why:** it's an *interactive* platform; retention and understanding come from
doing, not scrolling. Passive walls of text waste the medium.
**Good:** varied section types; `exercise` (predict / spot-the-bug / concept) and
whiteboard drills where a reader should test themselves; `keypoints` that
consolidate; callouts (`tip`/`warning`/`insight`/`career`) that punctuate rather
than pad; the reader is regularly asked to think, not just read.
**Smells:** long runs of unbroken paragraphs; a hard concept with no exercise to
check understanding; a lesson that never once asks the reader to do anything;
exercises whose answers are trivial or don't teach.

### 6. Effective tables, diagrams & animations
**Why:** the right visual collapses a paragraph of comparison into something
graspable at a glance; the wrong one (or a missing one) adds load.
**Good:** comparisons/contrasts use tables (well-formed, right columns, each cell
earning space); dynamic processes use an `animation` with a valid `AnimationName`
and a caption that matches what it shows; every visual is load-bearing.
**Smells:** a multi-way comparison done in prose that begs for a table; a table
that should be prose; an animation whose caption oversells or misdescribes it; an
invalid/duplicated animation name; a hard temporal/pipeline concept with no
diagram where one would obviously help (flag the *absence*).

### 7. Senior AI Agent Engineer role alignment
**Why:** this is the north star — content that doesn't move the learner toward the
role, however elegant, is off-mission.
**Good:** topics and depth map to what postings and portfolios actually demand
(tool calling, multi-agent orchestration, RAG + evaluation, MCP/A2A,
observability, human-in-the-loop, prompt-injection defense, sandboxed execution —
see the hiring-research doc); `career`/"Hiring signal" callouts are present on
interview-relevant points and are accurate; depth targets the *senior* bar, not
intro; interview and portfolio relevance is explicit.
**Smells:** intro-level treatment of a senior topic; interview-critical material
with no signal to the learner that it's interview-critical; time spent on
low-value tangents the market doesn't ask for; a `career` callout that overclaims
what interviewers actually screen for (cross-check the research doc).

### 8. Native-level prose quality
**Why:** the content is selling senior credibility, and prose that reads as
generic AI output quietly spends it. A learner who absorbs hedge-everything,
buzzword-padded phrasing carries it into interviews and write-ups, where it reads
as someone who has skimmed the topic rather than shipped it. The writing should
sound like a fluent engineer who has done the work explaining it to a peer.
**Good:** sentences are direct and specific; claims are stated plainly instead of
cushioned; word choice is precise and idiomatic; rhythm varies (a short line
lands after a longer one); the register matches the exemplar — confident, senior,
occasionally dry — and reads as one human voice throughout.
**Smells:** the usual AI tells — opener/closer filler ("In today's fast-paced
world", "It's worth noting that", "Let's dive in", "In conclusion"); hollow
intensifiers and buzzwords standing in for substance (*crucial, powerful,
seamless, robust, cutting-edge, leverage, delve, unlock, harness*); mechanical
scaffolding ("not only X but also Y", relentless rule-of-three triads, every
paragraph the same length and shape); hedging that carries no information ("can
potentially help in a variety of ways"); em-dash-and-restate used as filler
rather than for emphasis; a tidy summary sentence that repeats what was just said.
Judge by ear: read a passage aloud and ask whether a senior engineer would
actually write it that way, or whether it reads as text a model generated to fill
space. Quote the offending phrase and rewrite it in the exemplar's voice.

## Report template

```markdown
# Verification report — <scope>
_Date: <YYYY-MM-DD> · Files: <list>_

## Verdict at a glance
| Standard | Verdict | One-line reason |
|---|---|---|
| 1. Factual accuracy | ✅/🟡/🟠/🔴 | … |
| 2. Clarity & fluency | … | … |
| 3. Comprehensive depth | … | … |
| 4. Anthropic + OpenAI | … | … |
| 5. Engaging interactivity | … | … |
| 6. Tables/diagrams/animations | … | … |
| 7. Role alignment | … | … |
| 8. Native-level prose | … | … |

**Overall:** <2–3 sentences: ship as-is / fix blockers first / etc.>

## Findings (most severe first)
### [Blocker|Major|Minor|Polish] <short title>
- **Where:** `path:line`
- **Standard:** <which of the 7>
- **Issue:** <what's wrong, concretely>
- **Why it matters:** <impact on a senior-track learner>
- **Suggested fix:** <specific rewrite or action; a diff sketch if useful>

## Fact-check log
| Claim | Location | Status | Source |
|---|---|---|---|
| … | `path:line` | verified / contradicted / unverifiable | <url> |

## Mechanical pass
<checks.py + tsc output summary; note if clean>

## Strengths worth keeping
<what's genuinely good — so a later edit doesn't regress it>
```

Severity: **Blocker** = wrong or broken, don't ship (factual error, code that
won't run, invalid animation name). **Major** = real gap a senior learner would
feel (happy-path-only depth, missing provider side). **Minor** = worth fixing
(clarity bump, a table that'd help). **Polish** = optional refinement.

## Notes

- Don't invent findings to look thorough. If content is strong, say so and keep
  the findings list short — a clean review of the exemplar lesson is a *correct*
  result, not a failure to try. Manufacturing nitpicks on good content erodes the
  user's trust in the report.
- Weight findings by learner impact, not by how many you can list. Three real
  issues beat fifteen nitpicks.
- Keep the `career`/hiring claims honest to the research doc, which itself flags
  weak/single-source figures — mirror that discipline; don't harden a hedged stat
  into a fact.
