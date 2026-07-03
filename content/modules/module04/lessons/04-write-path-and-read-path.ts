import type { Lesson } from "@/lib/types";

export const lesson04: Lesson = {
  slug: "write-path-and-read-path",
  title: "The Write Path & the Read Path",
  minutes: 30,
  summary:
    "Between 'candidate fact' and 'stored fact' sits a gauntlet: dedupe, contradiction check, provenance gate. Between 'stored fact' and 'in the prompt' sits another: relevance + recency + importance scoring, with a stingy top-k. Both gauntlets exist because recalled junk is context poisoning.",
  sections: [
    {
      type: "paragraph",
      text: "A memory system is two pipelines. The **write path** decides what becomes a memory; the **read path** decides what a given session gets to see. Most memory failures are gate failures: a write path that stores everything breeds a landfill; a read path that recalls eagerly shovels the landfill into the prompt. Discipline at both gates is the entire game.",
    },
    {
      type: "heading",
      text: "The write path",
    },
    {
      type: "list",
      ordered: true,
      items: [
        "**Extract** candidate facts from the session (Lesson 3's forced structured call).",
        '**Screen provenance**: facts stated directly by the user pass; "facts" originating in content the agent merely *read* (files, web pages, tool output) are quarantined for review — this is the injection gate, detailed in Lesson 5.',
        "**Deduplicate**: embedding similarity against existing memories. Near-identical → skip (optionally refresh the timestamp).",
        "**Contradiction check**: same *topic*, incompatible *content* — similar-but-not-identical embeddings plus an LLM judgment. On contradiction: keep both, timestamped, mark the old one superseded, prefer the newer at recall, and flag the conflict.",
        "**Store** with provenance, timestamp, importance.",
      ],
    },
    {
      type: "code",
      language: "python",
      title: "write path: dedupe + contradiction resolution",
      code: `DUP_THRESHOLD = 0.90      # near-identical: skip
TOPIC_THRESHOLD = 0.70    # same topic: check for contradiction

def judge_contradiction(new_fact: str, old_fact: str) -> str:
    resp = client.messages.create(
        model="claude-sonnet-4-5", max_tokens=10, temperature=0,
        messages=[{"role": "user", "content":
            "Do these two statements contradict each other? "
            "Answer only CONTRADICTS or COMPATIBLE.\\n"
            f"A: {old_fact}\\nB: {new_fact}"}],
    )
    return resp.content[0].text.strip().upper()

def write_fact(store: MemoryStore, candidate: dict) -> str:
    vec = encoder.encode(candidate["fact"], normalize_embeddings=True)
    for mem in store.all_active():
        sim = float(vec @ mem["vec"])
        if sim >= DUP_THRESHOLD:
            return f"skipped duplicate of #{mem['id']}"
        if sim >= TOPIC_THRESHOLD:
            if judge_contradiction(candidate["fact"], mem["fact"]) == "CONTRADICTS":
                new_id = store.add(candidate["fact"], candidate["provenance"],
                                   candidate["importance"])
                store.db.execute(
                    "UPDATE memories SET superseded_by = ? WHERE id = ?",
                    (new_id, mem["id"]))
                store.db.commit()
                log_conflict(old=mem, new_id=new_id)   # surface, don't hide
                return f"stored #{new_id}, superseded #{mem['id']} (conflict flagged)"
    new_id = store.add(candidate["fact"], candidate["provenance"],
                       candidate["importance"])
    return f"stored #{new_id}"`,
      explanation:
        'The two thresholds carve embedding space into three zones: duplicate (skip), same-topic (escalate to the LLM judge — cosine similarity alone cannot tell "deploys on Fridays" from "no longer deploys on Fridays"; they embed *close*), and unrelated (store). Superseding rather than deleting preserves history: if the resolution was wrong, the evidence still exists.',
    },
    {
      type: "table",
      headers: ["Resolution option", "When it's right", "Risk"],
      rows: [
        [
          "Update in place (overwrite)",
          "Pure corrections of transient values where history is worthless",
          "Destroys evidence; wrong for anything ambiguous",
        ],
        [
          "Version both, prefer newer (default)",
          "Preference/state changes over time — the usual case",
          "Recall must consistently pick the winner",
        ],
        [
          "Ask the user",
          "High-stakes facts (billing, permissions, contact info)",
          "Interrupts; save it for what matters",
        ],
        [
          "Expire/decay",
          'Facts with natural shelf life ("working on the Q3 launch")',
          "Choosing honest TTLs is guesswork",
        ],
      ],
    },
    {
      type: "heading",
      text: "The read path",
    },
    {
      type: "paragraph",
      text: 'At session start (or before a task), score every active memory against the current context and inject only the top few. Pure embedding relevance isn\'t enough: a highly similar but two-year-old fact may be stale, and a modestly similar but critical constraint ("never email the client directly") must surface anyway. The standard recipe is a weighted blend of **relevance** (embedding similarity), **recency** (exponential decay), and **importance** (assigned at write time) — the scoring popularized by the generative-agents line of work.',
    },
    {
      type: "code",
      language: "python",
      title: "read path: blended recall scoring, stingy top-k",
      code: `import time
import numpy as np

W_RELEVANCE, W_RECENCY, W_IMPORTANCE = 0.60, 0.25, 0.15
HALF_LIFE_DAYS = 30.0

def recall(store: MemoryStore, query_text: str, k: int = 5,
           min_score: float = 0.35) -> list[dict]:
    q = encoder.encode(query_text, normalize_embeddings=True)
    now = time.time()
    scored = []
    for mem in store.all_active():
        relevance = float(q @ mem["vec"])                     # [-1, 1]
        age_days = (now - mem["created_at"]) / 86_400
        recency = 0.5 ** (age_days / HALF_LIFE_DAYS)          # (0, 1]
        score = (W_RELEVANCE * relevance
                 + W_RECENCY * recency
                 + W_IMPORTANCE * mem["importance"])
        scored.append((score, mem))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [m for s, m in scored[:k] if s >= min_score]       # floor matters

# injected via assemble_window() from Lesson 1 — fenced, labeled untrusted
memories = [m["fact"] for m in recall(store, current_task_description)]`,
      explanation:
        "Two safety valves beyond the blend: a hard **top-k cap** (five facts, not fifty) and a **minimum-score floor** — if nothing clears the bar, inject *nothing*. An empty memory block is strictly better than a misleading one. Tune the weights against your Lab 04 demo script, and log every recall decision: 'why did the agent bring *that* up?' should always be answerable from logs.",
    },
    {
      type: "callout",
      kind: "warning",
      title: "Context poisoning: the self-inflicted wound",
      text: "**Context poisoning** is bad content in the window steering generation — and over-eager recall is its most common *self-inflicted* form. Every recalled memory arrives with the implicit authority of \"known background fact\"; an irrelevant, stale, or wrong memory doesn't just waste tokens, it actively tilts answers. Symptoms: the agent keeps bringing up an old project, applies last month's constraint to this month's task, addresses the user by a stale detail. Treat recall like seasoning — the dish should work with none.",
    },
    {
      type: "keypoints",
      points: [
        "Write path gauntlet: extract → provenance screen → dedupe (≥0.90 sim) → contradiction check (same-topic zone + LLM judge) → store.",
        "Contradictions: version both with timestamps, supersede the old, prefer newer at recall, flag the conflict — overwrite only trivia, ask only for high-stakes facts.",
        "Recall score = 0.6·relevance + 0.25·recency (exponential decay) + 0.15·importance — then a stingy top-k AND a minimum-score floor.",
        "Nothing clearing the bar → inject nothing. Empty beats misleading.",
        "Over-eager recall is self-inflicted context poisoning; log every recall decision.",
      ],
    },
  ],
};
