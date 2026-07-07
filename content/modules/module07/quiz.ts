import type { QuizQuestion } from "@/lib/types";

export const quiz07: QuizQuestion[] = [
  {
    question:
      "How should you structure the eval pyramid for a customer-support agent?",
    options: [
      "Everything goes through an LLM judge, since support quality is subjective — deterministic assertions can't capture tone or empathy, so one well-prompted judge scoring every case end to end is the most consistent single instrument",
      "Deterministic assertions for checkable behavior (right tool, valid JSON, refund-limit routing), a validated LLM judge for faithfulness/tone, and sampled human review for the subtle cases and judge drift",
      "Only human review, because customers deserve human judgment",
      "A single 1–10 quality score from a frontier model, averaged across all cases — one holistic number is easier to trend across releases than juggling separate assertion, judge, and human-review results",
    ],
    correct: 1,
    explanation:
      "Push each judgment as far down the pyramid as it honestly goes: assert what's checkable (tool routing, JSON validity, refund-limit enforcement), judge only genuinely subjective qualities with a validated judge, and sample humans for the rest and to catch judge drift.",
  },
  {
    question:
      "Why must an LLM judge be validated before you trust it, and how concretely?",
    options: [
      "It doesn't need validation if you use a frontier model",
      "Because an unvalidated judge may be confidently noisy; validate by hand-labeling ~30+ examples, running the judge on them, computing judge-human agreement, and tuning the rubric until it clears a bar you set in advance",
      "Validate by asking the judge to rate its own confidence on each verdict and discarding the low-confidence ones; a frontier model's self-reported certainty is a reliable stand-in for measured agreement with human graders, so no hand-labeling is needed",
      "Run the judge twice on the same examples and check that it agrees with itself; high self-consistency across reruns proves the rubric is unambiguous, which is the property validation is really measuring",
    ],
    correct: 1,
    explanation:
      "A judge that agrees with humans only 60% of the time produces confidently wrong scores. You measure agreement against human labels and only promote the judge once it clears a preset bar (many teams target ~85%+). Any later rubric edit re-invalidates it.",
  },
  {
    question:
      "Which set correctly names three LLM-judge biases and a valid mitigation for each?",
    options: [
      "Position bias → run comparisons in both orders and require consistency; verbosity bias → anchor the rubric on correctness/relevance; self-preference bias → use a different model as judge plus human sampling",
      "Recency bias → shorten the prompt so nothing important falls out of the window; anchoring bias → raise the temperature so the judge samples more diverse verdicts; halo bias → force JSON mode so structure keeps the score honest",
      "Cost bias → cache the judge's verdicts by input hash; latency bias → stream the judge's reasoning; token bias → truncate long answers before grading so length can't sway the score",
      "There are no reliable biases in LLM judges; they are objective",
    ],
    correct: 0,
    explanation:
      "The three classic biases are position (favoring order), verbosity (favoring length), and self-preference (favoring one's own family). Flip/randomize order, anchor the rubric to correctness, and use a cross-model judge plus human sampling.",
  },
  {
    question: "Why track both task success rate and per-step correctness?",
    options: [
      "They're the same metric measured twice for reliability",
      "Per-step correctness is only a debugging aid; task success is the metric users actually experience, so once task success is high you can stop collecting per-step data to save tracing overhead and dashboard noise",
      "A large gap reveals fragile recoveries: high task success with low per-step correctness means the agent is limping to the finish on lucky recoveries that break under distribution shift",
      "Task success is cheaper to compute at scale, so per-step correctness is optional — reserve it for the small subset of runs that fail outright, where the failing step is worth localizing",
    ],
    correct: 2,
    explanation:
      "Task success can hide many wrong first steps the agent recovered from — expensive, slow, and fragile. The recovery gap (task rate minus per-step rate) tells you whether success is robust or lucky.",
  },
  {
    question:
      "Explain the lethal trifecta and apply it to an email-assistant agent.",
    options: [
      "It's three prompt-engineering techniques — role assignment, few-shot examples, and chain-of-thought reasoning — and the email agent should layer all three in its system prompt so the model reliably separates content to process from commands to obey",
      "Private-data access + untrusted-content exposure + external communication = exfiltration risk; the email agent has all three (reads inbox, reads incoming mail, can send), so cut a leg — e.g., require human approval to send",
      "It's the three most expensive model calls; batch them to save cost",
      "It refers to misconfiguring temperature, top_p, and max_tokens at once; the email agent should pin all three to conservative defaults so sampling variance can never produce a harmful send",
    ],
    correct: 1,
    explanation:
      "Willison's trifecta: with private data + untrusted content + external comms, an injected instruction can read secrets and send them out. The email assistant has all three; removing autonomous send (HITL approval) collapses the catastrophic case.",
  },
  {
    question:
      "Why is 'just filter the input for injection phrases' insufficient, and what's the layered alternative?",
    options: [
      "It's actually sufficient if the blocklist is maintained well — keep a regularly updated list of known injection phrases across major languages, encodings, and paraphrases, run it on every fetched document before it enters context, and coverage converges toward complete over time",
      "Attacks come in infinite paraphrases, other languages, encodings, and markdown-image exfil, so a blocklist is a speed bump; the alternative is defense in depth: privilege separation, input demarcation, output filtering, and HITL for consequential actions",
      "Filtering is fine but slow; cache the filter results",
      "Replace filtering with a frontier model as the agent, since larger models are specifically trained to ignore embedded instructions and therefore can't be injected the way smaller open-weights models can",
    ],
    correct: 1,
    explanation:
      "No filter catches every paraphrase, encoding, or split-across-documents attack. Defense in depth assumes the model will be fooled and limits blast radius: least privilege, fenced untrusted content, output/action scanning, and human approval as the backstop.",
  },
  {
    question:
      "What makes a good HITL approval UX — what does the approver need to decide in ten seconds?",
    options: [
      "The full model transcript, every system prompt, and all intermediate tool results, since an approver can't make a genuinely informed call without the complete context the model saw",
      "Just an approve/reject button with no other context, because any detail you surface slows the human down and the entire point of a ten-second gate is speed",
      "The raw token counts and latency of every prior span",
      "The action, its target, the reason, and the cost or blast radius — on one line — with a default-reject timeout and an audit log behind it",
    ],
    correct: 3,
    explanation:
      "A ten-second decision needs action, target, reason, and cost/blast radius surfaced compactly. Behind it: append-only audit log and a timeout that fails closed (defaults to reject).",
  },
  {
    question:
      "Your agent's cost doubled week-over-week with flat traffic. Using traces, how do you diagnose it?",
    options: [
      "Assume the provider raised prices and move on",
      "Turn off tracing first, since the observability overhead itself — extra spans, logged tokens, metadata writes on every call — is billed like everything else and is the usual hidden culprit when cost climbs while traffic stays flat",
      "Since traffic is flat, cost-per-run rose; slice per-span to find the culprit — cache misses re-billing the prefix, extra loop turns from an erroring tool, ballooning output tokens, or one heavy user",
      "Retry every failed run and re-average, since transient tool errors inflate apparent cost and a clean re-run establishes the true baseline before any per-span digging is worthwhile",
    ],
    correct: 2,
    explanation:
      "Flat traffic means cost-per-run climbed. Traces let you slice per span: input-token jumps point to cache misses or bloated retrieval; more turns per trace point to tool errors and retries; output growth points to verbosity or a raised cap; a single dominating user points to abuse or a pathological input.",
  },
  {
    question: "What belongs in a prompt-change CI pipeline?",
    options: [
      "Only a manual eyeball check on a few known-good prompts before merge, since judged suites cost real API money per run and prompt diffs are short enough to review carefully by hand",
      "Deterministic suite on every commit, judged suite on prompt/tool/model changes, a cost-budget check, pinned model versions, and a diff-friendly PR report — with a non-zero exit gating the merge",
      "Just the judged suite, since deterministic assertions only catch trivial breakage that code review sees anyway, and judged cases are the only ones sensitive to the subtle behavior shifts a prompt or model change actually causes",
      "Nothing automated; prompts aren't code",
    ],
    correct: 1,
    explanation:
      "Prompts are code. The pipeline runs cheap deterministic checks always, judged checks on behavior-moving changes, enforces a cost budget, pins model versions to separate your change from provider updates, and blocks merge on failure.",
  },
  {
    question:
      "In an HITL gate, what should happen when an approval request times out?",
    options: [
      "Default to reject — fail closed — and record the timeout in the audit log",
      "Default to approve so overnight work isn't blocked, and rely on the append-only audit log to reconstruct and reverse anything harmful after the fact",
      "Retry the action automatically",
      "Escalate by executing with reduced permissions, since a scoped-down version of the action preserves the agent's autonomy while shrinking the blast radius to an acceptable level",
    ],
    correct: 0,
    explanation:
      "Irreversible actions must fail closed. A timeout defaults to reject and is logged; failing open would let unattended requests execute exactly the consequential actions the gate exists to guard.",
  },
  {
    question: "What is the correct discipline for regression testing an agent?",
    options: [
      "Re-run the demo occasionally and eyeball it",
      "Every fixed bug becomes a permanent case in a suite that runs on every prompt, tool, or model change, exiting non-zero to block merges",
      "Only test after a customer complains",
      "Retire cases once they've passed for several consecutive releases — a suite that only grows slows CI, and a bug is unlikely to recur once the prompt that caused it has been rewritten",
    ],
    correct: 1,
    explanation:
      "No test, no fix: capture each fixed failure as a minimal case that fails on old behavior and passes on new. The accreted suite runs on every change to prompts/tools/model and gates the merge — never delete passing cases; they're your regression net.",
  },
  {
    question:
      "What are the essential elements of a blameless postmortem for an agent failure?",
    options: [
      "The name of whoever wrote the prompt, a review plan for their recent changes, and a sign-off step so individual accountability is unambiguous the next time something like this ships",
      "A one-line apology and a promise to be more careful",
      "Timeline, root cause (not symptom), detection gap, fix, and the regression test that now makes recurrence catchable — framed as a system property, not a person's fault",
      "A full unedited transcript of the failing run with no analysis attached, so every reader can draw independent conclusions untainted by the author's framing of events",
    ],
    correct: 2,
    explanation:
      "Blameless means the failure is a system property. The durable artifact states the timeline, the real root cause, why detection lagged, the fix, and — crucially — the regression test that guarantees the failure can't silently return. Honesty over cleanliness.",
  },
  {
    question:
      "Your team tracks a single blended number that averages a fixed regression suite with a capability benchmark. Why is this a mistake, and what should you do instead?",
    options: [
      "It's not a mistake — one number is simpler for stakeholders to track",
      "Regression evals answer 'did we break something that used to work' and capability evals answer 'are we getting better'; blending them into one average can hide a change that raises capability while quietly regressing a previously-fixed case — report the two deltas separately",
      "Drop the capability benchmark entirely: the regression suite encodes every real failure you've ever fixed, so it's strictly more informative, and capability scores mostly track the provider's model updates rather than your own changes",
      "Keep the blended number but run it twice as often and alert on its derivative — with enough repeated samples the noise averages out, and a single trended KPI is easier for stakeholders to act on than two separate deltas",
    ],
    correct: 1,
    explanation:
      "The two evals answer different questions and can move in opposite directions on the same change. A capability win that ships alongside a hidden regression looks fine in a blended average and terrible in production — report both deltas separately and treat any regression as a blocker regardless of the capability delta.",
  },
  {
    question:
      "When is a judge ensemble (multiple judge calls, majority vote) worth its added cost and latency, versus a single judge call?",
    options: [
      "Ensembles should always replace single judges — they're strictly more accurate",
      "Ensembles are worth it where a single flipped verdict has outsized consequence (gating a merge or an autonomous refund); for aggregate trend tracking over many cases, single-judge noise averages out and the budget is better spent on more items",
      "Ensembles are a bootstrap tool for the period before you have a validated rubric — the majority vote across several judge models substitutes for human calibration until judge-human agreement data exists, after which a single validated judge is always the right choice",
      "Ensembles remove the need for human calibration entirely: three independent judges agreeing is stronger evidence than thirty hand-labels, so teams that run ensembles can skip the labeling step",
    ],
    correct: 1,
    explanation:
      "Ensembles cost roughly linearly more per case, so they pay off at high-stakes, low-volume gates where one wrong verdict matters a lot. For a large aggregate suite, per-case judge noise already averages out across the batch, and that budget is usually better spent widening the sample size instead.",
  },
  {
    question:
      "A regression suite improves from 82% to 84% (41/50 → 42/50) after a prompt change. What's the senior response?",
    options: [
      "Ship it immediately — any improvement is good news",
      "Check whether the delta is distinguishable from noise: at n=50 the confidence intervals around 82% and 84% overlap heavily, so look at which specific cases flipped pass/fail (a paired comparison) rather than trusting the aggregate delta, and consider growing the suite before deciding",
      "Revert immediately: any aggregate move under five points is meaningless by definition regardless of suite size, so the only safe policy is an automatic rollback whenever a delta is that small",
      "Set temperature to 0 on the agent and judge to eliminate the variance, then re-measure",
    ],
    correct: 1,
    explanation:
      "At small n, a 2-point move is well within normal re-run noise — current Claude models don't even accept a temperature parameter to try to suppress that noise (a 400 error), so the fix is statistical, not a sampling knob: check confidence intervals, look at paired flips between the two versions, and grow the suite or use k-sample majority voting before trusting a small aggregate delta.",
  },
  {
    question:
      "What's the difference between offline evals and online production monitoring, and why do you need both?",
    options: [
      "They're redundant; whichever is cheaper to run should be kept",
      "Offline evals run a fixed, curated suite before shipping to catch known failure modes; online monitoring (canary sets replayed on a schedule, drift metrics, user-feedback signals treated as weak labels) watches live traffic after shipping to catch drift and unknown-unknowns like a provider-side model update — neither substitutes for the other",
      "Online monitoring replaces offline evals once you have enough production traffic — live users exercise far more inputs than any curated suite ever will, so a mature product can retire its pre-ship suite and rely on drift alerts to catch regressions",
      "Offline evals are for tracking cost and latency budgets under controlled load; online monitoring is where correctness gets measured, since only live traffic reveals whether answers are actually right",
    ],
    correct: 1,
    explanation:
      "Offline evals only answer questions about inputs you anticipated. Online monitoring — canaries, drift metrics, and weak-label user feedback — catches drift on inputs and causes (like a silent provider-side model update) that a fixed pre-ship suite can never see, because it only runs once, before the world kept moving.",
  },
  {
    question:
      "Why is indirect prompt injection considered more dangerous than direct injection, and what defense specifically targets it that input filtering and 'just prompt it not to' do not?",
    options: [
      "Indirect injection is actually less dangerous, because the attacker never interacts with the agent directly and so can't adapt the payload to the agent's responses the way a live attacker probing a chat session can",
      "In indirect injection, the attacker plants instructions in third-party content (a web page, email, or file) that the agent reads on behalf of an unwitting victim, who never sees the attack; because a system-prompt instruction is just more competing text with no mechanical enforcement, the effective defense is structural — e.g. tool gating that disables dangerous tools for the rest of the turn once untrusted content has entered context",
      "Indirect injection only works against open-weights models; frontier hosted models ship instruction-hierarchy training that mechanically guarantees fetched content can never outrank the system prompt",
      "The defense is to increase max_tokens so the model has more room to reason past the injection",
    ],
    correct: 1,
    explanation:
      "Indirect injection is dangerous precisely because the victim has no visibility into the attack — it arrives via content the agent fetches while doing a legitimate task. Since 'never follow embedded instructions' is just another instruction competing for attention, the reliable defense is structural: gate which tools remain callable once tainted content has entered the context, rather than hoping the model resists.",
  },
];
