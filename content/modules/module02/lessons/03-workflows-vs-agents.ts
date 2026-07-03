import type { Lesson } from "@/lib/types";

export const lesson03: Lesson = {
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
};
