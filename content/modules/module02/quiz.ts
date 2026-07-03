import type { QuizQuestion } from "@/lib/types";

export const quiz02: QuizQuestion[] = [
  {
    question:
      "Per Anthropic's taxonomy, what distinguishes a workflow from an agent?",
    options: [
      "Workflows use one LLM call; agents use multiple",
      "Workflows can't use tools; agents can",
      "In a workflow, your code defines the path through predefined steps; in an agent, the LLM dynamically directs its own process and tool usage",
      "Agents are always more accurate; workflows are a cost optimization",
    ],
    correct: 2,
    explanation:
      "The line is about who controls the path, not call counts or tools — workflows can make many LLM calls and use tools. Workflows buy predictability, testability, and bounded cost; agents buy flexibility on tasks whose path can't be written down in advance. Example pairing: invoice extraction → workflow; 'find why latency doubled Tuesday' → agent.",
  },
  {
    question:
      "You must translate a 200-page document into 6 languages, and each translation is independent. Which workflow pattern fits best?",
    options: [
      "Parallelization (sectioning) — run the six independent translations concurrently and collect the results",
      "Evaluator-optimizer — critique each translation until it converges",
      "Orchestrator-workers — a lead model decides how to split the work at runtime",
      "Prompt chaining — translate into language 1, then from 1 into 2, and so on",
    ],
    correct: 0,
    explanation:
      "The subtasks are known upfront and independent — the definition of sectioning-style parallelization. Orchestrator-workers is overkill because no runtime decomposition decision is needed (you already know it's one job per language), and chaining through languages would compound translation errors serially.",
  },
  {
    question:
      "What distinguishes orchestrator-workers from plain parallelization?",
    options: [
      "Orchestrator-workers runs sequentially; parallelization runs concurrently",
      "In orchestrator-workers, an LLM decides at runtime how to decompose the task and delegates; in parallelization, your code predefines the independent subtasks",
      "Parallelization requires multiple different models; orchestrator-workers uses one",
      "They are two names for the same pattern",
    ],
    correct: 1,
    explanation:
      "Both may execute subtasks concurrently. The difference is who does the decomposition: parallelization's split is fixed in code (one call per document chapter), while an orchestrator LLM inspects the task and decides the split itself ('update this API across the codebase' → orchestrator finds the affected files, then spawns a worker per file). That runtime decision is what makes it the more agent-like pattern.",
  },
  {
    question:
      "Why is a max-iterations cap insufficient as your only hard termination guard?",
    options: [
      "Because the model can override the cap by requesting more iterations",
      "Because iteration caps make the model stop mid-sentence",
      "Because APIs enforce their own iteration limits anyway",
      "Because iterations aren't the real resource — one iteration with a huge context or a hanging tool can blow the cost or latency budget alone, so you must also bound dollars and wall-clock time",
    ],
    correct: 3,
    explanation:
      "Fifteen cheap iterations and fifteen 200KB-context iterations are wildly different bills; a single 40-second tool call devours a 60s deadline in two iterations. Bound each real resource separately — call count, cumulative cost from `usage`, and elapsed monotonic time — and check them before each LLM call so you never pay for a result you'd discard.",
  },
  {
    question:
      "Your agent keeps calling the same failing tool with the same arguments. Which set of defenses addresses this directly?",
    options: [
      "Raise the temperature so the model tries different arguments",
      "Feed back specific error messages (including what exists instead), enforce a per-tool failure budget that disables the tool after N failures, and short-circuit exact repeats of already-failed (tool, args) calls",
      "Retry the tool with exponential backoff until it succeeds",
      "Remove error handling so the exception stops the loop",
    ],
    correct: 1,
    explanation:
      "These are the three escalating defenses: specific errors give the model something to correct toward; the failure budget converts patience into pressure ('this tool is disabled — try another approach'); repeat detection stops identical retries without even executing. Backoff is for transient API errors, not for a file that will never exist, and higher temperature just randomizes the flailing.",
  },
  {
    question:
      "What is ReAct, and how does modern native tool calling differ from the original technique?",
    options: [
      "ReAct interleaves verbalized reasoning with actions and observations; originally implemented via prompting, stop sequences, and text parsing — native tool calling formalizes the same loop with schema-validated tool_use/tool_result messages instead of regex-parsed text",
      "ReAct is a fine-tuning method that native tool calling replaced with RLHF",
      "ReAct requires multiple cooperating agents; tool calling uses only one",
      "ReAct is the internal name for OpenAI's function-calling API",
    ],
    correct: 0,
    explanation:
      "The 2022 paper showed reason-only prompting hallucinates and act-only prompting is impulsive; interleaving Thought → Action → Observation beat both. The Action/Observation plumbing is now typed API messages, but the behavioral insight survives: models that articulate reasoning before acting choose better tools — worth prompting for explicitly on hard tasks.",
  },
  {
    question:
      "Which trio of techniques keeps context from exploding across a 15-iteration run?",
    options: [
      "Raise max_tokens, lower temperature, and disable streaming",
      "Use a bigger context window, split into two agents, and gzip the messages",
      "Truncate tool outputs at the source (with a note on how to get more), compact old tool results into stubs once the model has used them, and keep the system prompt lean with a stable cached prefix",
      "Delete the system prompt after the first call and drop all assistant turns",
    ],
    correct: 2,
    explanation:
      "Every iteration's output is re-sent and re-billed on all later calls, so unbounded tool outputs are how a capped-iteration agent still blows its budget. Truncation caps the inflow, compaction reclaims space already 'digested' (with a stub saying how to re-fetch), and a stable lean prefix maximizes prompt-cache hits. Deleting the system prompt or assistant turns breaks the conversation's causal structure.",
  },
  {
    question:
      "When does adding an upfront 'plan first' step help, and when does it hurt?",
    options: [
      "It always helps — planning is free because plans are short",
      "It helps on long or coverage-sensitive tasks (roughly >5 tool calls), but hurts short tasks by adding cost, latency, and context weight — and a wrong plan anchors the model unless re-planning is an explicit action",
      "It only helps when using multiple models",
      "It hurts whenever tools are involved, since plans and tools conflict",
    ],
    correct: 1,
    explanation:
      "A plan is an extra LLM call plus permanent context; for a 2–3 tool-call task it's pure overhead. On long tasks it prevents wandering and ensures coverage — but watch for plan drift, where the model follows a stale plan over fresh contradicting observations. The fix is making re-planning a first-class tool call so revisions are visible in the trace.",
  },
  {
    question:
      "What belongs in an agent's trace log, and what's the right format?",
    options: [
      "Only errors and the final answer, stored in a database for compliance",
      "The full message array after every call, pretty-printed for humans",
      "Just cumulative cost, since that's the only thing budgets need",
      "Every LLM call and tool call as one JSONL record each: run id, iteration, timestamp, tokens, cumulative cost, latency, stop_reason, tool name/args, result size, is_error, plus a termination record with reason and complete flag",
    ],
    correct: 3,
    explanation:
      "Debugging an agent means reconstructing what the model saw and chose at each step, so you need the whole path, not just failures. JSONL is append-only (crash-safe), tail-able during live runs, and queryable with jq/pandas. Each field earns its place: token counts find cost spikes, repeated identical args reveal spirals, stop_reason catches silent truncation, and the termination reason is the first thing you check on a bad answer.",
  },
  {
    question:
      "A high-volume task (100k runs/day) currently uses an agent that works. Why argue for converting it to a workflow?",
    options: [
      "At volume, an agent's per-run variance compounds: unpredictable cost and latency multiply by 100k, rare failure modes become daily events, and debugging emergent paths doesn't scale — if the paths the agent takes are actually enumerable, a workflow gives the same output with bounded cost, testable steps, and auditable behavior",
      "Workflows produce more creative answers than agents",
      "Agents can't run more than 1,000 times per day due to API limits",
      "Workflows don't need LLM calls, so they're free at any volume",
    ],
    correct: 0,
    explanation:
      "The senior argument is economic and operational: a working agent at volume is evidence the paths ARE predictable — so mine the trace logs for the common paths and encode them as a routed/chained workflow. You keep the quality, gain fixed cost and latency, and each step becomes unit-testable. Reserve agent fallback for the tail of inputs the workflow can't classify.",
  },
  {
    question:
      "In an evaluator-optimizer loop, what failure mode must you actively defend against?",
    options: [
      "The evaluator and generator deadlocking over API rate limits",
      "The generator refusing to accept any criticism",
      "The generator learning to please the LLM judge rather than meet the actual goal — padding, rubric-echoing, confident hedging — i.e., reward hacking the judge",
      "The evaluator improving the output so much the generator becomes unnecessary",
    ],
    correct: 2,
    explanation:
      "When output is optimized against a judge, the judge's blind spots become the target. Defenses: concrete checkable criteria instead of vague quality scores, deterministic checks (tests, linters, length caps) the generator can't sweet-talk, a held-out judge for final acceptance, and auditing transcripts where scores jumped between rounds. Also cap rounds at 2–3 — returns diminish fast.",
  },
  {
    question:
      "Why add an explicit finish(answer, citations) tool instead of just accepting the model's end_turn text as the final answer?",
    options: [
      "Because the API requires a tool call to end an agent conversation",
      "It forces a structured, complete ending: you get machine-readable citations you can validate (and reject if missing), a clear signal separating 'done' from 'just chatting', and on budget exhaustion you can distinguish a real finish from a best-effort fallback",
      "It reduces token costs because tool calls are cheaper than text",
      "It prevents the model from ever stopping early",
    ],
    correct: 1,
    explanation:
      "With only end_turn, 'the model went quiet' is ambiguous — was that the answer, a clarifying question, or giving up? A finish tool with a required citations field makes endings verifiable: your code can check the cited paths were actually read this run and nudge the model to finish properly if it stops without calling it. It doesn't physically prevent early stopping — that's what the nudge and budget layers are for.",
  },
];
