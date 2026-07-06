import type { Lesson } from "@/lib/types";

export const lesson02: Lesson = {
  slug: "compaction-and-summarization",
  title: "Compaction: Summarizing Without Losing the Plot",
  minutes: 35,
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
        model=MODEL, max_tokens=1_500,
        system=SUMMARIZER_PROMPT,
        messages=old + [{"role": "user", "content":
                         "Now produce the summary of everything above."}],
    )
    summary = next(b.text for b in resp.content if b.type == "text")
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
        "The boundary shuffle is the part everyone gets wrong first: if the kept region begins with a `tool_result`, its `tool_use` partner just got summarized away and your next API call 400s. Also note the summarizer runs with an explicit preservation list baked into the system prompt — a freestyle summary will smooth away the exact constraint you most needed.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
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

def maybe_compact(messages: list[dict], instructions: str) -> list[dict]:
    if count(messages, instructions) < COMPACT_AT * WINDOW_BUDGET:
        return messages

    cut = len(messages) - KEEP_RECENT
    # never orphan a function_call_output from its function_call: shift the
    # cut to a boundary where the next kept item starts a fresh user turn
    while cut > 0 and is_function_call_output(messages[cut]):
        cut -= 1
    old, recent = messages[:cut], messages[cut:]
    if not old:
        return messages     # nothing safely compactable; raise budget or digest tools harder

    resp = client.responses.create(
        model=MODEL,
        instructions=SUMMARIZER_PROMPT,
        input=old + [{"role": "user", "content":
                      "Now produce the summary of everything above."}],
    )
    summary = resp.output_text
    return [
        {"role": "user", "content":
         f"<conversation_summary>\\n{summary}\\n</conversation_summary>"},
        {"role": "assistant", "content": "Understood. Continuing from that summary."},
    ] + recent

def is_function_call_output(msg: dict) -> bool:
    # Responses histories interleave role messages with function_call /
    # function_call_output items; the strict pairing rule applies to those
    return isinstance(msg, dict) and msg.get("type") == "function_call_output"`,
          explanation:
            "The Responses API *offers* server-side conversation state (`previous_response_id`) that would spare you resending history — deliberately unused here, because compaction only works if you own the message list, so this pattern stays stateless like the Claude version. The pairing rule survives the translation with new names: never let the cut orphan a `function_call_output` item from its `function_call`, or the next call is rejected exactly as Anthropic rejects a stranded `tool_result`.",
        },
      ],
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
    text = next(b.text for b in resp.content if b.type == "text")
    answer = text.lower()
    assert "frozen" in answer or "legacy" in answer and "no" in answer.split(".")[0], (
        "agent forgot the frozen-directory constraint after compaction")`,
      explanation:
        "This is behavior-level testing: don't inspect the summary text (brittle), verify the *agent still acts correctly* after compaction. Keep two or three of these planted-constraint scenarios in your suite and run them whenever you touch the summarizer prompt — summarizer prompts regress silently.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
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
    resp = client.responses.create(model=MODEL,
                                   instructions=SYSTEM_PROMPT,
                                   input=compacted)
    answer = resp.output_text.lower()
    assert "frozen" in answer or "legacy" in answer and "no" in answer.split(".")[0], (
        "agent forgot the frozen-directory constraint after compaction")`,
          explanation:
            "The test is provider-agnostic by design — only the final call changes: `instructions=` + `input=` + `resp.output_text` replace `system=` + `messages=` + walking content blocks. The assertion targets behavior, not summary wording, so it ports across providers (and across your own summarizer rewrites) unchanged.",
        },
      ],
    },
    {
      type: "heading",
      text: "Compaction fights your prompt cache",
    },
    {
      type: "paragraph",
      text: "Compaction has a cost this lesson hasn't priced yet: **it fights prompt caching**. Module 2 Lesson 5 covers the mechanics in full — caching is an exact-prefix match, and every compaction pass rewrites the message array starting at the cut point, which invalidates the cached prefix from that byte forward. Concretely: a session that was enjoying high `cache_read_input_tokens` on every call suddenly re-prefills its entire history at full price the moment `maybe_compact` fires, because the rewritten summary block sits early in the array and nothing after it can reuse the old cache entry. The fix is the same one taught there — compact **rarely and in batches** (the 75% threshold in this lesson's code is already doing that job, not compacting every turn) — and the same amortization inequality applies: tokens saved per call, times calls remaining, has to beat the cost of one full uncached re-prefill. If your `COMPACT_AT` threshold is tuned to trip on nearly every turn, you're paying that re-prefill tax constantly for a marginal context-size win — watch `cache_read_input_tokens` in the trace before and after a compaction pass to confirm the trade is actually paying off.",
    },
    {
      type: "heading",
      text: "What the summary can drop",
    },
    {
      type: "table",
      headers: ["Category", "Keep verbatim", "Safe to compress or drop"],
      rows: [
        [
          "Tool call outcomes",
          "The final result a decision depended on",
          'The intermediate retries, false starts, and commands that didn\'t pan out — keep "grep found nothing in src/, then found it in lib/", drop the five failed greps in between',
        ],
        [
          "Exploration",
          "The conclusion reached",
          "The back-and-forth that reached it — a debugging session that tried four hypotheses only needs to remember the one that found the bug",
        ],
        [
          "Chit-chat / acknowledgments",
          "—",
          'Everything — "Sounds good, thanks!" carries no task state',
        ],
        [
          "Errors",
          "The error that changed behavior (e.g. triggered a constraint)",
          "Errors that were retried and resolved with no lasting effect",
        ],
      ],
    },
    {
      type: "heading",
      text: "Provider-native compaction",
    },
    {
      type: "paragraph",
      text: "As of this module, server-side compaction exists as a beta API feature on several frontier models: instead of writing `maybe_compact` yourself, the server auto-summarizes older context when a session approaches a configured token threshold, and returns a compaction block you pass back verbatim on the next call (extracting only the text and discarding the block loses the compaction state). It's the same idea this lesson teaches — cheaper to adopt, but a black box: you don't control the preservation list, so the planted-constraint regression test above matters *more*, not less, because you can't read the summarizer prompt to sanity-check it. Hand-rolling stays the right call when you need a domain-specific preservation list (this lesson's exact-values-and-constraints instruction), multi-provider portability, or a compaction trigger tied to something other than token count.",
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        'A teammate "simplifies" `maybe_compact` by deleting the boundary-shift loop, since "the tests pass on our scripted conversation":',
      code: `cut = len(messages) - KEEP_RECENT
