import type { QuizQuestion } from "@/lib/types";

export const quiz05: QuizQuestion[] = [
  {
    question:
      "What does LangGraph's checkpointer enable that a bare while-loop doesn't? (Pick the answer naming all three.)",
    options: [
      "Automatic retries of failed nodes, transactional rollback of tool side effects, and guaranteed exactly-once execution of side-effecting calls",
      "Resume after a crash, time-travel inspection of past states, and durable human-in-the-loop pauses",
      "Dynamic fan-out of parallel workers, reducer-merged concurrent writes, and typed state validation between nodes",
      "Deterministic replay of model outputs, guaranteed identical results on resume, and free re-execution of failed steps",
    ],
    correct: 1,
    explanation:
      "The checkpointer persists full graph state after every step, keyed by thread_id. That one mechanism yields all three: resume (continue a killed run without re-executing completed steps), time-travel (inspect/fork from any historical checkpoint), and durable HITL (the graph pauses in storage, not in a blocked process). A bare loop keeps state in process memory — kill it and everything is gone.",
  },
  {
    question:
      "What is the structural difference between orchestrator-workers and handoffs?",
    options: [
      "Orchestrator-workers requires a shared reducer-merged state schema, while handoffs can only communicate through message passing with no shared memory at all",
      "Handoffs are the fan-out version of orchestrator-workers: instead of delegating subtasks one at a time, the task is dispatched to several peers in parallel and their results are reducer-merged",
      "In orchestrator-workers, control always returns to a central agent that integrates results; in a handoff, ownership transfers sideways to a peer and doesn't return",
      "They are the same pattern with different names in different frameworks",
    ],
    correct: 2,
    explanation:
      "Orchestrator-workers is hub-and-spokes: a planner decomposes, delegates, and integrates — good for research-style decompose-and-combine tasks. A handoff is peer-to-peer transfer of ownership — good for routing, like triage passing a conversation to a billing specialist that has its own tools and permissions. The control-flow difference (returns to center vs. doesn't) is the structural distinction.",
  },
  {
    question:
      "A pipeline has five sequential agent stages, each 90% reliable. Roughly what is end-to-end reliability, and what makes the practical situation even worse than that number?",
    options: [
      "~59% (0.9^5) — and worse, failed stages feed subtly-wrong content downstream, so later stages build confidently on errors",
      "90% — checkpointing isolates each stage's failures, so the chain inherits the reliability of the weakest single stage rather than multiplying them together",
      "~98% — downstream stages act as critics that catch upstream mistakes, so reliability improves with pipeline depth",
      "~59% (0.9^5) — but wrapping each node in a retry policy restores roughly per-stage reliability end to end, so the multiplication only matters for graphs without retries",
    ],
    correct: 0,
    explanation:
      "Independent sequential stages multiply: 0.9^5 ≈ 0.59. And probability understates it — errors compound in *content*: stage 2's subtly-wrong output becomes stage 3's trusted input. This is the core quantitative argument for skepticism about long agent chains, and why each added boundary must earn its place.",
  },
  {
    question:
      "Which of these is a legitimate technical justification for splitting into multiple agents?",
    options: [
      "Separation of concerns — putting each role behind its own agent boundary keeps prompts and tools cleanly modular, which is worth the runtime handoff cost",
      "Each worker needs a clean, isolated context window because accumulated history degrades the monolithic agent's attention",
      "The architecture diagram maps nicely onto the human team's org chart, so responsibilities stay legible to stakeholders",
      "Adding agents multiplies the reasoning applied to the problem — five specialist perspectives catch more than one generalist pass, the way extra reviewers catch more bugs",
    ],
    correct: 1,
    explanation:
      'The three legitimate reasons: context isolation (clean per-worker windows), true parallelism (independent I/O-bound subtasks), and distinct tools/permissions per role (blast-radius control). "Separation of concerns" is achievable with code organization — it doesn\'t require runtime handoffs. Org-chart mimicry and "more agents = smarter" are the classic anti-patterns.',
  },
  {
    question:
      "What should a handoff payload contain, and why is passing the full conversation history usually wrong?",
    options: [
      "Just the task in one sentence — a capable receiver should re-derive whatever context it needs with its own tool calls",
      "The full conversation history, because the receiver can't know in advance which detail will matter — more context monotonically improves output, and trimming risks deleting the one fact the specialist needs",
      "As much recent history as fits in the receiver's context window, newest first, so the receiver's own attention decides what matters instead of the sender guessing",
      "A structured brief — task, relevant context, constraints, expected output — because full history bloats the receiver's context, buries the task in noise, and leaks irrelevant content across roles",
    ],
    correct: 3,
    explanation:
      "Full transcripts blow the receiver's context budget and dilute attention with irrelevant detail (Module 4's context-pollution problem, exported across a boundary); one-line summaries starve the receiver so it hallucinates gaps. The structured brief is the reliable middle: explicit task, only the needed facts, constraints, and the expected output shape — validated by a schema and logged.",
  },
  {
    question:
      "Mechanically, how does a human-in-the-loop interrupt work in a checkpointed LangGraph?",
    options: [
      "The node blocks on input() while the checkpointer keeps the thread alive, so the graph waits in-process until a human responds",
      "The node signals an interrupt: state is checkpointed, execution stops, and invoke() returns with the pending interrupt; later, any process resumes the same thread_id passing the human's response, and the node continues with that value",
      "The checkpointer registers a webhook with LangGraph's server and holds the node's Python frame suspended in memory until the human's response arrives",
      "compile() pauses the graph before nodes listed in interrupt_before, and resuming requires re-invoking from START because pre-interrupt steps aren't persisted",
    ],
    correct: 1,
    explanation:
      "The interrupt reuses the resume machinery: checkpoint → stop → return control to the caller. Because state is durable, the process can exit entirely; the approval can arrive days later from a different process that resumes the same thread with the human's value injected. One subtlety: the interrupted node re-runs from its top on resume, so pre-interrupt code should be idempotent.",
  },
  {
    question:
      "Your critic agent approves every draft, so the revision loop never fires. What's the most likely diagnosis and fix?",
    options: [
      "The critic needs a stronger model than the writer — an equal-size critic can't reliably find flaws in output from an equally capable model, so swap in the largest available model for the critique role even if it raises cost",
      "The writer and critic share one graph state, so the critic is anchored on the writer's reasoning — split them into separate processes with message passing so the critique is truly independent",
      'The critic\'s prompt asks a vague "is this good?" and it lacks a rubric and the original requirements — give it a concrete checklist, the plan/question in its brief, and require per-item grades with quoted evidence',
      "The critic's sampling is too deterministic — raise the temperature so it explores more critical readings of the draft instead of the agreeable default",
    ],
    correct: 2,
    explanation:
      "Models are sycophantic under vague evaluation prompts. The fix is structural: a concrete rubric (\"every claim cited? every planned subtask addressed?\"), access to the original requirements (a critic that sees only the draft can't check coverage), per-item pass/fail grading, and required quotes of failing passages. Bigger models and higher temperature don't fix a briefing/prompting bug.",
  },
  {
    question:
      "Why can a worker agent with a clean 5k-token context outperform a single agent carrying 100k tokens of accumulated history on the same subtask?",
    options: [
      "The 5k prompt fits in a single attention window and is processed losslessly, whereas 100k contexts get chunked and summarized by the API before the model ever sees them",
      "It can't — the 100k agent strictly dominates the 5k worker: it holds every fact the worker was briefed with plus the full history that produced it, and the model's attention will surface whatever is relevant at the moment it's needed",
      "Frameworks route small-context calls to a faster distilled model automatically, so the worker's speed advantage compounds into a quality advantage",
      "Long contexts full of stale transcripts, dead ends, and tool dumps dilute attention and get old errors treated as facts; the worker's context contains exactly its task and nothing else",
    ],
    correct: 3,
    explanation:
      "This is context isolation — the strongest technical argument for multi-agent. Model quality degrades as context fills with low-relevance material (lost-in-the-middle effects, error propagation from earlier mistakes). A fresh worker briefed with only its subtask attacks that failure mechanism directly. Corollary: if contexts aren't degrading, this justification evaporates.",
  },
  {
    question:
      "How would you detect that a multi-agent system should be collapsed to single-agent?",
    options: [
      "Run a single-agent baseline with the same tools/model/questions; collapse if quality is within noise of baseline while cost/latency are multiples, if handoff logs show payloads that merely restate prior state, or if workers spend turns re-deriving context the monolith would have had",
      "Apply the error-compounding formula: if per-stage reliability raised to your node count falls below 80%, the system is over-split and should collapse regardless of measured output quality",
      "Inspect the graph topology: a graph with more nodes than distinct tool sets, or any cycle in it, is structurally redundant and should be collapsed",
      "Compare per-agent token spend: whenever the orchestrator consumes more tokens than any single worker, coordination overhead has exceeded its value",
    ],
    correct: 0,
    explanation:
      "The measurement discipline: same questions through both architectures, compare quality (judge + rubric), total cost (summing every agent's tokens including the orchestrator), and latency. The handoff log adds qualitative signals — boundaries that add no information, or context being expensively reconstructed on the far side of each split.",
  },
  {
    question:
      "In a LangGraph state schema, two parallel searcher nodes both write to a `findings: list[str]` field. What must you do to avoid one update clobbering the other?",
    options: [
      "Order the searchers with an explicit edge so their writes serialize — graph state is single-writer by design, and concurrent writes to one field are impossible",
      "Annotate the field with a reducer, e.g. `Annotated[list[str], operator.add]`, so LangGraph merges concurrent updates by appending instead of replacing",
      "Wrap each write in a threading.Lock inside the node so the appends are mutually exclusive, as you would for any shared Python list",
      "Move the accumulation out of graph state into a module-level list, which both nodes can share safely since list appends are atomic in CPython",
    ],
    correct: 1,
    explanation:
      "Un-annotated state fields use last-write-wins replacement — fine for `draft`, wrong for accumulating results. A reducer declared via `Annotated[type, reducer]` tells LangGraph how to merge concurrent updates; `operator.add` on lists appends. This is the map-reduce backbone of the fan-out pattern in Lab 05.",
  },
  {
    question:
      "What is the correct way to route after a critic node in LangGraph, including loop safety?",
    options: [
      "Have the critic call the writer's node function directly when revision is needed — plain Python recursion keeps the loop logic where it's easiest to unit-test",
      "Add a fixed edge from critic back to writer and have the critic append APPROVED to its critique when satisfied — LangGraph detects that state has stopped changing between steps and halts the cycle automatically, so no explicit router is needed",
      "Raise a GraphInterrupt from the critic once the draft passes, since exceptions are the supported mechanism for exiting a cycle early",
      "add_conditional_edges with a pure router function that reads state (critique + a revision counter) and returns a label mapped to either the writer or END — with a hard cap on revisions stored in state",
    ],
    correct: 3,
    explanation:
      "Conditional edges take a router (pure function of state → label) and a label→destination map. The revision counter in state is the loop guard — every cycle in a graph needs a hard cap, exactly like the max-iteration guard in a hand-rolled loop. Fixed edges can't branch, and calling nodes directly bypasses state management and checkpointing.",
  },
  {
    question:
      "For Lab 05's baseline comparison, why must the single-agent baseline get the same tools and model as the multi-agent system, and what's the most common way these comparisons lie?",
    options: [
      "Because otherwise you're comparing architecture and capability at once, so the numbers attribute nothing; the common lie is undercounting multi-agent cost by forgetting orchestrator/critic tokens and handoff overhead",
      "A stronger model is the fairer single-agent baseline — the whole point of multi-agent is composing cheaper models, so matching models understates the architecture's advantage and biases the comparison toward the monolith before a single question is run",
      "The baseline should get the same model but fewer tools, since the multi-agent system spreads its tools across roles and no single context could hold all of them at once",
      "Matching tools only matters for reproducibility; the usual way these comparisons lie is judge position bias, which randomizing answer order already corrects",
    ],
    correct: 0,
    explanation:
      "A fair comparison isolates the one variable you're testing: architecture. Same model, same tools, same 10 questions. The classic cheat (often accidental) is summing only the worker agents' tokens — the planner, critic, and every handoff's re-sent context are real costs. And if the single agent wins, the honest conclusion belongs in the README; that honesty is the portfolio signal.",
  },
  {
    question:
      "What is 'prompt opacity' as a framework cost, and why is it distinct from the framework simply being buggy?",
    options: [
      "It means the framework's orchestration internals are closed-source, so you can't tell whether a defect lives in your node or in the execution engine — the debugging-through-layers tax under another name",
      "It means a helper (structured-output wrapper, message formatter) can reshape, append to, or reorder the text actually sent to the model, invisibly to you — you can't fix what you can't see the model receiving, even when the framework has no bugs at all",
      "It names the hidden token cost of framework-injected boilerplate: appended instructions and few-shot examples inflate every call's input tokens, making opaque prompts primarily a billing problem",
      "It only applies to self-hosted open-weight models — hosted APIs like Claude's log every request, so the final prompt is always inspectable in the provider dashboard",
    ],
    correct: 1,
    explanation:
      "Prompt opacity is a structural property of using a framework, not a defect: an abstraction whose whole job is to build your prompt for you may inject formatting instructions, few-shot examples, or schema-repair text you never authored and never see in your source. The mitigation is to enable the framework's debug/callback tracing or, when that's insufficient, wrap the model client yourself so every call funnels through code you control — verify against the wire, not the docs.",
  },
  {
    question:
      "A node with `operator.add` on its `findings` field is wrapped in a framework retry policy. On failure, the whole node re-runs from the top. What's the resulting bug, and why?",
    options: [
      "None — before retrying, LangGraph rolls the thread back to the checkpoint taken before the node started, discarding any partial update from the failed attempt, so automatic retries are always safe to combine with additive reducers and need no idempotency work",
      "The retried attempt runs against a stale snapshot: because the checkpoint predates the node, the retry can't see updates from parallel branches, and the reducer merges against outdated state",
      "Retry policies assume the retried unit is idempotent, but an additive reducer accumulates every attempt — if the node's earlier work succeeded before a later line failed, the retry re-runs the successful part too and appends a duplicate",
      "The graph fails to compile, because retry policies require the default last-write-wins semantics on every field they touch",
    ],
    correct: 2,
    explanation:
      "A retry re-executes the entire node function, with no notion of which line inside it failed. If work before the failure point already produced a result, and the node unconditionally returns a `findings` update at the end, a retry produces a second update that `operator.add` appends without complaint — reducers don't know or care that a call is a retry. The fix is making the node itself idempotent (or isolating the risky sub-step) before turning on automatic retries, not disabling the reducer.",
  },
  {
    question:
      "A node calls a real, side-effecting API (e.g., sends an email) and the process crashes before the checkpoint recording the node's completion is written. On resume, what happens by default, and what's the standard fix?",
    options: [
      "The checkpointer replays the node's recorded return value instead of re-executing it, so the email is not re-sent — deterministic replay is exactly what checkpoints exist to provide",
      "The node re-runs from its top, so the side-effecting call can fire a second time; the fix is a stable idempotency key (derived from thread_id + a fixed business key, not a per-attempt random value) that the downstream system dedupes on — the same discipline as Module 1's tool-calling idempotency, one layer up",
      "Nothing double-fires — the checkpoint write and the node's execution share one transaction, so either both the send and its record happened or neither did, and resume picks the right branch",
      "Resume fails with an error because the pending-writes bookkeeping no longer matches; the fix is deleting the stale checkpoint and re-running the thread from START",
    ],
    correct: 1,
    explanation:
      "The side effect and the checkpoint write are not atomic with each other — the checkpoint only knows what was durably recorded, not what actually happened in the outside world. Resuming re-runs the interrupted/failed node from its top, so a side-effecting call can double-fire. The fix mirrors Module 1: a stable idempotency key the downstream system can dedupe on, plus keeping side-effecting nodes minimal so the redo window is as small as possible.",
  },
  {
    question:
      "For a graph that drafts a payment request, gets human approval, then dispatches it to a payment provider, where should the `interrupt()` for approval go, and why?",
    options: [
      "Immediately before the node that makes the actual payment-provider call — everything reversible (drafting, validating) happens before the gate, so the human approves the smallest, most accurate preview of the one irreversible action",
      "At the very start of the graph, before any drafting — gating later means model-generated content shapes what the human believes they authorized, so approval belongs at the point of maximum leverage",
      "Between drafting and validation, so a rejected draft never wastes validation compute — since the checkpointer durably preserves state at every step either way, exact placement is a performance detail rather than a safety one, so optimize it for latency",
      "Immediately after the payment dispatch, so the human confirms against the provider's actual response rather than a prediction of it",
    ],
    correct: 0,
    explanation:
      "Placement matters: gating too early forces the human to approve something that still has to survive more processing before it matches reality; gating after the irreversible call defeats the purpose entirely. The interrupt belongs immediately before the node whose only job is the guarded side effect, which also minimizes the exactly-once redo window if that node ever has to re-run after resume.",
  },
  {
    question:
      "A baseline comparison shows multi-agent scoring 8.4/10 vs. single-agent's 8.1/10 on an LLM-judge, at 3.5x the cost and 2x the latency. The judge's own agreement with hand-labels is 88%. What's the defensible conclusion?",
    options: [
      "Ship multi-agent — 8.4 beats 8.1 on the primary metric, and cost and latency are engineering problems a later optimization pass (caching, cheaper worker models) can claw back",
      "The cost and latency deltas are real, directly measured; the 0.3-point quality delta is plausibly within the judge's own ~12% disagreement rate with human labels and hasn't been shown to be a real difference — get a confidence interval on the quality gap before treating it as evidence, and lean toward the cheaper single agent absent that evidence",
      "Trust the quality gap over the cost numbers — small-sample token and timing measurements are noisier than an LLM judge that agrees with careful human labels 88% of the time",
      "The comparison is invalid until the judge is rerun at temperature 0, which removes sampling noise and makes the 0.3-point gap trustworthy as it stands",
    ],
    correct: 1,
    explanation:
      "Cost and latency are direct measurements; a 0.3-point gap read off a judge with 88% human agreement can easily be noise, not signal. The evidence-based-escalation discipline applies here too: don't let an unvalidated quality delta justify a large, well-measured cost increase. Get significance (more questions, repeated randomized-order judging) before concluding multi-agent actually wins on quality.",
  },
];
