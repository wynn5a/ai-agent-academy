import type { QuizQuestion } from "@/lib/types";

export const quiz07: QuizQuestion[] = [
  {
    question:
      "How should you structure the eval pyramid for a customer-support agent?",
    options: [
      "Everything goes through an LLM judge, since support quality is subjective",
      "Deterministic assertions for checkable behavior (right tool, valid JSON, refund-limit routing), a validated LLM judge for faithfulness/tone, and sampled human review for the subtle cases and judge drift",
      "Only human review, because customers deserve human judgment",
      "A single 1–10 quality score from a model, averaged across all cases",
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
      "Validate by asking the judge to rate its own confidence",
      "Run it twice and check it agrees with itself",
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
      "Recency bias → shorten prompts; anchoring bias → raise temperature; halo bias → use JSON mode",
      "Cost bias → cache the judge; latency bias → stream; token bias → truncate",
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
      "Per-step correctness is only for debugging; task success is the only real metric",
      "A large gap reveals fragile recoveries: high task success with low per-step correctness means the agent is limping to the finish on lucky recoveries that break under distribution shift",
      "Task success is cheaper to compute, so per-step is optional",
    ],
    correct: 2,
    explanation:
      "Task success can hide many wrong first steps the agent recovered from — expensive, slow, and fragile. The recovery gap (task rate minus per-step rate) tells you whether success is robust or lucky.",
  },
  {
    question:
      "Explain the lethal trifecta and apply it to an email-assistant agent.",
    options: [
      "It's three prompt-engineering tricks; apply all three to the email agent for best results",
      "Private-data access + untrusted-content exposure + external communication = exfiltration risk; the email agent has all three (reads inbox, reads incoming mail, can send), so cut a leg — e.g., require human approval to send",
      "It's the three most expensive model calls; batch them to save cost",
      "It refers to temperature, top_p, and max_tokens misconfiguration",
    ],
    correct: 1,
    explanation:
      "Willison's trifecta: with private data + untrusted content + external comms, an injected instruction can read secrets and send them out. The email assistant has all three; removing autonomous send (HITL approval) collapses the catastrophic case.",
  },
  {
    question:
      "Why is 'just filter the input for injection phrases' insufficient, and what's the layered alternative?",
    options: [
      "It's actually sufficient if the blocklist is long enough",
      "Attacks come in infinite paraphrases, other languages, encodings, and markdown-image exfil, so a blocklist is a speed bump; the alternative is defense in depth: privilege separation, input demarcation, output filtering, and HITL for consequential actions",
      "Filtering is fine but slow; cache the filter results",
      "Replace filtering with a stronger model that can't be injected",
    ],
    correct: 1,
    explanation:
      "No filter catches every paraphrase, encoding, or split-across-documents attack. Defense in depth assumes the model will be fooled and limits blast radius: least privilege, fenced untrusted content, output/action scanning, and human approval as the backstop.",
  },
  {
    question:
      "What makes a good HITL approval UX — what does the approver need to decide in ten seconds?",
    options: [
      "The full model transcript and all system prompts",
      "Just a yes/no button; context slows people down",
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
      "Turn off tracing to reduce overhead",
      "Since traffic is flat, cost-per-run rose; slice per-span to find the culprit — cache misses re-billing the prefix, extra loop turns from an erroring tool, ballooning output tokens, or one heavy user",
      "Retry every failed run to smooth out the average",
    ],
    correct: 2,
    explanation:
      "Flat traffic means cost-per-run climbed. Traces let you slice per span: input-token jumps point to cache misses or bloated retrieval; more turns per trace point to tool errors and retries; output growth points to verbosity or a raised cap; a single dominating user points to abuse or a pathological input.",
  },
  {
    question: "What belongs in a prompt-change CI pipeline?",
    options: [
      "Only a manual eyeball check before merge",
      "Deterministic suite on every commit, judged suite on prompt/tool/model changes, a cost-budget check, pinned model versions, and a diff-friendly PR report — with a non-zero exit gating the merge",
      "Just the judged suite, since assertions are trivial",
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
      "Default to approve, so the agent stays productive",
      "Retry the action automatically",
      "Escalate by executing with reduced permissions",
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
      "Delete old cases once they pass to keep the suite fast",
    ],
    correct: 1,
    explanation:
      "No test, no fix: capture each fixed failure as a minimal case that fails on old behavior and passes on new. The accreted suite runs on every change to prompts/tools/model and gates the merge — never delete passing cases; they're your regression net.",
  },
  {
    question:
      "What are the essential elements of a blameless postmortem for an agent failure?",
    options: [
      "The name of whoever wrote the prompt and a plan to review their work",
      "A one-line apology and a promise to be more careful",
      "Timeline, root cause (not symptom), detection gap, fix, and the regression test that now makes recurrence catchable — framed as a system property, not a person's fault",
      "A full transcript with no analysis, so readers draw their own conclusions",
    ],
    correct: 2,
    explanation:
      "Blameless means the failure is a system property. The durable artifact states the timeline, the real root cause, why detection lagged, the fix, and — crucially — the regression test that guarantees the failure can't silently return. Honesty over cleanliness.",
  },
];
