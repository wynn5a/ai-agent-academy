import type { Lesson } from "@/lib/types";

export const lesson02: Lesson = {
  slug: "compaction-and-summarization",
  title: "Compaction: Summarizing Without Losing the Plot",
  minutes: 25,
  summary:
    "Long sessions overflow any window. Truncation forgets; compaction summarizes the oldest turns into a dense digest while recent turns stay verbatim. The craft is in what must survive untouched — and in never splitting a tool_use from its tool_result.",
  sections: [
    {
      type: "paragraph",
      text: "A productive agent session grows without bound; the window doesn't. **Truncation** (drop oldest turns) is simple and brutal — the user's constraint from turn 2 vanishes and the agent cheerfully violates it at turn 40. **Compaction** replaces the oldest span of turns with an LLM-written summary, keeping recent turns verbatim. Done well it's nearly invisible; done badly it's amnesia with extra steps. Trigger it by threshold: when the conversation crosses ~75% of your window budget, compact — *before* you're forced to, so there's headroom for the summary call itself and the next big tool result.",
    },
    {
      type: "animation",
      name: "context-window",
      caption:
        "Compaction in motion: the oldest turns collapse into a summary block; the tail of recent turns and the system prompt are untouched.",
    },
    {
      type: "heading",
      text: "What must survive untouched",
    },
    {
      type: "list",
      items: [
        "**The system prompt** — it's the agent's identity and rules; it is never compaction input.",
        '**Active task state**: the current goal, the user\'s standing constraints, decisions already made. A summary that drops "user said do NOT touch the prod database" is a security incident, not a summarization artifact.',
        "**Tool-call structure**: every `tool_use` block must keep its paired `tool_result` — compact at turn boundaries, never through a pair, or the API rejects the malformed history with a 400 (Module 1's strict pairing rule).",
        '**The most recent turns, verbatim**: the model needs exact recent wording — paraphrase kills follow-ups like "change that second option".',
        "**Hard-won values**: file paths, IDs, numbers, error strings. Instruct the summarizer to preserve these exactly.",
      ],
    },
    {
      type: "code",
      language: "python",
      title: "threshold-triggered compaction",
      code: `COMPACT_AT = 0.75          # of the window budget
WINDOW_BUDGET = 60_000     # tokens you allow the conversation to occupy
KEEP_RECENT = 8            # messages kept verbatim

SUMMARIZER_PROMPT = (
    "Summarize this conversation prefix for an agent that will continue it.\\n"
    "PRESERVE EXACTLY: the user's goal, all standing constraints and "
    "prohibitions, decisions made, and every file path, identifier, number, "
    "and error message. Note outcomes of tool calls, not their transcripts.\\n"
    "Write a dense factual digest. No praise, no meta-commentary."
)

def maybe_compact(messages: list[dict], system: str) -> list[dict]:
    if count(messages, system) < COMPACT_AT * WINDOW_BUDGET:
        return messages

    cut = len(messages) - KEEP_RECENT
    # never orphan a tool_result from its tool_use: shift the cut to a
    # boundary where the next kept message starts a fresh user turn
    while cut > 0 and starts_with_tool_result(messages[cut]):
        cut -= 1
    old, recent = messages[:cut], messages[cut:]
    if not old:
        return messages     # nothing safely compactable; raise budget or digest tools harder

    resp = client.messages.create(
        model=MODEL, max_tokens=1_500, temperature=0,
        system=SUMMARIZER_PROMPT,
        messages=old + [{"role": "user", "content":
                         "Now produce the summary of everything above."}],
    )
    summary = resp.content[0].text
    return [
        {"role": "user", "content":
         f"<conversation_summary>\\n{summary}\\n</conversation_summary>"},
        {"role": "assistant", "content": "Understood. Continuing from that summary."},
    ] + recent

def starts_with_tool_result(msg: dict) -> bool:
    c = msg.get("content")
    return (msg["role"] == "user" and isinstance(c, list)
            and any(getattr(b, "type", None) == "tool_result"
                    or (isinstance(b, dict) and b.get("type") == "tool_result")
                    for b in c))`,
      explanation:
        "The boundary shuffle is the part everyone gets wrong first: if the kept region begins with a `tool_result`, its `tool_use` partner just got summarized away and your next API call 400s. Also note the summarizer runs at temperature 0 with an explicit preservation list — a freestyle summary will smooth away the exact constraint you most needed.",
    },
    {
      type: "callout",
      kind: "warning",
      title: "Compaction is lossy. Prove the agent survives it.",
      text: "Every compaction discards information — the only question is whether it discards anything *load-bearing*. So test it like the failure mode it is: plant a constraint early in a long scripted conversation, force compaction, then ask a question whose correct answer depends on that constraint. If the agent violates it, your summarizer prompt (or your untouchables list) is broken. Lab 04 requires exactly this test.",
    },
    {
      type: "code",
      language: "python",
      title: "a compaction regression test",
      code: `def test_constraint_survives_compaction():
    messages = [
        {"role": "user", "content":
         "We're refactoring billing. Constraint: never modify files "
         "under legacy/ - they are frozen for the audit."},
        {"role": "assistant", "content": "Noted: legacy/ is frozen."},
    ]
    # ... pad with 40 turns of filler work until compaction triggers ...
    messages = pad_with_filler_turns(messages, turns=40)
    compacted = maybe_compact(messages, SYSTEM_PROMPT)
    assert len(compacted) < len(messages), "compaction should have fired"

    compacted.append({"role": "user", "content":
        "Quick cleanup: delete the unused helpers in legacy/utils.py?"})
    resp = client.messages.create(model=MODEL, max_tokens=400,
                                  system=SYSTEM_PROMPT, messages=compacted)
    answer = resp.content[0].text.lower()
    assert "frozen" in answer or "legacy" in answer and "no" in answer.split(".")[0], (
        "agent forgot the frozen-directory constraint after compaction")`,
      explanation:
        "This is behavior-level testing: don't inspect the summary text (brittle), verify the *agent still acts correctly* after compaction. Keep two or three of these planted-constraint scenarios in your suite and run them whenever you touch the summarizer prompt — summarizer prompts regress silently.",
    },
    {
      type: "keypoints",
      points: [
        "Compact at ~75% of budget — before you're forced to, leaving headroom for the summary call itself.",
        "Untouchables: system prompt, active task state, standing constraints, exact IDs/paths/numbers, recent turns.",
        "Never split a `tool_use` from its `tool_result`; move the cut to a clean turn boundary or the API 400s.",
        "Summarize with temperature 0 and an explicit preservation list; freestyle summaries smooth away constraints.",
        "Test compaction behaviorally: plant a constraint, force compaction, verify the agent still honors it.",
      ],
    },
  ],
};
