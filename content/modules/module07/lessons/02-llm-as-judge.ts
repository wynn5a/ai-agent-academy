import type { Lesson } from "@/lib/types";

export const lesson02: Lesson = {
  slug: "llm-as-judge",
  title: "LLM-as-Judge, Done Honestly",
  minutes: 40,
  summary:
    "When correctness is subjective — faithfulness, helpfulness, tone — you reach for a model to grade a model. That's fine, but an unvalidated judge is a random number generator with a rubric. How to validate it against humans, and how to beat position, verbosity, and self-preference bias.",
  sections: [
    {
      type: "paragraph",
      text: "Some qualities can't be asserted. Was the answer *faithful* to the retrieved documents? Was it *helpful* rather than technically-correct-but-useless? Was the *tone* appropriate for an upset customer? For these you use an LLM as a judge: a second model call that reads the input, the agent's output, and a rubric, and returns a score. It's powerful and cheap. It's also easy to fool yourself with.",
    },
    {
      type: "callout",
      kind: "warning",
      title: "An unvalidated judge is worthless",
      text: "The single most common eval mistake is trusting a judge you never checked. If your judge agrees with human labels only 60% of the time, its scores are barely better than noise — and worse, they're **confidently** noisy. You must measure judge-human agreement before you let a judge gate anything.",
    },
    {
      type: "heading",
      text: "Validate the judge first",
    },
    {
      type: "paragraph",
      text: "The recipe is not optional. Hand-label a set of examples — at least ~30 to start, more is better — with the verdict you actually want. Run your judge on the same examples. Compute agreement. If it's low, fix the rubric (add anchored definitions, concrete examples of pass and fail, tighter scales) and re-measure. Only once agreement clears a bar you set in advance — many teams target roughly 85%+ — do you trust the judge to run unattended. The judge is now a validated instrument; treat any later rubric edit as re-invalidating it.",
    },
    {
      type: "code",
      language: "python",
      title: "measuring judge-human agreement",
      provider: "claude",
      code: `# Each labeled example: the case, the human verdict, and the agent output.
# labels = [{"id":..., "output":..., "human": "pass"/"fail"}, ...]
import json

import anthropic

client = anthropic.Anthropic()
labels = json.load(open("labels.json"))          # your 30+ hand-labeled examples
RUBRIC = open("rubric_faithfulness.md").read()   # anchored defs + pass/fail examples

def run_judge(output: str, rubric: str) -> str:
    # Force a structured verdict via a tool schema (Module 1 pattern).
    # Judges run in volume, so default to the cheap tier — validation
    # against human labels, not judge size, is what earns trust.
    resp = client.messages.create(
        model="claude-haiku-4-5", max_tokens=512,
        tools=[{
            "name": "record_verdict",
            "description": "Record the grading verdict for one answer.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "verdict": {"type": "string", "enum": ["pass", "fail"]},
                    "reason": {"type": "string"},
                },
                "required": ["verdict", "reason"],
            },
        }],
        tool_choice={"type": "tool", "name": "record_verdict"},
        system=rubric,
        messages=[{"role": "user", "content": f"Answer to grade:\\n{output}"}],
    )
    block = next(b for b in resp.content if b.type == "tool_use")
    return block.input["verdict"]

def agreement(labels: list[dict], rubric: str) -> float:
    hits = 0
    for ex in labels:
        if run_judge(ex["output"], rubric) == ex["human"]:
            hits += 1
    return hits / len(labels)

rate = agreement(labels, RUBRIC)
print(f"judge-human agreement: {rate:.0%}")
assert rate >= 0.85, "rubric not trustworthy yet — tune and re-measure"`,
      explanation:
        "Two things make this real: forcing a **structured verdict** so parsing never fails (the forced-tool-call trick from Module 1), and treating the agreement number as a gate. The `assert` at the end is the whole point — a judge below your bar does not get promoted to production. When you later change the rubric, you have changed the instrument, so you re-run this measurement. Note the model choice: a cheap, fast tier is the right default for a judge — and picking a judge from a **different provider or family** than the system under test blunts the self-preference bias named below.",
      variants: [
        {
          provider: "openai",
          code: `# Each labeled example: the case, the human verdict, and the agent output.
# labels = [{"id":..., "output":..., "human": "pass"/"fail"}, ...]
import json

from openai import OpenAI

client = OpenAI()
labels = json.load(open("labels.json"))          # your 30+ hand-labeled examples
RUBRIC = open("rubric_faithfulness.md").read()   # anchored defs + pass/fail examples

VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["pass", "fail"]},
        "reason": {"type": "string"},
    },
    "required": ["verdict", "reason"],
    "additionalProperties": False,
}

def run_judge(output: str, rubric: str) -> str:
    # Force a structured verdict via a strict JSON schema.
    # Judges run in volume, so default to the cheap tier — validation
    # against human labels, not judge size, is what earns trust.
    resp = client.responses.create(
        model="gpt-5.4-mini",
        instructions=rubric,
        input=[{"role": "user", "content": f"Answer to grade:\\n{output}"}],
        text={"format": {"type": "json_schema", "name": "verdict",
                         "schema": VERDICT_SCHEMA, "strict": True}},
    )
    return json.loads(resp.output_text)["verdict"]

def agreement(labels: list[dict], rubric: str) -> float:
    hits = 0
    for ex in labels:
        if run_judge(ex["output"], rubric) == ex["human"]:
            hits += 1
    return hits / len(labels)

rate = agreement(labels, RUBRIC)
print(f"judge-human agreement: {rate:.0%}")
assert rate >= 0.85, "rubric not trustworthy yet — tune and re-measure"`,
          explanation:
            "Same gate, different structured-output plumbing: the Responses API pins the verdict to a strict JSON schema via `text.format`, so `json.loads(resp.output_text)` never sees free-form prose — the role Anthropic's forced tool call plays on the Claude tab. Bonus of having both tabs: if your agent under test runs on Claude, judging it with an OpenAI model (or vice versa) blunts self-preference bias — the judge has no family loyalty to the answers it grades.",
        },
      ],
    },
    {
      type: "heading",
      text: "The three biases that fool judges",
    },
    {
      type: "list",
      items: [
        "**Position bias:** when comparing two answers, judges systematically favor whichever came first (or, for some models, second). Mitigation: run each comparison **both ways** and only count it if the verdict is consistent, or randomize order across the suite.",
        "**Verbosity bias:** judges reward longer, more elaborate answers even when a short one is more correct. Mitigation: anchor the rubric explicitly on correctness and relevance, and penalize padding; consider length-controlled comparisons.",
        "**Self-preference bias:** a judge tends to prefer outputs generated by itself or its own model family. Mitigation: use a different model — ideally a different **provider** — as judge than the one under test where feasible (judge a Claude agent with `gpt-5.4-mini`, an OpenAI agent with `claude-haiku-4-5`), and keep humans in the sampling loop to catch drift.",
      ],
    },
    {
      type: "callout",
      kind: "tip",
      title: "Prefer pairwise over absolute scores",
      text: "Asking a model 'rate this 1–10' produces mushy, drifty numbers — a 7 today is an 8 next week. Asking 'which of these two is better, A or B?' is far more stable and reliable. Pairwise comparison is the workhorse of honest LLM evaluation. Reserve absolute scores for coarse pass/fail gates, not fine ranking.",
    },
    {
      type: "code",
      language: "python",
      title: "pairwise comparison with position-bias control",
      code: `import random

def pairwise(judge_call, prompt: str, answer_a: str, answer_b: str) -> str:
    \"\"\"Return 'A', 'B', or 'tie', controlling for position bias.\"\"\"
    # Run once in each order; the labels A/B track the ORIGINAL answers.
    order1 = judge_call(prompt, first=answer_a, second=answer_b)   # -> 'first'/'second'
    order2 = judge_call(prompt, first=answer_b, second=answer_a)

    # Translate each verdict back to the original answer it points at.
    pick1 = "A" if order1 == "first" else "B"
    pick2 = "A" if order2 == "second" else "B"

    if pick1 == pick2:
        return pick1                 # consistent across orders — trustworthy
    return "tie"                     # flipped with position — treat as no signal

def win_rate(cases, judge_call, candidate, baseline) -> float:
    wins = ties = 0
    for c in cases:
        # Randomize which is presented first at the suite level too.
        a, b = candidate[c], baseline[c]
        verdict = pairwise(judge_call, c.prompt, a, b)
        if verdict == "A":
            wins += 1
        elif verdict == "tie":
            ties += 1
    # Ties count as half; a fair coin lands near 0.5.
    return (wins + 0.5 * ties) / len(cases)`,
      explanation:
        "The core trick: present each pair in both orders and only count a decisive verdict when the judge picks the **same original answer** regardless of position. If flipping the order flips the answer, the judge was reacting to position, not quality — so you score it a tie. A candidate prompt that clears ~0.55+ win rate against your baseline across a decent-sized set is real signal; hovering at 0.5 is not.",
    },
    {
      type: "heading",
      text: "Rubric design: the real work of judge quality",
    },
    {
      type: "paragraph",
      text: "Most judge failures trace back to a vague rubric, not a weak model. 'Rate the helpfulness of this response, 1–10' looks like an instruction but functions as an inkblot — the judge (and every human labeler) projects their own definition of 'helpful' onto the number, so two runs, two models, or two humans can disagree not because the answer is ambiguous but because the **question** is. The fix is decomposition: break a holistic quality into a handful of narrow, independently checkable criteria, each phrased as something closer to yes/no than a scale — 'does the response answer the literal question asked?', 'does it name a concrete next step?', 'does it avoid asserting anything not present in the provided context?' — and combine the per-criterion verdicts into a final score with an explicit rule, rather than asking one model call to hold the whole judgment in its head at once. Anchor each criterion with one real pass example and one real fail example pulled from your own data; abstract descriptions ('be helpful') anchor nothing. Treat the rubric itself as a versioned artifact — check it into source control next to the eval code, and any edit to it is a new instrument that needs re-calibration, exactly like a code change needs new tests.",
    },
    {
      type: "code",
      language: "python",
      title: "a decomposed rubric beats a holistic score",
      provider: "claude",
      code: `# Holistic — mushy, drifts, disagreement is unexplainable:
BAD_RUBRIC = "You are an expert evaluator. Rate helpfulness from 1 to 10."

# Decomposed — each field is independently checkable and debuggable:
GOOD_RUBRIC = """You are grading a customer-support reply against three
criteria. Answer each independently as true/false, citing the exact
sentence that supports your answer.

1. answers_question: Does the reply directly address what the customer
   asked, without dodging into unrelated information?
2. names_next_step: Does the reply tell the customer what happens next
   or what they should do?
3. no_unsupported_claims: Does the reply avoid stating any policy, price,
   or fact not present in the provided account/policy context?

A reply "passes" only if all three are true."""

def run_decomposed_judge(reply: str, context: str) -> dict:
    resp = client.messages.create(
        model="claude-haiku-4-5", max_tokens=512,
        tools=[{
            "name": "record_criteria",
            "description": "Record the three-criteria verdict.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "answers_question": {"type": "boolean"},
                    "names_next_step": {"type": "boolean"},
                    "no_unsupported_claims": {"type": "boolean"},
                    "evidence": {"type": "string"},
                },
                "required": ["answers_question", "names_next_step",
                            "no_unsupported_claims", "evidence"],
            },
        }],
        tool_choice={"type": "tool", "name": "record_criteria"},
        system=GOOD_RUBRIC,
        messages=[{"role": "user",
                   "content": f"Context:\\n{context}\\n\\nReply:\\n{reply}"}],
    )
    block = next(b for b in resp.content if b.type == "tool_use")
    verdict = block.input
    verdict["pass"] = all(verdict[k] for k in
                          ("answers_question", "names_next_step",
                           "no_unsupported_claims"))
    return verdict`,
      explanation:
        "The `evidence` field is not decoration — forcing the judge to cite the sentence it's grading on makes disagreements auditable: when a human reviewer disputes a verdict, they check the cited evidence instead of re-litigating a fuzzy 1–10 impression. Notice each criterion is small enough that a human could grade it the same way every time — that's the bar a rubric criterion should clear before you trust a model to grade it.",
      variants: [
        {
          provider: "openai",
          code: `import json

# Holistic — mushy, drifts, disagreement is unexplainable:
BAD_RUBRIC = "You are an expert evaluator. Rate helpfulness from 1 to 10."

# Decomposed — each field is independently checkable and debuggable:
GOOD_RUBRIC = """You are grading a customer-support reply against three
criteria. Answer each independently as true/false, citing the exact
sentence that supports your answer.

1. answers_question: Does the reply directly address what the customer
   asked, without dodging into unrelated information?
2. names_next_step: Does the reply tell the customer what happens next
   or what they should do?
3. no_unsupported_claims: Does the reply avoid stating any policy, price,
   or fact not present in the provided account/policy context?

A reply "passes" only if all three are true."""

CRITERIA_SCHEMA = {
    "type": "object",
    "properties": {
        "answers_question": {"type": "boolean"},
        "names_next_step": {"type": "boolean"},
        "no_unsupported_claims": {"type": "boolean"},
        "evidence": {"type": "string"},
    },
    "required": ["answers_question", "names_next_step",
                 "no_unsupported_claims", "evidence"],
    "additionalProperties": False,
}

def run_decomposed_judge(reply: str, context: str) -> dict:
    resp = client.responses.create(
        model="gpt-5.4-mini",
        instructions=GOOD_RUBRIC,
        input=[{"role": "user",
                "content": f"Context:\\n{context}\\n\\nReply:\\n{reply}"}],
        text={"format": {"type": "json_schema", "name": "criteria",
                         "schema": CRITERIA_SCHEMA, "strict": True}},
    )
    verdict = json.loads(resp.output_text)
    verdict["pass"] = all(verdict[k] for k in
                          ("answers_question", "names_next_step",
                           "no_unsupported_claims"))
    return verdict`,
          explanation:
            "Identical rubric, identical combination rule — only the structured-verdict plumbing differs: `strict: True` on the `text.format` JSON schema plays the role the forced tool call plays on the Claude tab. That's the takeaway of seeing both: rubric design is provider-portable; only the last mile of verdict extraction is SDK-specific.",
        },
      ],
    },
    {
      type: "heading",
      text: "Judge ensembles: when they earn their cost",
    },
    {
      type: "paragraph",
      text: "A single judge call is a single point of failure in your test suite — one model's idiosyncratic blind spot can flip a verdict. An **ensemble** (the same rubric run across multiple model families, or the same call sampled multiple times, combined by majority vote or median) reduces that variance, but it multiplies cost and latency roughly linearly with ensemble size, so it's not a default. Reach for an ensemble where a **single wrong verdict has outsized consequence**: gating a merge, triggering an autonomous refund, or picking which of two prompts ships to 100% of traffic. Skip it for aggregate trend tracking over dozens or hundreds of cases — a nightly dashboard tracking a pass rate across 200 cases already averages out single-judge noise across the batch, and the same budget is almost always better spent widening the sample (more cases) than deepening the vote (more judges per case), for the statistical reason Lesson 3 makes precise: at small n, per-item noise dominates, and more independent items shrinks the noise faster than more opinions on the same item.",
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "Your team's entire judge rubric is: 'You are an expert evaluator. Rate the response's helpfulness from 1 to 10.' Judge-human agreement on your 40-example calibration set comes back at 61%. Before touching the judge model or trying a bigger model as judge, what's the first thing to fix, and how?",
      answer:
        "The rubric, not the model. A single holistic scale on an undefined term is the rubric-drift failure mode by construction: 'helpful' means something different to every grader, human or model, so 61% agreement is measuring **disagreement about the definition**, not a weak judge. Swapping in a bigger or better model won't fix that — it'll just produce a different, equally ungrounded projection of 'helpful' onto the same 1–10 scale. The fix: decompose the single question into 3–5 concrete, narrow criteria specific to what 'helpful' means for this task (does it answer the literal question, does it name a next step, does it avoid inventing facts), anchor each with one real pass and one real fail example from your own data, force a structured per-criterion verdict, and combine them with an explicit rule (e.g., pass only if all criteria are true). Re-run the same calibration set. Expect agreement to jump — not because the model got smarter, but because the humans and the model are now answering the same narrow, checkable question instead of each silently supplying their own definition of the vague one.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"Walk me through building a judge for 'is this response appropriately empathetic' from scratch — rubric to production.\"",
      answer:
        "Six steps, in order. **(1) Decompose the construct**: 'empathetic' isn't gradable as one number, so break it into checkable sub-criteria — acknowledges the customer's stated problem, avoids dismissive or robotic phrasing, offers a concrete next step, matches the severity of the customer's tone. **(2) Anchor each criterion** with one real pass and one real fail example pulled from actual transcripts, not invented ones. **(3) Hand-label a calibration set** of 30–50 items spanning the difficulty spectrum, deliberately including boundary cases, ideally with a second human labeling a subset to check inter-rater agreement before blaming the judge for anything. **(4) Implement a forced-schema verdict**, one boolean field per criterion plus a cited-evidence field, measure judge-human agreement, and iterate the rubric — not the model — until it clears your bar (commonly ~85%+). **(5) Decide ensemble vs. single judge based on stakes**: is this gating an autonomous customer-facing response, or feeding a dashboard metric someone reviews weekly? **(6) Operationalize**: pin the judge's model version, keep a canary set of known pass/fail transcripts to catch silent drift if the underlying model updates, and put the rubric under version control so every edit is a tracked, re-calibrated change. **Follow-up probe:** \"agreement plateaus at 78% no matter how much you refine the rubric — now what?\" → check inter-rater agreement among the humans themselves first; if two people who hand-labeled the same items only agree ~80% of the time, the ceiling isn't the judge, it's that 'empathetic' is inherently fuzzy at this resolution — either coarsen the criterion into something less ambiguous or accept a lower bar paired with mandatory human sampling specifically on the disagreement zone.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "When would you spend the extra cost on a judge ensemble instead of a single judge call?"',
      answer:
        "Frame it as a cost-vs-consequence trade, with numbers. A 3-way ensemble (say, two different model families plus a reversed-order rerun) costs roughly 3x a single call. That's worth it when a **single flipped verdict has outsized, hard-to-reverse consequence** — gating a merge to production, authorizing an autonomous refund, or picking which of two prompt candidates ships to all traffic. It is not worth it for a nightly dashboard aggregating a pass rate across hundreds of cases, because independent per-case judge noise already washes out in a large-enough mean, and the same 3x budget almost always buys more signal spent on **more cases** than on **more votes per case** — which is the same statistical logic behind why a suite of 200 items beats a suite of 50 items voted on three times each. Rule of thumb: ensemble at the point of a high-stakes, low-volume gate; widen the sample at the point of a low-stakes, high-volume trend. **Follow-up probe:** \"your 3-judge ensemble splits 2-1 on a case — what do you do?\" → don't quietly take the majority as ground truth. Log the split explicitly and route it to human review — a divided vote is precisely the population most likely to be genuinely ambiguous, and averaging over the disagreement hides exactly the information you built the ensemble to surface.",
    },
    {
      type: "keypoints",
      points: [
        "Use an LLM judge only for genuinely subjective qualities — faithfulness, helpfulness, tone.",
        "Validate the judge against human labels (~30+ examples) and report agreement before trusting it; target a bar you set in advance.",
        "Position, verbosity, and self-preference are the three biases that will fool you.",
        "Randomize/flip order to beat position bias; anchor the rubric to beat verbosity; cross-model + human sampling for self-preference.",
        "Pairwise comparison beats absolute 1–10 scoring for stability; count ties as half.",
        "Any rubric edit re-invalidates the judge — re-measure agreement.",
        "Decompose holistic rubrics into narrow, anchored, independently checkable criteria — most 'weak judge' problems are actually vague-rubric problems.",
        "Ensembles reduce single-judge variance but cost linearly more; reserve them for high-stakes single verdicts, and spend budget on more items instead for aggregate trend tracking.",
      ],
    },
  ],
};
