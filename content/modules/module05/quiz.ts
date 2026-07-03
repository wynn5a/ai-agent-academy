import type { QuizQuestion } from "@/lib/types";

export const quiz05: QuizQuestion[] = [
  {
    question:
      "What does LangGraph's checkpointer enable that a bare while-loop doesn't? (Pick the answer naming all three.)",
    options: [
      "Faster model inference, lower token prices, and automatic prompt optimization",
      "Resume after a crash, time-travel inspection of past states, and durable human-in-the-loop pauses",
      "Automatic parallelism, built-in web search, and self-improving prompts",
      "Guaranteed determinism, unlimited context windows, and free retries",
    ],
    correct: 1,
    explanation:
      "The checkpointer persists full graph state after every step, keyed by thread_id. That one mechanism yields all three: resume (continue a killed run without re-executing completed steps), time-travel (inspect/fork from any historical checkpoint), and durable HITL (the graph pauses in storage, not in a blocked process). A bare loop keeps state in process memory — kill it and everything is gone.",
  },
  {
    question:
      "What is the structural difference between orchestrator-workers and handoffs?",
    options: [
      "Orchestrator-workers uses one model for everything; handoffs require different model providers",
      "Handoffs are faster because they skip the planner",
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
      "90% — reliability is determined by the weakest stage, not the chain",
      "~98% — stages cross-check each other, so reliability improves with depth",
      "~59% — but retries make the number irrelevant in practice",
    ],
    correct: 0,
    explanation:
      "Independent sequential stages multiply: 0.9^5 ≈ 0.59. And probability understates it — errors compound in *content*: stage 2's subtly-wrong output becomes stage 3's trusted input. This is the core quantitative argument for skepticism about long agent chains, and why each added boundary must earn its place.",
  },
  {
    question:
      "Which of these is a legitimate technical justification for splitting into multiple agents?",
    options: [
      "Separation of concerns — each agent's code is cleaner in its own file",
      "Each worker needs a clean, isolated context window because accumulated history degrades the monolithic agent's attention",
      "The architecture diagram maps nicely onto the human team's org chart",
      "More agents means more total intelligence applied to the problem",
    ],
    correct: 1,
    explanation:
      'The three legitimate reasons: context isolation (clean per-worker windows), true parallelism (independent I/O-bound subtasks), and distinct tools/permissions per role (blast-radius control). "Separation of concerns" is achievable with code organization — it doesn\'t require runtime handoffs. Org-chart mimicry and "more agents = smarter" are the classic anti-patterns.',
  },
  {
    question:
      "What should a handoff payload contain, and why is passing the full conversation history usually wrong?",
    options: [
      "Just the task in one sentence — receivers should figure out the rest",
      "The full history, because more context always improves model output",
      "Whatever fits in the context window, oldest first",
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
      "The node blocks on input() until a human types at the server's terminal",
      "The node signals an interrupt: state is checkpointed, execution stops, and invoke() returns with the pending interrupt; later, any process resumes the same thread_id passing the human's response, and the node continues with that value",
      "The graph emails the human and polls an inbox every 30 seconds inside the node",
      "LangGraph spins up a web UI automatically and pauses the Python GIL",
    ],
    correct: 1,
    explanation:
      "The interrupt reuses the resume machinery: checkpoint → stop → return control to the caller. Because state is durable, the process can exit entirely; the approval can arrive days later from a different process that resumes the same thread with the human's value injected. One subtlety: the interrupted node re-runs from its top on resume, so pre-interrupt code should be idempotent.",
  },
  {
    question:
      "Your critic agent approves every draft, so the revision loop never fires. What's the most likely diagnosis and fix?",
    options: [
      "The model is too small — swap in the largest available model",
      "Critics are inherently useless — remove the loop",
      'The critic\'s prompt asks a vague "is this good?" and it lacks a rubric and the original requirements — give it a concrete checklist, the plan/question in its brief, and require per-item grades with quoted evidence',
      "The temperature is too low — raise it so the critic gets more opinionated",
    ],
    correct: 2,
    explanation:
      "Models are sycophantic under vague evaluation prompts. The fix is structural: a concrete rubric (\"every claim cited? every planned subtask addressed?\"), access to the original requirements (a critic that sees only the draft can't check coverage), per-item pass/fail grading, and required quotes of failing passages. Bigger models and higher temperature don't fix a briefing/prompting bug.",
  },
  {
    question:
      "Why can a worker agent with a clean 5k-token context outperform a single agent carrying 100k tokens of accumulated history on the same subtask?",
    options: [
      "Smaller contexts are billed at a discount, so the provider allocates better hardware",
      "It can't — more context always helps",
      "The 5k worker uses a different, faster model automatically",
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
      "Count the agents; more than three is always too many",
      "Ask the model whether it prefers working alone",
      "Check GitHub stars of the framework you used",
    ],
    correct: 0,
    explanation:
      "The measurement discipline: same questions through both architectures, compare quality (judge + rubric), total cost (summing every agent's tokens including the orchestrator), and latency. The handoff log adds qualitative signals — boundaries that add no information, or context being expensively reconstructed on the far side of each split.",
  },
  {
    question:
      "In a LangGraph state schema, two parallel searcher nodes both write to a `findings: list[str]` field. What must you do to avoid one update clobbering the other?",
    options: [
      "Run the searchers sequentially — parallel writes are impossible",
      "Annotate the field with a reducer, e.g. `Annotated[list[str], operator.add]`, so LangGraph merges concurrent updates by appending instead of replacing",
      "Have each searcher write to the same string field with a lock",
      "Use global variables instead of graph state",
    ],
    correct: 1,
    explanation:
      "Un-annotated state fields use last-write-wins replacement — fine for `draft`, wrong for accumulating results. A reducer declared via `Annotated[type, reducer]` tells LangGraph how to merge concurrent updates; `operator.add` on lists appends. This is the map-reduce backbone of the fan-out pattern in Lab 05.",
  },
  {
    question:
      "What is the correct way to route after a critic node in LangGraph, including loop safety?",
    options: [
      "Have the critic node call the writer node directly as a Python function",
      "Use a fixed edge back to the writer — the model will know when to stop",
      "Raise an exception in the critic to escape the graph when done",
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
      "It doesn't matter — any baseline shows due diligence",
      "The baseline should use a weaker model so the multi-agent system looks good in the README",
      "Same tools are needed only to keep the code DRY; comparisons can't really lie",
    ],
    correct: 0,
    explanation:
      "A fair comparison isolates the one variable you're testing: architecture. Same model, same tools, same 10 questions. The classic cheat (often accidental) is summing only the worker agents' tokens — the planner, critic, and every handoff's re-sent context are real costs. And if the single agent wins, the honest conclusion belongs in the README; that honesty is the portfolio signal.",
  },
];