old, recent = messages[:cut], messages[cut:]
# (the "while cut > 0 and starts_with_tool_result(messages[cut]): cut -= 1"
#  line has been deleted entirely)`,
      language: "python",
      answer:
        "Their tests happened to land the cut on a clean turn boundary every time — a scripted conversation with predictable turn lengths does that by luck, not by guarantee. In production, `KEEP_RECENT` messages back from the end can land in the *middle* of a tool_use/tool_result pair just as easily as between turns, since real sessions have variable-length tool loops (one turn might be a single reply, another five tool calls deep). When that happens, `recent` starts with a `tool_result` whose matching `tool_use` just got swept into `old` and summarized away — Module 1's strict pairing rule fires, and the next API call 400s with a malformed-history error, intermittently and only on the sessions unlucky enough to hit that alignment. The fix is exactly the deleted loop: shift the cut backward until the kept region starts at a clean turn boundary, never mid-pair. The broader lesson: a boundary condition that 'happens to hold' on your test fixtures because of how you built the fixtures, not because of an invariant in the code, will eventually meet a fixture that breaks it — test with variable-length tool loops, not just one shape of conversation.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"Your compaction threshold is 75% of budget. A teammate wants to drop it to 50% to 'never risk running out of room.' What's wrong with that instinct?\"",
      answer:
        "It trades a rare, cheap problem for a constant, expensive one. Compacting more often means paying the cache-invalidation tax (above) more often — every compaction pass re-prefills the history at full price on the next call, so halving the threshold roughly doubles how often you eat that cost, for headroom you're not actually using. It also means summarizing more aggressively and more frequently, which is exactly where information loss compounds — every summarization pass is another lossy transformation, and doing it twice as often multiplies the chances a load-bearing detail gets smoothed away somewhere along the chain. The right instinct isn't 'compact earlier to be safe,' it's 'compact at a threshold that leaves headroom for the summary call itself and the next big tool result, and no earlier.' 75% is a reasonable default because it accounts for exactly that headroom, not because it's a round number. **Follow-up probe:** \"how would you tell if 75% is actually the right number for this agent?\" → look at what triggers compaction in the trace — if sessions frequently blow *past* 75% before the next natural check-in point (e.g. a single huge tool result pushes past budget in one jump), you need a lower threshold or per-component caps; if compaction rarely fires and cache hit rates are healthy, you have room to raise it.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "How do you prove compaction didn\'t quietly break your agent, beyond eyeballing that the summary reads fine?"',
      answer:
        "Test it as the failure mode it is, behaviorally, not by reading the summary text. The recipe this lesson uses: plant a constraint early in a long scripted conversation ('never touch files under legacy/'), pad with enough filler turns to force compaction, then ask a question whose *correct* answer depends on the agent still honoring that constraint — assert on the agent's behavior, not on whether the word 'legacy' appears in the summary string. Reading the summary is brittle and gives false confidence: a summary can *mention* a constraint and the agent can still violate it three turns later if the phrasing lost its imperative force. Keep two or three of these planted-constraint scenarios covering different categories — a standing prohibition, an exact numeric value, a file path — in your regression suite, and run them every time the summarizer prompt changes, because summarizer prompts regress silently: a small rewording that reads *better* to a human can be strictly worse at surviving into agent behavior. **Follow-up probe:** \"what if you're on provider-native compaction and can't read the summarizer prompt at all?\" → the behavioral test matters even more — it's your only signal, since you can't inspect or tune what the server's summarizer preserves, so treat it as a black-box regression gate you run before every model or API version bump.",
    },
    {
      type: "keypoints",
      points: [
        "Compact at ~75% of budget — before you're forced to, leaving headroom for the summary call itself.",
        "Untouchables: system prompt, active task state, standing constraints, exact IDs/paths/numbers, recent turns.",
        "Never split a `tool_use` from its `tool_result`; move the cut to a clean turn boundary or the API 400s.",
        "Summarize with an explicit preservation list; freestyle summaries smooth away constraints.",
        "Test compaction behaviorally: plant a constraint, force compaction, verify the agent still honors it.",
        "Compaction fights prompt caching: every rewrite invalidates the cached prefix from the cut point forward — compact rarely, in batches, and watch cache_read_input_tokens to confirm the trade pays off (Module 2 Lesson 5).",
        "A summary should keep decisions, constraints, and exact values; it should drop resolved retries, dead-end exploration, and chit-chat — compressing to conclusions, not transcripts.",
        "Server-side compaction now exists as a beta API feature; it changes who writes the summarizer, not the need to behaviorally test what survives.",
      ],
    },
  ],
};
