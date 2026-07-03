import type { Lesson } from "@/lib/types";

export const lesson02: Lesson = {
  slug: "react-and-planning",
  title: "ReAct & Planning",
  minutes: 35,
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
      type: "exercise",
      kind: "predict",
      prompt:
        "A teammate deletes the `stop_sequences=[\"Observation:\"]` line from `react_step` — 'the prompt already says to stop after one Action.' The agent's accuracy quietly collapses over the next week. What is actually happening in the transcripts?",
      answer:
        "The model doesn't reliably stop where the prompt asks — it continues the pattern it was shown and **writes its own `Observation:` line**, inventing the tool result it *expects*, then reasons and acts on that invention. The trajectory looks healthy in logs (perfect Thought/Action/Observation structure!) but is grounded in hallucinated data, and errors compound step over step. That's why the stop sequence was load-bearing: it's a *hard* boundary where a prompt instruction is a soft one. The modern echo of this bug: native tool calling makes it structurally impossible — the model physically can't append a `tool_result` block (that's a user-role block), which is one of the strongest arguments for typed tool calling over text protocols. **Interview relevance:** 'why did stop sequences matter in ReAct?' is a history question testing whether you understand *grounding* — the Observation must come from the world, never the model.",
    },
    {
      type: "paragraph",
      text: 'Modern tool calling **is** ReAct with the plumbing formalized: the *Action* became a `tool_use` block (typed, validated, no regex), the *Observation* became a `tool_result`, and the *Thought* became text the model emits before its tool calls — or, on models that support it, dedicated extended-thinking blocks. The insight that survives is behavioral, not mechanical: **agents that articulate reasoning before acting pick better tools and recover from surprises**. A system-prompt line like "before each tool call, state in one sentence what you expect to learn" measurably reduces flailing on hard tasks — at the price of extra output tokens.',
    },
    {
      type: "paragraph",
      text: "On current frontier models the *Thought* leg has been absorbed even deeper: with **adaptive thinking**, the model interleaves private reasoning blocks between tool calls automatically — deciding for itself when a step deserves deliberation — and the `effort` parameter scales how much. So the 2026 version of 'ReAct vs. native tool calling' has three layers to name: text-protocol ReAct (history), typed tool calling with prompted reasoning (the portable baseline), and interleaved thinking (the frontier default, where reasoning is a billed, replayed first-class block — remember from Module 1 that thinking blocks are resent verbatim like any assistant content).",
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
      type: "paragraph",
      text: "One more pattern from production harnesses worth naming: **externalized plans**. Instead of the plan living only as prose in context, serious agent products (coding agents are the canonical example) give the model a *todo-list tool* — create tasks, mark them in-progress/done. The plan becomes harness-visible state: the UI can render progress to the user, your code can detect stalled items, and — subtly the biggest win — marking a step done is an *action the model takes*, which anchors it against both forgetting steps and re-doing finished ones. It's the same idea as making re-planning a tool call: externalize the agent's intent so the harness can see it.",
    },
    {
      type: "callout",
      kind: "warning",
      title: "When planning hurts",
      text: "A plan step adds a full LLM call of cost and latency, plus permanent context weight. For a task the model can do in 2–3 tool calls, planning is pure overhead — and a wrong plan is *worse* than no plan, because it anchors the model. Rule of thumb: add upfront planning when tasks routinely exceed ~5 tool calls or need coverage guarantees; skip it below that.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** Traces show your research agent wandering on long tasks — re-searching topics it already covered, forgetting to check one of the three sources the task named. Diagnose and fix, out loud.",
      answer:
        "Diagnosis first, and name the evidence you'd look for: wandering + missed coverage on tasks over ~5 steps is the signature of **plan-as-you-go on a task that needed a plan** — each iteration decides locally with no global checklist, so covered ground isn't marked and required ground isn't tracked. Confirm in traces: repeated near-duplicate tool calls, and no point where the model enumerated the three sources. Fix in escalating order: (1) **upfront plan via a forced structured call**, pinned in context — coverage items become explicit steps; (2) frame it as a hypothesis with a **re-plan tool** so contradictions don't cause drift; (3) for recurring task shapes, **externalize as a todo list** so the harness itself can detect the un-done step and nudge. And say the guardrail: don't add planning to the short tasks that were working — plans cost a call and anchor errors. **Follow-up probe:** \"the plan says check A, B, C but the model marks C done without calling any tool\" → that's a grounding failure; validate done-transitions against the trace (did a tool call actually happen since in-progress?) and reject the transition otherwise.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** Design the re-plan trigger. Too eager and the agent thrashes, too lazy and you get plan drift — what do you actually implement?",
      answer:
        "Make both sides of the trade concrete. **The trigger:** instruct the model to call `submit_plan` again when an observation *contradicts a plan assumption* — not merely when it's surprised — and give one example of each in the prompt (contradiction: 'the file the plan assumed doesn't exist'; mere surprise: 'the file is longer than expected'). **The damping:** cap revisions (e.g. 3 per run), require each revision to state *which observation invalidated which step* (that one field kills most frivolous re-plans, because the model can't fill it honestly), and keep completed steps frozen — re-planning only edits the future. **The telemetry:** count revisions per run in traces; a healthy distribution is mostly 0–1, and a task shape averaging 3+ revisions is telling you the tools or task spec are wrong — fix those, don't tune the trigger further. **Follow-up probe:** \"why not just re-plan every iteration?\" → cost (a planning call per iteration), context bloat (N plans in history), and anchoring churn — the model spends its budget deliberating instead of acting.",
    },
    {
      type: "keypoints",
      points: [
        "ReAct = interleave **Thought → Action → Observation**; it fixed hallucination (reason-only) and impulsiveness (act-only).",
        "Native tool calling is ReAct with typed plumbing: `tool_use` = Action, `tool_result` = Observation. Explain the lineage; don't ship the regex.",
        "Prompting the model to state expectations before each call still improves tool choice — reasoning-before-acting is behavioral, not mechanical.",
        "On frontier models the Thought leg is interleaved thinking — billed, replayed verbatim, and automatic; know all three layers of the lineage.",
        "Upfront plans help long, coverage-style tasks; they hurt short tasks and anchor the model when wrong.",
        "Make re-planning an explicit tool call so plan drift is visible in traces instead of silent — and damp it: cap revisions, require the contradicting observation, freeze completed steps.",
        "Externalize plans as todo-list state when the harness or user needs to see progress — intent the harness can't see is intent it can't guard.",
      ],
    },
  ],
};
