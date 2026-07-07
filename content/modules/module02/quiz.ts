import type { QuizQuestion } from "@/lib/types";

export const quiz02: QuizQuestion[] = [
  {
    question:
      "Per Anthropic's taxonomy, what distinguishes a workflow from an agent?",
    options: [
      "Workflows are limited to a single LLM call per run, while agents chain multiple calls together — the moment a system makes a second model call it has crossed into agent territory",
      "Workflows can't use tools; agents can",
      "In a workflow, your code defines the path through predefined steps; in an agent, the LLM dynamically directs its own process and tool usage",
      "Agents apply more compute per task, so they are strictly more accurate; a workflow is just the cost-optimized fallback you deploy when you can't afford to run an agent on every request",
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
      "Evaluator-optimizer — pair each translation with a judge that critiques it against a rubric and loops until all six languages converge on quality",
      "Orchestrator-workers — have a lead model inspect the document at runtime, decide how the translation work should be divided, and delegate one worker per language",
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
      "Orchestrator-workers executes its subtasks one at a time so the lead model can inspect each result before delegating the next, while parallelization's whole point is running everything concurrently",
      "In orchestrator-workers, an LLM decides at runtime how to decompose the task and delegates; in parallelization, your code predefines the independent subtasks",
      "Parallelization requires several different models voting on the same task, whereas orchestrator-workers routes all of the work through a single model",
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
      "Because the model can talk its way past it — once the model explains mid-run that it genuinely needs a few more iterations to finish, the harness must either grant them or discard a nearly-complete answer, so the cap is soft in practice",
      "Because iteration caps make the model stop mid-sentence",
      "Because providers already impose a server-side limit on how many tool-use rounds a conversation may contain, so a local cap is redundant — the API ends the loop before your own guard ever fires",
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
      "Raise the temperature and prompt the model to vary its arguments — more sampling randomness means it will eventually stumble onto inputs that work, fixing the spiral without any harness changes",
      "Feed back specific error messages (including what exists instead), enforce a per-tool failure budget that disables the tool after N failures, and short-circuit exact repeats of already-failed (tool, args) calls",
      "Wrap the tool in a retry decorator with exponential backoff and jitter, since tool failures are almost always transient — given enough automatic retries the call eventually succeeds and the model never needs to see the error at all",
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
      "ReAct is a 2022 fine-tuning method that trained models to emit Thought/Action traces; it became obsolete once RLHF-tuned models learned to act directly, which is why modern tool calling drops the reasoning step entirely — verbalizing thoughts before acting no longer improves tool choice",
      "ReAct requires a team of cooperating agents — one to reason, one to act, one to observe — while native tool calling collapses all three roles into a single model",
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
      "Raise max_tokens so long outputs arrive in one call instead of several, lower the temperature to keep responses terse, and disable streaming to cut per-call overhead",
      "Move to a model with a bigger context window so growth stops mattering, split the task across two agents so each history stays half the size, and rely on the provider to prune old turns server-side — context pressure is a capacity problem, not a design problem",
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
      "It always helps — the plan is one short output, so its cost is negligible, and a model with a checklist pinned in context never wanders or misses coverage; a wrong plan costs nothing because the model simply skips steps that don't apply",
      "It helps on long or coverage-sensitive tasks (roughly >5 tool calls), but hurts short tasks by adding cost, latency, and context weight — and a wrong plan anchors the model unless re-planning is an explicit action",
      "It only helps in multi-model setups where a stronger model writes the plan and a cheaper model executes it — with a single model, planning merely duplicates reasoning the model would have done anyway",
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
      "Only errors and the final answer, stored in a database — successful steps are noise, and the runs you will be asked to explain are the ones that failed",
      "The full message array re-dumped after every call, pretty-printed into one JSON file per run — the messages are literally what the model saw, so replaying them beats logging derived numbers like token counts, latency, or stop_reason, which can always be recomputed later",
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
      "Workflows produce higher-quality answers, because each hand-tuned step outperforms decisions the model improvises at runtime",
      "Providers throttle agentic traffic: because each agent run makes an unpredictable number of model calls, rate limits effectively cap agents at about 1,000 runs per day, and only a workflow's fixed call count can be provisioned past that ceiling",
      "Because workflows orchestrate steps through predefined code paths, they barely need the model at all — extraction, validation, and routing become deterministic functions, so converting eliminates most LLM spend outright: at 100k runs/day the API bill collapses to near zero and rate limits stop being a concern, whatever the task's complexity",
    ],
    correct: 0,
    explanation:
      "The senior argument is economic and operational: a working agent at volume is evidence the paths ARE predictable — so mine the trace logs for the common paths and encode them as a routed/chained workflow. You keep the quality, gain fixed cost and latency, and each step becomes unit-testable. Reserve agent fallback for the tail of inputs the workflow can't classify.",
  },
  {
    question:
      "In an evaluator-optimizer loop, what failure mode must you actively defend against?",
    options: [
      "The generator and evaluator deadlocking over API rate limits: the two alternate calls against the same quota, so each round doubles the queue delay until the loop stalls waiting on capacity",
      "The generator refusing to accept any criticism",
      "The generator learning to please the LLM judge rather than meet the actual goal — padding, rubric-echoing, confident hedging — i.e., reward hacking the judge",
      "The evaluator gradually taking over generation — after a few rounds its critiques contain so much corrected text that the generator is just transcribing them, collapsing the loop into a single-model system",
    ],
    correct: 2,
    explanation:
      "When output is optimized against a judge, the judge's blind spots become the target. Defenses: concrete checkable criteria instead of vague quality scores, deterministic checks (tests, linters, length caps) the generator can't sweet-talk, a held-out judge for final acceptance, and auditing transcripts where scores jumped between rounds. Also cap rounds at 2–3 — returns diminish fast.",
  },
  {
    question:
      "Why add an explicit finish(answer, citations) tool instead of just accepting the model's end_turn text as the final answer?",
    options: [
      "Because once tools are in the request, the API only ends an agent conversation cleanly through a tool call — an end_turn from a tool-enabled model is treated as an incomplete response, so a finish tool is mandatory plumbing rather than a design choice",
      "It forces a structured, complete ending: you get machine-readable citations you can validate (and reject if missing), a clear signal separating 'done' from 'just chatting', and on budget exhaustion you can distinguish a real finish from a best-effort fallback",
      "It reduces token costs because tool calls are cheaper than text",
      "It physically prevents premature endings: a model that must call finish cannot leave the loop until your validation accepts its answer, so half-finished responses become structurally impossible",
    ],
    correct: 1,
    explanation:
      "With only end_turn, 'the model went quiet' is ambiguous — was that the answer, a clarifying question, or giving up? A finish tool with a required citations field makes endings verifiable: your code can check the cited paths were actually read this run and nudge the model to finish properly if it stops without calling it. It doesn't physically prevent early stopping — that's what the nudge and budget layers are for.",
  },
  {
    question:
      "An agent loop returns its final answer with `resp.content[0].text`. It works today. Why is this a latent bug, and what's the robust version?",
    options: [
      "It's fine as written — the API guarantees the first content block is always the text answer; thinking and tool_use blocks are appended after it precisely so that existing content[0].text code keeps working across model upgrades and feature launches",
      "content is a list of typed blocks and position is not a contract — enable thinking (or any feature that adds block types) and content[0] stops being text; extract by type: next(b.text for b in resp.content if b.type == 'text')",
      "The risk is only stylistic — iterating the list to find a block by type is slower and wordier than direct indexing, so positional access is the recommended fast path once you know the response shape",
      "content[0] returns the system prompt, not the answer",
    ],
    correct: 1,
    explanation:
      "The block mix changes across models and features — thinking blocks commonly arrive first on thinking-enabled models. Iterating by block type is the same discipline everywhere in the API: tool_use blocks, text blocks, and thinking blocks are found by type, never by position. Positional indexing is how model upgrades break agents that 'worked for months.'",
  },
  {
    question:
      "You add context compaction that rewrites old tool results into stubs before every API call. Context shrinks, but per-run cost goes UP. What happened?",
    options: [
      "Compaction turns input into output: every stubbed message must be re-generated by the model on the next call, and output tokens bill at several times the input rate, so each pass adds expensive output tokens that outweigh the input savings",
      "Each rewritten message is re-tokenized from scratch, and re-tokenization is billed separately from normal input processing",
      "Prompt caching is an exact prefix match — every compaction pass edits early messages, invalidating the cached prefix, so each call re-processes the whole history at full price instead of reading ~90% from cache; compact rarely and in batches on a threshold instead",
      "The stubs backfire: seeing an elision notice makes the model assume the data is lost, so it re-runs the original tools to recover it, and the duplicate calls' fresh results re-inflate both the context and the bill",
    ],
    correct: 2,
    explanation:
      "The proof lives in usage fields: cache_read_input_tokens collapses to ~0 while full-price input_tokens balloons. Tokens saved by stubbing are dwarfed by losing the ~0.1× cache discount on everything else. Batch the rewrites, keep everything after the compaction point byte-stable, and let the cache re-establish — a classic amortization trade.",
  },
  {
    question:
      "What's the correct relationship between telling the model its remaining budget ('~4 tool calls left, start converging') and enforcing the budget in your loop?",
    options: [
      "Telling the model replaces enforcement — frontier models are trained to respect stated budgets, so once the prompt says '~4 calls left' the loop's own check is redundant, and the native task-budget parameter exists precisely so harness-level guards can be deleted",
      "They're complementary: model awareness is advisory (it improves pacing and makes best-effort answers better because the model chooses what to sacrifice), while harness enforcement at the top of the loop is the actual guarantee",
      "Never tell the model — a model that knows its budget rushes to converge, skips verification steps, and produces worse answers than one left to investigate freely until the harness cuts it off",
      "Enforcement is unnecessary if you use a finish tool",
    ],
    correct: 1,
    explanation:
      "An agent told to wrap up may still try one more call — awareness without enforcement is a suggestion. Enforcement without awareness means exhaustion always lands as a surprise mid-investigation, producing worse salvage answers. Newer frontier models formalize the advisory half as a native task-budget countdown; the harness check remains the backstop either way.",
  },
  {
    question:
      "Your loop bails out mid-iteration when the budget trips — right after an assistant response containing tool_use blocks — and the final wrap-up call returns a 400. Why, and what's the fix?",
    options: [
      "Bailing mid-iteration fires two requests back-to-back, and the second one trips the per-minute rate limit — the 400 is throttling, so the fix is a short sleep before the wrap-up call",
      "The wrap-up call switched to a cheaper model mid-conversation, and a message history can't be replayed across model tiers",
      "The history ends with unanswered tool_use blocks, violating the strict tool_use/tool_result pairing; either check the budget at the top of the loop (before paying for a response you'd discard), or append synthetic is_error tool_results ('not executed: budget exhausted') to make the array legal first",
      "best_effort must always start a fresh conversation with no history — the model can't produce a wrap-up answer from a context polluted by tool chatter, and the 400 is the API telling you the conversation has grown too long to continue",
    ],
    correct: 2,
    explanation:
      "Any code path that abandons the loop mid-iteration — budget exits, exception handlers, deadlines — must leave the message array in an API-legal state: every tool_use answered. The top-of-loop check avoids the problem entirely and never pays for a discarded result, which is why it's the canonical placement.",
  },
  {
    question:
      "A user asks about a topic with no matches, search returns an empty list, and the agent confidently summarizes notes that don't exist. What's the highest-leverage fix?",
    options: [
      "Lower the temperature to near zero — hallucination is a sampling artifact of high randomness, so a more deterministic model sticks to the evidence it was given instead of inventing plausible notes from its training data",
      "Add 'do not hallucinate' to the system prompt",
      "Fix the tool: return an explicit absence observation with grounding — 'No results for X. The database contains topics like: A, B, C' — because a model told what does exist stops guessing about what doesn't",
      "Increase max iterations and prompt the model to keep trying query variations — with enough searches it can convince itself the topic is absent and stop guessing",
    ],
    correct: 2,
    explanation:
      "An empty [] gives the model nothing to ground on and nothing forbidding invention — absence of evidence must be made an explicit observation. Telling the model what the corpus actually contains redirects it toward an honest answer (or a better query). This is tool design beating prompt engineering: the same principle as specific error messages, applied to empty results.",
  },
];
