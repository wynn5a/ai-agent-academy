import type { Module } from "@/lib/types";

export const module02: Module = {
  id: 2,
  slug: "agent-loop",
  title: "The Agent Loop",
  weeks: "Weeks 3–5",
  phase: 1,
  phaseTitle: "Foundations from raw APIs",
  description:
    "An agent is an LLM calling tools in a loop, with the model deciding what to do next. This module is the heart of the curriculum: the loop itself, ReAct, Anthropic's workflows-vs-agents taxonomy, planning, termination, budgets, and failure recovery.",
  outcomes: [
    "Implement the core agent loop — model picks a tool, you execute, results feed back — with the model choosing the path",
    "Explain Anthropic's workflows-vs-agents taxonomy and argue when a workflow beats an agent (the interview staple)",
    "Implement the five workflow patterns: prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer",
    "Explain ReAct and how native tool calling absorbed it; add upfront planning and re-planning to a loop",
    "Enforce termination with layered guards: finish tool, max iterations, cost budget, wall-clock deadline — with graceful degradation",
    "Recover from tool failures without crashing, keep context from exploding across iterations, and emit a JSONL trace log for every run",
  ],
  lessons: [
    {
      slug: "the-loop-that-makes-an-agent",
      title: "The Loop That Makes an Agent",
      minutes: 25,
      summary:
        "A chatbot maps one input to one output. An agent runs a loop where the model itself decides which tools to call, in what order, until the task is done. The loop is ~20 lines; everything else in this module is guardrails around it.",
      sections: [
        {
          type: "paragraph",
          text: "In Module 1 you built one tool-use round trip. The jump to an **agent** is smaller than the hype suggests: you put that round trip inside a `while` loop and let the model keep going. The defining property is **who chooses the control flow**. In a chatbot (or a workflow), your code decides what happens next. In an agent, the *model* decides — which tool, which arguments, whether to keep digging or stop. Same API, radically different system behavior.",
        },
        {
          type: "table",
          headers: ["Dimension", "Chatbot", "Agent"],
          rows: [
            [
              "Control flow",
              "One request → one response; your code owns every step",
              "Model picks the next action each iteration; path emerges at runtime",
            ],
            [
              "Tool calls",
              "Zero or one, hardcoded by you",
              "Zero to many, sequenced by the model",
            ],
            [
              "Cost & latency",
              "Predictable: one call",
              "Variable: N calls, unknown N until it runs",
            ],
            [
              "Failure surface",
              "Bad answer",
              "Bad answer, infinite loops, runaway cost, wrong tool spirals",
            ],
            [
              "When it shines",
              "The path is known in advance",
              "The path can't be predetermined (research, debugging, open-ended tasks)",
            ],
          ],
        },
        {
          type: "animation",
          name: "agent-loop",
          caption:
            "The loop: LLM → tool call → your code executes → result back into messages → LLM again, until the model stops asking for tools.",
        },
        {
          type: "heading",
          text: "The canonical loop",
        },
        {
          type: "code",
          language: "python",
          title: "a complete agent in ~40 lines (raw Anthropic SDK)",
          code: `import anthropic

client = anthropic.Anthropic()
MODEL = "claude-sonnet-4-5"

TOOLS = [
    {
        "name": "search_notes",
        "description": (
            "Search the local notes database for a keyword. Use whenever the "
            "user asks about anything that might live in their notes. "
            "Returns up to 5 matching snippets with note ids."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    {
        "name": "read_note",
        "description": "Read one note in full, by id from search_notes results.",
        "input_schema": {
            "type": "object",
            "properties": {"note_id": {"type": "string"}},
            "required": ["note_id"],
        },
    },
]

def search_notes(query: str) -> str: ...   # your implementations
def read_note(note_id: str) -> str: ...

IMPL = {"search_notes": search_notes, "read_note": read_note}

def run_agent(question: str, max_iterations: int = 10) -> str:
    messages = [{"role": "user", "content": question}]
    for _ in range(max_iterations):
        resp = client.messages.create(
            model=MODEL, max_tokens=2048,
            tools=TOOLS, messages=messages,
        )
        if resp.stop_reason != "tool_use":
            return resp.content[0].text          # model chose to stop

        messages.append({"role": "assistant", "content": resp.content})
        results = []
        for block in resp.content:
            if block.type == "tool_use":
                output = IMPL[block.name](**block.input)
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": output,
                })
        messages.append({"role": "user", "content": results})
    raise RuntimeError("max iterations exceeded")   # we'll fix this in lesson 4`,
          explanation:
            "Read the loop body slowly — it's the same four-step dance from Module 1, just repeated. Notice what's *absent*: no if/else deciding whether to search first or read first. The model sequences the tools itself by reading the schemas and the accumulating results. The `for` instead of `while True` is your first guardrail; raising on exhaustion is bad manners we'll replace with graceful degradation in lesson 4.",
        },
        {
          type: "callout",
          kind: "insight",
          text: "Memorize this shape: `while not done: response = llm(messages + tools); if tool_calls: execute, append results; else: done`. **Everything else in agent engineering is guardrails around this loop** — termination, budgets, context discipline, tracing, recovery. When a framework shows you an 'AgentExecutor', this loop is what's inside.",
        },
        {
          type: "heading",
          text: "Watch the path emerge",
        },
        {
          type: "code",
          language: "python",
          title: "instrument the loop and the dynamic path becomes visible",
          code: `def run_with_trace(question: str, max_iterations: int = 10) -> str:
    messages = [{"role": "user", "content": question}]
    for i in range(max_iterations):
        resp = client.messages.create(
            model=MODEL, max_tokens=2048, tools=TOOLS, messages=messages,
        )
        if resp.stop_reason != "tool_use":
            print(f"[{i}] final answer after {i} tool iterations")
            return resp.content[0].text

        messages.append({"role": "assistant", "content": resp.content})
        results = []
        for block in resp.content:
            if block.type == "tool_use":
                print(f"[{i}] model chose: {block.name}({block.input})")
                output = IMPL[block.name](**block.input)
                print(f"[{i}]   -> {len(output)} chars back")
                results.append({"type": "tool_result",
                                "tool_use_id": block.id, "content": output})
        messages.append({"role": "user", "content": results})
    raise RuntimeError("max iterations exceeded")

# Run 1: "What did I write about backoff?"
#   [0] model chose: search_notes({'query': 'backoff'})
#   [1] model chose: read_note({'note_id': 'n042'})
#   [2] final answer after 2 tool iterations
#
# Run 2: "Summarize my notes on rate limits AND caching"
#   [0] model chose: search_notes({'query': 'rate limits'})
#   [0] model chose: search_notes({'query': 'caching'})     # parallel!
#   [1] model chose: read_note({'note_id': 'n042'})
#   [1] model chose: read_note({'note_id': 'n107'})
#   [2] final answer after 2 tool iterations`,
          explanation:
            "Two things to internalize from the sample traces: the path differs per question with zero code changes (that's the agent-ness), and the model may request **multiple tool calls in a single turn** — your executor must answer every one of them, and can run them concurrently since they arrived together.",
        },
        {
          type: "keypoints",
          points: [
            "Agent = LLM + tools + loop, with **the model choosing the path**. Chatbot/workflow = your code chooses.",
            "The loop is: call model → if `tool_use`, execute and append results → repeat → else return the text.",
            "The model can emit several tool calls per turn — answer all of them; they're safe to parallelize.",
            "Flexibility costs you: unknown iteration count means unknown cost, latency, and new failure modes.",
            "Everything that follows in this module is guardrails bolted onto this one loop.",
          ],
        },
      ],
    },
    {
      slug: "react-and-planning",
      title: "ReAct & Planning",
      minutes: 25,
      summary:
        "ReAct — reason, act, observe, repeat — is the intellectual ancestor of the modern agent loop. Today the pattern is baked into native tool calling, but the ideas (verbalized reasoning, plan-then-act, re-planning on surprise) still decide whether your agent flails or converges.",
      sections: [
        {
          type: "paragraph",
          text: 'The 2022 **ReAct** paper (Yao et al., "ReAct: Synergizing Reasoning and Acting in Language Models") made a simple observation: models that only *reason* (chain-of-thought) hallucinate facts, and models that only *act* (emit actions) make impulsive, unrecoverable moves. Interleaving the two — **Thought → Action → Observation**, repeated — beat both. Before tool-calling APIs existed, this was done entirely with prompting and text parsing.',
        },
        {
          type: "animation",
          name: "react-pattern",
          caption:
            "ReAct interleaves verbalized reasoning (Thought) with tool use (Action) and its result (Observation), looping until a finish action.",
        },
        {
          type: "code",
          language: "python",
          title:
            "the original technique: ReAct as pure prompting (know it, don't ship it)",
          code: `import re

REACT_PROMPT = """Answer the question by interleaving Thought, Action, and
Observation steps.

Available actions:
  search[query]   - search the knowledge base
  lookup[title]   - read a full article
  finish[answer]  - give the final answer

Respond with exactly one Thought and one Action, then STOP:
Thought: <reasoning about what to do next>
Action: <one action>

I will run the action and reply with:
Observation: <result>

Question: {question}"""

def react_step(messages) -> tuple[str, str]:
    resp = client.messages.create(
        model=MODEL, max_tokens=512,
        stop_sequences=["Observation:"],   # forbid hallucinating results
        messages=messages,
    )
    text = resp.content[0].text
    match = re.search(r"Action: *(\\w+)\\[(.*)\\]", text)
    if match is None:
        raise ValueError("model broke the ReAct format:\\n" + text)
    return match.group(1), match.group(2)   # e.g. ("search", "agent loops")`,
          explanation:
            'Two load-bearing tricks: `stop_sequences=["Observation:"]` cuts the model off before it invents its own observation (early ReAct implementations lived and died by this), and the regex extracts the action from free text — which is exactly the fragile parsing that native tool calling replaced with schema-validated JSON. You should be able to explain this history in an interview, but never build on regex parsing in 2026.',
        },
        {
          type: "paragraph",
          text: 'Modern tool calling **is** ReAct with the plumbing formalized: the *Action* became a `tool_use` block (typed, validated, no regex), the *Observation* became a `tool_result`, and the *Thought* became text the model emits before its tool calls — or, on models that support it, dedicated extended-thinking blocks. The insight that survives is behavioral, not mechanical: **agents that articulate reasoning before acting pick better tools and recover from surprises**. A system-prompt line like "before each tool call, state in one sentence what you expect to learn" measurably reduces flailing on hard tasks — at the price of extra output tokens.',
        },
        {
          type: "heading",
          text: "Planning: upfront vs. as-you-go",
        },
        {
          type: "table",
          headers: ["Strategy", "How it works", "Wins when", "Fails when"],
          rows: [
            [
              "Plan-as-you-go (pure ReAct)",
              "No explicit plan; each iteration decides the next step from accumulated context",
              "Short tasks (≤ ~5 steps); environments where each result reshapes the task",
              "Long tasks — the agent wanders, repeats work, forgets the goal",
            ],
            [
              "Upfront plan",
              "First call produces a step list; the loop executes with the plan pinned in context",
              "Multi-step research/refactors; anything needing coverage (check A, B, and C)",
              "The plan is built on wrong assumptions and the agent follows it off a cliff",
            ],
            [
              "Plan + re-plan",
              "Upfront plan, plus an explicit trigger to revise when observations contradict it",
              "Long tasks in uncertain environments — the default for serious agents",
              "Trigger too eager → thrashing; too lazy → plan drift anyway",
            ],
          ],
        },
        {
          type: "paragraph",
          text: 'The failure mode to name in interviews is **plan drift**: the environment disagrees with step 2 ("the config file the plan assumed doesn\'t exist"), but the model keeps marching through steps 3–5 because the stale plan sits in context outranking fresh observations. The fix is making re-planning a first-class, *visible* action rather than hoping the model improvises.',
        },
        {
          type: "code",
          language: "python",
          title: "plan-first agent with an explicit re-plan escape hatch",
          code: `PLAN_TOOL = {
    "name": "submit_plan",
    "description": "Record a step-by-step plan before doing any work.",
    "input_schema": {
        "type": "object",
        "properties": {
            "steps": {"type": "array", "items": {"type": "string"},
                      "minItems": 1, "maxItems": 6},
        },
        "required": ["steps"],
    },
}

def make_plan(question: str) -> list[str]:
    resp = client.messages.create(
        model=MODEL, max_tokens=1024,
        tools=[PLAN_TOOL],
        tool_choice={"type": "tool", "name": "submit_plan"},  # forced
        messages=[{"role": "user", "content":
            "Plan how to answer this question using list_dir, grep and "
            "read_file tools. At most 6 concrete steps.\\n\\n"
            "Question: " + question}],
    )
    block = next(b for b in resp.content if b.type == "tool_use")
    return block.input["steps"]

def run_with_plan(question: str) -> str:
    plan = make_plan(question)
    plan_text = "\\n".join(f"{i + 1}. {s}" for i, s in enumerate(plan))
    task = (
        f"Question: {question}\\n\\nYour plan:\\n{plan_text}\\n\\n"
        "Follow the plan, but treat it as a hypothesis. If an observation "
        "contradicts a step, do NOT push on: call submit_plan again with a "
        "revised plan, then continue."
    )
    messages = [{"role": "user", "content": task}]
    # ... standard loop from lesson 1, with submit_plan available as a tool;
    # when the model calls it mid-run, log the revision and return
    # "Plan updated." as the tool_result.
    ...`,
          explanation:
            "Three deliberate choices: the plan is produced by a **forced structured call** (Module 1's tool-choice trick), so you always get a parseable list; the plan is framed as \"a hypothesis\", which measurably lowers the model's tendency to defend it; and re-planning is a *tool call* — so it shows up in your trace log and you can count revisions per run. An agent that re-plans 5 times in 15 iterations is telling you the task or tools are underspecified.",
        },
        {
          type: "callout",
          kind: "warning",
          title: "When planning hurts",
          text: "A plan step adds a full LLM call of cost and latency, plus permanent context weight. For a task the model can do in 2–3 tool calls, planning is pure overhead — and a wrong plan is *worse* than no plan, because it anchors the model. Rule of thumb: add upfront planning when tasks routinely exceed ~5 tool calls or need coverage guarantees; skip it below that.",
        },
        {
          type: "keypoints",
          points: [
            "ReAct = interleave **Thought → Action → Observation**; it fixed hallucination (reason-only) and impulsiveness (act-only).",
            "Native tool calling is ReAct with typed plumbing: `tool_use` = Action, `tool_result` = Observation. Explain the lineage; don't ship the regex.",
            "Prompting the model to state expectations before each call still improves tool choice — reasoning-before-acting is behavioral, not mechanical.",
            "Upfront plans help long, coverage-style tasks; they hurt short tasks and anchor the model when wrong.",
            "Make re-planning an explicit tool call so plan drift is visible in traces instead of silent.",
          ],
        },
      ],
    },
    {
      slug: "workflows-vs-agents",
      title: "Workflows vs. Agents: The Taxonomy",
      minutes: 30,
      summary:
        "Anthropic's 'Building Effective Agents' taxonomy is the single most-cited framework in agent interviews. Workflows: your code orchestrates LLM steps. Agents: the LLM drives. Five workflow patterns cover a huge share of real systems — and the senior move is knowing when NOT to build an agent.",
      sections: [
        {
          type: "paragraph",
          text: "Anthropic's essay *Building Effective Agents* draws one line through the whole design space. **Workflows** are systems where LLM calls are orchestrated through **predefined code paths** — your program decides what runs, in what order; the model fills in steps. **Agents** are systems where the **LLM dynamically directs its own process and tool usage**. Workflows buy you predictability, testability, bounded cost, and easy debugging. Agents buy you flexibility on tasks where the path genuinely can't be written down in advance. Neither is 'better' — they trade against each other.",
        },
        {
          type: "callout",
          kind: "insight",
          title: "The interview staple",
          text: '"Would you build an agent for this?" The senior answer is almost always: **start with the simplest thing — a single prompt, then a workflow; reach for an agent only when the path can\'t be predetermined.** Concrete pairing: invoice field extraction is a workflow (same three steps every time — extract, validate, file); "figure out why checkout latency doubled last Tuesday" is an agent (nobody can enumerate the search path upfront). Saying \'agent\' to everything reads as junior.',
        },
        {
          type: "animation",
          name: "workflow-patterns",
          caption:
            "The five workflow patterns: chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer — code-defined paths, LLM-powered steps.",
        },
        {
          type: "table",
          headers: ["Pattern", "Shape", "Use it for", "Concrete example"],
          rows: [
            [
              "**Prompt chaining**",
              "Fixed sequence; each call's output feeds the next, with programmatic gates between steps",
              "Tasks that decompose into fixed, checkable stages",
              "Diff → extract changes → draft release notes → rewrite for customers",
            ],
            [
              "**Routing**",
              "A classifier call picks one of several specialized downstream paths",
              "Heterogeneous inputs needing different handling",
              "Support triage: refund / bug / how-to / escalate, each with its own prompt, tools, and model tier",
            ],
            [
              "**Parallelization**",
              "Independent calls run concurrently: *sectioning* (split the work) or *voting* (same task, N samples, aggregate)",
              "Independent subtasks, or reliability via consensus",
              "Sectioning: review one document per chapter in parallel. Voting: 5 cheap safety checks, flag if any 2 agree",
            ],
            [
              "**Orchestrator-workers**",
              "A lead LLM *decides at runtime* how to split the task, delegates to workers, merges results",
              "Decomposable work where the subtasks aren't known upfront",
              '"Update this API across the codebase": orchestrator finds affected files, spawns a worker per file',
            ],
            [
              "**Evaluator-optimizer**",
              "Generator produces, evaluator critiques against criteria, generator revises; loop until pass or max rounds",
              "Outputs with clear evaluation criteria that benefit from iteration",
              "Translation refined against a rubric; code revised until tests and a style critique pass",
            ],
          ],
        },
        {
          type: "code",
          language: "python",
          title: "prompt chaining — the gate between steps is the superpower",
          code: `def ask(prompt: str, temperature: float = 0.0) -> str:
    resp = client.messages.create(
        model=MODEL, max_tokens=2048, temperature=temperature,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text

def release_notes(diff: str) -> str:
    # Step 1: extract (small, focused, checkable)
    changes = ask(
        "List every user-facing change in this diff as terse bullet points. "
        "If there are none, output exactly: NONE.\\n\\nDiff:\\n" + diff
    )

    # GATE: deterministic code between LLM steps. No model call needed
    # to decide the branch — this is what makes workflows debuggable.
    if changes.strip() == "NONE":
        return "No user-facing changes in this release."

    # Step 2: draft from the extraction, not the raw diff
    draft = ask("Write release notes from these changes:\\n\\n" + changes)

    # Step 3: adapt for audience
    return ask(
        "Rewrite these release notes for non-technical customers. "
        "Under 150 words, no jargon:\\n\\n" + draft
    )`,
          explanation:
            "Each step does one small thing, so each is individually promptable, testable, and swappable (step 3 could run on a cheaper model). The **gate** between steps is plain Python — you can log it, unit-test it, and it never hallucinates. Compare debugging this to debugging an agent that 'sometimes writes bad release notes': here you inspect three intermediate strings and know exactly which step broke.",
        },
        {
          type: "code",
          language: "python",
          title: "routing — one forced classification, then specialized paths",
          code: `ROUTE_TOOL = {
    "name": "route",
    "description": "Classify the incoming support request.",
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "enum": ["refund", "bug_report", "how_to", "other"],
            },
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        },
        "required": ["category", "confidence"],
    },
}

def handle(request: str) -> str:
    resp = client.messages.create(
        model=MODEL, max_tokens=256,
        tools=[ROUTE_TOOL],
        tool_choice={"type": "tool", "name": "route"},
        messages=[{"role": "user", "content": "Route this request:\\n" + request}],
    )
    verdict = next(b for b in resp.content if b.type == "tool_use").input
    if verdict["confidence"] < 0.7:
        return escalate_to_human(request)        # cheap honesty beats guessing

    handlers = {
        "refund": run_refund_workflow,     # strict chain w/ payment tools
        "bug_report": run_triage_chain,    # extract repro -> severity -> ticket
        "how_to": answer_from_docs,        # RAG on a cheaper model
        "other": escalate_to_human,
    }
    return handlers[verdict["category"]](request)`,
          explanation:
            "Routing's payoff is **separation of concerns**: each handler gets a prompt, tool set, and model tier optimized for its category, instead of one bloated do-everything prompt. The `enum` makes the classification a closed set, and returning a confidence lets you route uncertainty to humans. Note this whole system contains five LLM touchpoints and zero agent loops.",
        },
        {
          type: "paragraph",
          text: "**Orchestrator-workers** sits at the boundary of the taxonomy: the orchestrator LLM decides the decomposition at runtime (agent-like), but workers run fixed, bounded subtasks (workflow-like). It's the pattern behind most 'multi-agent' systems you'll meet, and Module 7 builds one. **Evaluator-optimizer** closes a generate → critique → revise loop; it shines when you can state the bar (\"all tests pass and the critique finds no severity-1 issues\") and cap the rounds (2–3 is typical — returns diminish fast).",
        },
        {
          type: "callout",
          kind: "warning",
          title: "Evaluator-optimizer's trap: reward hacking the judge",
          text: 'When a generator is optimized against an LLM judge, it learns to please **the judge**, not the goal: padding answers with confident hedges, mirroring the rubric\'s phrasing, self-praising ("this thoroughly addresses..."). Defenses: give the evaluator concrete, checkable criteria instead of "rate quality 1–10"; mix in deterministic checks (tests, linters, length caps) the generator can\'t sweet-talk; hold out a different judge for final acceptance; and audit transcripts where the judge\'s score jumped between rounds. This is the same failure family as RL reward hacking — Module 8 returns to it.',
        },
        {
          type: "list",
          items: [
            "**Reach for an agent only when all of these hold:** the path genuinely can't be enumerated (else: chain or route it); errors are recoverable or the blast radius is contained; you can define success programmatically enough to test it; and per-task cost/latency variance is acceptable.",
            "**Prefer a workflow when:** the task is high-volume (variance in cost and quality compounds), regulated or safety-critical (auditors want predefined paths), or latency-bound (an agent's N serial round trips are irreducible).",
            "**Hybrids are normal:** a router in front of an agent, an agent that calls a chained sub-workflow as a single tool, an orchestrator whose workers are plain prompts. The taxonomy names components, not religions.",
          ],
        },
        {
          type: "keypoints",
          points: [
            "Workflows: **your code** picks the path, model fills in steps. Agents: **the model** picks the path.",
            "Five patterns: chaining (fixed stages + gates), routing (classify then specialize), parallelization (sectioning/voting), orchestrator-workers (runtime decomposition), evaluator-optimizer (generate–critique loop).",
            "Senior default: simplest thing first — single call → workflow → agent, escalating only when the path can't be predetermined.",
            "High volume, hard budgets, auditability, low latency → workflow. Unenumerable paths + recoverable errors → agent.",
            "Evaluator-optimizer needs checkable criteria and capped rounds, or the generator reward-hacks the judge.",
          ],
        },
      ],
    },
    {
      slug: "termination-and-budgets",
      title: "Termination, Budgets & Graceful Degradation",
      minutes: 25,
      summary:
        "Never trust the model alone to stop. Production agents layer termination conditions — an explicit finish tool, iteration caps, dollar budgets, wall-clock deadlines — and when a budget trips, they degrade gracefully instead of raising.",
      sections: [
        {
          type: "paragraph",
          text: "The loop from lesson 1 has a dirty secret: it terminates when `stop_reason != \"tool_use\"` — i.e., **whenever the model feels done**. Models sometimes stop early with a half-answer, and sometimes never feel done: re-grepping the same pattern, re-reading the same file, chasing a lead in circles. A model deciding 'one more tool call' 30 times in a row is not a hypothetical; it's a Tuesday. Termination must be **layered**: the model's own signal, plus hard limits the model cannot override.",
        },
        {
          type: "table",
          headers: [
            "Condition",
            "Trigger",
            "Who controls it",
            "What it protects against",
          ],
          rows: [
            [
              "Natural stop",
              '`stop_reason` is `"end_turn"` — model answered without tools',
              "Model",
              "Nothing — it IS the happy path (and sometimes a premature one)",
            ],
            [
              "Explicit `finish` tool",
              "Model calls `finish(answer, citations)`",
              "Model, but on your schema",
              "Ambiguous endings; forces a structured, complete final answer",
            ],
            [
              "Max iterations",
              "Loop counter hits N (e.g. 15)",
              "Your code",
              "Infinite tool spirals",
            ],
            [
              "Cost budget",
              "Accumulated dollars from `usage` exceed the cap",
              "Your code",
              "Expensive iterations — 15 cheap calls fine, 15 huge-context calls not",
            ],
            [
              "Wall-clock deadline",
              "`time.monotonic()` passes the deadline",
              "Your code",
              "Slow tools and long generations; the user is still waiting",
            ],
          ],
        },
        {
          type: "paragraph",
          text: "Why isn't max-iterations enough on its own? Because **iterations are not the resource — tokens, dollars, and seconds are.** One iteration that stuffs a 200KB file into context can cost more than fourteen normal ones; a tool that hangs for 40 seconds burns your latency budget in two iterations. Bound each real resource separately: count of calls, cumulative cost, and elapsed time — and check them **before** each LLM call, not after, so you never pay for a call whose result you'd discard.",
        },
        {
          type: "code",
          language: "python",
          title: "a Budget object the loop consults before every call",
          code: `import time

class Budget:
    # Pull current per-MTok prices from your provider's pricing page.
    # Never hardcode from memory; keep them in one place so tests can pin them.
    PRICE_IN_PER_MTOK = 0.0   # TODO: fill from pricing page
    PRICE_OUT_PER_MTOK = 0.0  # TODO: fill from pricing page

    def __init__(self, max_iterations: int = 15,
                 max_usd: float = 0.50, max_seconds: float = 60.0):
        self.max_iterations = max_iterations
        self.max_usd = max_usd
        self.deadline = time.monotonic() + max_seconds
        self.iterations = 0
        self.usd = 0.0

    def add_call(self, usage) -> None:
        self.iterations += 1
        self.usd += (usage.input_tokens * self.PRICE_IN_PER_MTOK +
                     usage.output_tokens * self.PRICE_OUT_PER_MTOK) / 1_000_000

    def exhausted(self) -> str | None:
        """Return a human-readable reason, or None if we may continue."""
        if self.iterations >= self.max_iterations:
            return f"iteration cap ({self.max_iterations}) reached"
        if self.usd >= self.max_usd:
            return f"cost budget exceeded ({self.usd:.3f} USD)"
        if time.monotonic() >= self.deadline:
            return "wall-clock deadline passed"
        return None`,
          explanation:
            "Small but deliberate: `exhausted()` returns a *reason string* rather than a boolean, because that reason goes into the trace log and into the degraded answer's metadata (\"incomplete: cost budget exceeded\"). `time.monotonic()` instead of `time.time()` because wall-clock time can jump (NTP adjustments); monotonic never goes backward. Prices live in named constants so a test can assert they're non-zero before you ship.",
        },
        {
          type: "heading",
          text: "The finish tool and graceful degradation",
        },
        {
          type: "code",
          language: "python",
          title: "loop with finish tool + best-effort fallback — never raises",
          code: `FINISH_TOOL = {
    "name": "finish",
    "description": (
        "Submit your final answer. Call exactly once, when you have enough "
        "evidence. Every claim must cite a file path you actually read."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
            "citations": {"type": "array", "items": {"type": "string"},
                          "description": "file paths supporting the answer"},
        },
        "required": ["answer", "citations"],
    },
}

def run(question: str, budget: Budget) -> dict:
    messages = [{"role": "user", "content": question}]
    while True:
        reason = budget.exhausted()
        if reason is not None:                    # check BEFORE paying
            return best_effort(messages, reason)

        resp = client.messages.create(
            model=MODEL, max_tokens=2048,
            tools=TOOLS + [FINISH_TOOL], messages=messages,
        )
        budget.add_call(resp.usage)

        finish = next((b for b in resp.content
                       if b.type == "tool_use" and b.name == "finish"), None)
        if finish is not None:
            return {"answer": finish.input["answer"],
                    "citations": finish.input["citations"],
                    "complete": True}

        if resp.stop_reason != "tool_use":
            # model stopped talking without calling finish — nudge once
            messages.append({"role": "assistant", "content": resp.content})
            messages.append({"role": "user", "content":
                "Call the finish tool with your answer and citations."})
            continue

        messages.append({"role": "assistant", "content": resp.content})
        messages.append({"role": "user",
                         "content": execute_all(resp.content)})  # lesson 5

def best_effort(messages, reason: str) -> dict:
    """Budget is gone. One last cheap call, NO tools, to salvage an answer."""
    wrap_up = messages + [{"role": "user", "content":
        "Budget exhausted (" + reason + "). Using only what you have "
        "already found, give your best answer and state explicitly what "
        "you could not verify."}]
    resp = client.messages.create(model=MODEL, max_tokens=1024,
                                  messages=wrap_up)
    return {"answer": resp.content[0].text, "citations": [],
            "complete": False, "stop_reason": reason}`,
          explanation:
            "Three design points. (1) The `finish` tool turns 'the model went quiet' into a structured, citation-bearing artifact — and lets you *reject* endings that lack citations. (2) The budget check sits at the **top** of the loop, so exhaustion is detected before spending. (3) `best_effort` makes one final tool-free call — a caller gets `{complete: false, stop_reason: ...}` instead of a stack trace. One subtlety: the message array must end in an API-legal state (every `tool_use` answered) before the wrap-up call, which the loop guarantees since results are appended in the same iteration.",
        },
        {
          type: "callout",
          kind: "tip",
          title: "Budget the tools too",
          text: 'The LLM call isn\'t the only thing that burns time — a `grep` over a huge repo or a slow network tool can eat the deadline while the budget object sleeps. Give each tool execution its own timeout (a few seconds), and return "tool timed out" as an error result so the model can adapt. Latency budget = LLM time + tool time; meter both.',
        },
        {
          type: "keypoints",
          points: [
            "Layer termination: model's natural stop **plus** finish tool **plus** iteration cap **plus** cost budget **plus** wall-clock deadline. Never trust the model alone.",
            "Iterations aren't the resource — tokens, dollars, seconds are. Bound each separately.",
            "Check the budget *before* the LLM call; return a reason string, not a boolean.",
            "An explicit `finish(answer, citations)` tool forces structured, verifiable endings.",
            "On exhaustion: one final tool-free wrap-up call → best-effort answer flagged `complete: false`. Exceptions are for bugs, not budgets.",
          ],
        },
      ],
    },
    {
      slug: "failure-recovery-and-tracing",
      title: "Failure Recovery, Context Discipline & Tracing",
      minutes: 25,
      summary:
        "An agent's quality is defined on the unhappy path: tools fail, outputs balloon, and at 2 a.m. the only witness is your trace log. Error feedback loops, per-tool retry budgets, output truncation, and JSONL tracing turn a demo into a system.",
      sections: [
        {
          type: "paragraph",
          text: "In Module 1 you learned to return tool errors to the model as `tool_result` content instead of raising — because **models usually self-correct when shown the error**. Inside a loop, that mercy becomes a hazard: a model that self-corrects can also *self-repeat*, calling the same failing tool with the same arguments forever, burning budget on a file that will never exist. Recovery inside a loop needs escalating pressure, not infinite patience.",
        },
        {
          type: "list",
          items: [
            '**Defense 1 — feed the error back, specifically.** "FileNotFoundError: docs/setup.md does not exist. Sibling files: docs/setup-guide.md, docs/install.md" gives the model something to correct *toward*. Vague errors ("tool failed") invite identical retries.',
            '**Defense 2 — per-tool failure budgets.** Count failures per tool (or per tool+arguments pair). After N failures, stop executing and return "this tool is disabled for the rest of the run; try a different approach" — the model reroutes surprisingly well when told plainly.',
            '**Defense 3 — detect repetition itself.** Hash each (tool, arguments) call; on an exact repeat of a *failed* call, short-circuit with "you already tried this and it failed" without executing. Combined with the overall budget from lesson 4, the worst case is now bounded on three axes.',
          ],
        },
        {
          type: "code",
          language: "python",
          title:
            "a tool executor that never raises and applies escalating pressure",
          code: `import json
from collections import Counter

class SafeExecutor:
    def __init__(self, impl: dict, max_failures_per_tool: int = 3):
        self.impl = impl
        self.max_failures = max_failures_per_tool
        self.failures = Counter()        # per tool name
        self.failed_calls = set()        # exact (tool, args) repeats

    def execute(self, name: str, args: dict) -> tuple[str, bool]:
        """Returns (content, is_error). Never raises."""
        key = (name, json.dumps(args, sort_keys=True))

        if self.failures[name] >= self.max_failures:
            return (f"Tool '{name}' is disabled after "
                    f"{self.failures[name]} failures this run. "
                    "Use a different tool or approach.", True)
        if key in self.failed_calls:
            return ("You already tried this exact call and it failed. "
                    "Do not repeat it; change the arguments or approach.",
                    True)
        try:
            return (self.impl[name](**args), False)
        except Exception as e:
            self.failures[name] += 1
            self.failed_calls.add(key)
            return (f"{type(e).__name__}: {e}", True)

# in the loop:
#   content, is_error = executor.execute(block.name, block.input)
#   results.append({"type": "tool_result", "tool_use_id": block.id,
#                   "content": content, "is_error": is_error})`,
          explanation:
            "The two escalation paths are checked *before* execution, so a disabled tool costs nothing. Setting `is_error: true` on the result matters on Anthropic's API: it flags the result so the model treats it as a failure to route around rather than data. Keep the failure state per-run (on the executor object), not global — yesterday's flaky tool shouldn't be banned today.",
        },
        {
          type: "heading",
          text: "Context discipline: the loop's silent tax",
        },
        {
          type: "paragraph",
          text: "Every iteration appends an assistant turn and a tool-result turn — and Module 1 taught you that all of it is re-sent, re-processed, and re-billed on every subsequent call. Fifteen iterations with unbounded tool outputs is how a 'max 15 iterations' agent still blows a dollar budget. Three techniques keep it flat: **(1) truncate tool outputs at the source**, with a note telling the model how to get more; **(2) compact old iterations** — after the model has extracted what it needs from a big tool result, replace the old result with a stub; **(3) keep the system prompt lean and cache it** — stable prefix first, per Module 1's caching lesson.",
        },
        {
          type: "code",
          language: "python",
          title: "truncate at the source + compact old results",
          code: `MAX_TOOL_OUTPUT_CHARS = 4000

def truncate(output: str, limit: int = MAX_TOOL_OUTPUT_CHARS) -> str:
    if len(output) <= limit:
        return output
    dropped = len(output) - limit
    return (output[:limit] +
            f"\\n\\n[TRUNCATED: {dropped} more characters not shown. "
            "Narrow your grep pattern, or call read_file with an offset "
            "to view a specific region.]")

def compact_old_results(messages: list, keep_last: int = 2,
                        stub_over: int = 1000) -> list:
    """Replace big tool results from old iterations with short stubs.
    The model already extracted what it needed; the bytes are just rent."""
    compacted = []
    cutoff = len(messages) - keep_last * 2   # each iteration = 2 messages
    for idx, msg in enumerate(messages):
        if idx >= cutoff or msg["role"] != "user" or isinstance(msg["content"], str):
            compacted.append(msg)
            continue
        new_content = []
        for part in msg["content"]:
            if (isinstance(part, dict) and part.get("type") == "tool_result"
                    and len(str(part.get("content", ""))) > stub_over):
                new_content.append({**part, "content":
                    "[old tool result elided to save context - "
                    "re-run the tool if you need it again]"})
            else:
                new_content.append(part)
        compacted.append({**msg, "content": new_content})
    return compacted`,
          explanation:
            "The truncation note is not politeness — it's an **affordance**: the model reads it and issues a narrower grep or an offset read, which is exactly the behavior you want. Compaction trades a risk (the model might need that data again) for a guarantee (context stays bounded); the stub tells it recovery is one tool call away. Warning: compaction rewrites history, so run it on a *copy* used for the API call if your trace log needs the original.",
        },
        {
          type: "heading",
          text: "The trace log: your only witness",
        },
        {
          type: "table",
          headers: ["Field", "Why it matters when debugging"],
          rows: [
            [
              "`run_id`, `iteration`, `ts`",
              "Groups events into one run and orders them — the skeleton every other question hangs on",
            ],
            [
              "Event type (`llm_call` / `tool_call` / `terminate`)",
              'Lets you filter: "show me only the tool calls" or "how did runs end this week?"',
            ],
            [
              "`input_tokens`, `output_tokens`, cumulative `usd`",
              "Finds the iteration where cost spiked — usually a giant unretruncated tool output",
            ],
            [
              "`stop_reason`",
              "Distinguishes 'model answered' from 'model wanted tools' from 'hit max_tokens' (truncated mid-thought!)",
            ],
            [
              "`tool`, `args`, `result_chars`, `is_error`",
              "Reconstructs the model's search path; repeated identical args = the spiral from Defense 3",
            ],
            [
              "`latency_ms` per call",
              "Splits the blame between slow model calls and slow tools when a run blows the deadline",
            ],
            [
              "Termination `reason` + `complete` flag",
              "The first field you check on a bad answer: did it finish, or run out of budget at step 14?",
            ],
          ],
        },
        {
          type: "code",
          language: "python",
          title: "a 20-line JSONL tracer — greppable, diffable, tail-able",
          code: `import json, time, uuid

class Tracer:
    def __init__(self, path: str = "trace.jsonl"):
        self.path = path
        self.run_id = uuid.uuid4().hex[:8]

    def log(self, event: str, **fields) -> None:
        record = {"run_id": self.run_id, "ts": round(time.time(), 3),
                  "event": event, **fields}
        with open(self.path, "a") as f:
            f.write(json.dumps(record, default=str) + "\\n")

# usage inside the loop:
tracer = Tracer()
t0 = time.monotonic()
resp = client.messages.create(model=MODEL, max_tokens=2048,
                              tools=TOOLS, messages=messages)
tracer.log("llm_call", iteration=i,
           input_tokens=resp.usage.input_tokens,
           output_tokens=resp.usage.output_tokens,
           usd_so_far=round(budget.usd, 4),
           stop_reason=resp.stop_reason,
           latency_ms=round((time.monotonic() - t0) * 1000))

content, is_error = executor.execute(block.name, block.input)
tracer.log("tool_call", iteration=i, tool=block.name, args=block.input,
           result_chars=len(content), is_error=is_error)

tracer.log("terminate", reason="finish tool called", complete=True,
           iterations=budget.iterations, total_usd=round(budget.usd, 4))`,
          explanation:
            "JSONL (one JSON object per line) is the right format because it's append-only (crash-safe — you keep everything up to the crash), streamable (`tail -f` during a live run), and trivially queryable with `jq` or pandas. Log *every* LLM call and *every* tool call, not just failures: the question you'll actually ask is \"what was the model seeing when it made this weird choice?\", and that requires the whole path. This log is also the artifact you walk through in the Gate G1 practical.",
        },
        {
          type: "keypoints",
          points: [
            "Feed errors back with **specifics** (what failed, what exists instead) — vague errors cause identical retries.",
            "Escalate: per-tool failure budgets disable a tool after N failures; hashing (tool, args) short-circuits exact repeats.",
            "Context grows every iteration and is re-billed every call: truncate outputs at the source, compact old results, keep the prefix stable and cached.",
            "Truncation notes are affordances — tell the model how to get more, and it will.",
            "Trace every LLM call, tool call, and termination to JSONL with tokens, cost, latency, and reason. If it's not in the trace, it didn't happen.",
          ],
        },
      ],
    },
  ],
  quiz: [
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
  ],
  lab: {
    title: "Lab 02 — File-System Research Agent",
    portfolio: true,
    objective:
      "Build an agent that answers natural-language questions about any local codebase or folder: it plans, lists, greps, and reads files across the repo, then synthesizes an answer with file-path citations — under hard iteration, cost, and time budgets, with a full JSONL trace and graceful degradation. Raw SDK only; starter code lives in labs/lab02-research-agent/.",
    sections: [
      {
        type: "heading",
        text: "What you're building",
      },
      {
        type: "paragraph",
        text: 'A CLI: `python research_agent.py "Which module covers prompt injection, and what lab does it require?" --root ../..` — the agent explores the repo with `list_dir`, `grep`, and `read_file`, then calls `finish(answer, citations)`. Every LLM call and tool call lands in `trace.jsonl`. If any budget trips (15 iterations, $0.50, 60 seconds), it returns a best-effort answer flagged incomplete — **never an exception**. This lab is the Gate G1 artifact: Claude will pick a novel question about an unfamiliar repo, and you\'ll walk through the trace explaining every decision.',
      },
      {
        type: "animation",
        name: "agent-loop",
        caption:
          "Lab 02 is lesson 1's loop plus every guardrail from lessons 4–5: finish tool, layered budgets, safe executor, truncation, tracing.",
      },
      {
        type: "heading",
        text: "Suggested structure",
      },
      {
        type: "code",
        language: "python",
        title: "skeleton (fill in the TODOs)",
        code: `# tools.py — implementations with output caps baked in
MAX_OUTPUT_CHARS = 4000

def list_dir(path: str) -> str:
    # names + sizes, directories marked; refuse paths outside --root
    ...

def grep(pattern: str, path: str = ".") -> str:
    # regex over text files under path; return "file:line: text" rows;
    # cap at ~50 matches, then a truncation note ("narrow your pattern")
    ...

def read_file(path: str, offset: int = 0, limit: int = 200) -> str:
    # numbered lines from offset; truncation note says how to read more
    ...

# agent.py — the loop with all guardrails
SYSTEM = (
    "You are a code-research agent. Explore with list_dir/grep/read_file, "
    "then call finish exactly once. Every claim in your answer must cite "
    "a file path you actually read. Before each tool call, state in one "
    "sentence what you expect to learn."
)

def answer(question: str, root: str) -> dict:
    budget = Budget(max_iterations=15, max_usd=0.50, max_seconds=60)
    tracer = Tracer("trace.jsonl")
    executor = SafeExecutor(IMPL, max_failures_per_tool=3)
    messages = [{"role": "user", "content": question}]

    while True:
        reason = budget.exhausted()
        if reason is not None:
            tracer.log("terminate", reason=reason, complete=False)
            return best_effort(messages, reason)      # never raises

        resp = timed_llm_call(messages, tracer, budget)   # logs usage+latency
        # TODO: finish-tool check -> validate citations -> return complete
        # TODO: end_turn without finish -> nudge once
        # TODO: execute tools via executor, truncate(), trace, append`,
        explanation:
          "Assemble, don't invent: `Budget`, `SafeExecutor`, `truncate`, and `Tracer` come straight from lessons 4–5. Decisions that matter: all three tools clamp their own output (never trust the loop to remember); `read_file` takes `offset`/`limit` so truncation notes are actionable; path arguments are resolved and checked against `--root` (the model must not read your home directory); and validate `finish` citations against the set of files actually read this run — reject and nudge if the model cites something it never opened.",
      },
      {
        type: "callout",
        kind: "tip",
        title: "Test the unhappy paths on purpose",
        text: "Before calling it done, force each failure: ask an unanswerable question (budget exhaustion path), point `--root` at a huge repo (truncation path), ask about a file that doesn't exist (error-feedback path), and set max_iterations=2 (degradation path). Each should produce a clean incomplete answer and a trace that tells the story. `jq .event trace.jsonl | sort | uniq -c` is your friend.",
      },
    ],
    acceptanceCriteria: [
      "Tools: `list_dir`, `grep`, `read_file` (all with output size caps) and `finish(answer, citations)` — raw SDK only, no frameworks",
      "Hard limits enforced: max 15 iterations, max $0.50/query (tracked from usage, checked before each call), 60s wall-clock",
      "Large file/tool outputs are truncated with a note telling the model how to get more (narrower pattern, offset read)",
      "On budget exhaustion the agent returns a best-effort answer flagged as incomplete — never raises an exception",
      "Structured JSONL trace log captures every LLM call and tool call with tokens, cost, latency, and the termination reason",
      'Works on this repo: "Which module covers prompt injection, and what lab does it require?" is answered correctly with file-path citations',
    ],
    stretchGoals: [
      "Execute multiple tool calls from a single assistant turn concurrently (they arrived together, so they're independent) and measure the wall-clock savings in the trace",
      "Add an upfront `submit_plan` step with explicit re-planning (lesson 2) and compare traces with/without it on three questions — does planning reduce iterations?",
      "Gate G1 rehearsal: have someone pick a repo you've never seen and a question; answer within budget, then narrate the full trace decision-by-decision",
    ],
  },
  resources: [
    {
      title: "Anthropic — Building Effective Agents",
      url: "https://www.anthropic.com/research/building-effective-agents",
      description:
        "The essay this module is built on. Read it twice; interviews quote it.",
      kind: "essay",
    },
    {
      title: "OpenAI — A Practical Guide to Building Agents",
      url: "https://platform.openai.com/docs/guides/agents",
      description:
        "Complementary vendor view: guardrails, orchestration, HITL.",
      kind: "guide",
    },
    {
      title: "Lilian Weng — LLM Powered Autonomous Agents",
      url: "https://lilianweng.github.io/posts/2023-06-23-agent/",
      description:
        "The classic conceptual grounding: planning, memory, tool use.",
      kind: "essay",
    },
    {
      title: "ReAct paper (Yao et al.)",
      url: "https://arxiv.org/abs/2210.03629",
      description: "Skim for the idea and the lineage question above.",
      kind: "paper",
    },
    {
      title: "Chip Huyen — Agents",
      url: "https://huyenchip.com/2025/01/07/agents.html",
      description:
        "The most rigorous long-form treatment of planning, tool selection, and agent failure modes.",
      kind: "essay",
    },
    {
      title: "12-Factor Agents (23k★)",
      url: "https://github.com/humanlayer/12-factor-agents",
      description:
        "Production principles from someone who tried every framework: own your loop, prompts, and context window.",
      kind: "repo",
    },
  ],
};
