import type { Lesson } from "@/lib/types";

export const lesson04: Lesson = {
  slug: "write-path-and-read-path",
  title: "The Write Path & the Read Path",
  minutes: 40,
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
        model="claude-sonnet-5", max_tokens=10,
        messages=[{"role": "user", "content":
            "Do these two statements contradict each other? "
            "Answer only CONTRADICTS or COMPATIBLE.\\n"
            f"A: {old_fact}\\nB: {new_fact}"}],
    )
    verdict = next(b.text for b in resp.content if b.type == "text")
    return verdict.strip().upper()

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
      type: "callout",
      kind: "warning",
      title: "Delete is the lifecycle's third verb",
      text: "Everything above versions rather than deletes — by design, superseding preserves the evidence a wrong resolution needs. But \"never truly delete\" collides with a real requirement: GDPR-style right-to-erasure means a user (or a legal request) can demand a fact be actually gone, not superseded-and-retained. Treat these as two different operations with two different triggers: **supersede** is a business-logic event (a fact changed) and stays the default; **hard delete** is a compliance event (this specific data must not exist anymore) and must cascade — the row, its embedding, any log line that echoed the fact verbatim, and any backup that hasn't rolled off retention. A memory system that can version but can't truly erase isn't finished; Lesson 5 picks this up as a security and retention concern, not just a data-modeling one.",
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "Two overlapping sessions for the same user run concurrently against the same `MemoryStore`. Both extract the candidate fact \"user deploys on Fridays\" within the same second and both call `write_fact`. Walk through what happens, and name the bug.",
      answer:
        "`write_fact` reads `store.all_active()` fresh, computes similarity against the *current* rows, and only calls `store.add()` if nothing scores ≥ `DUP_THRESHOLD`. With two concurrent callers, both read the active set **before either write has landed** — a classic check-then-act race. Both see 'no duplicate exists,' both proceed to `store.add()`, and you end up with two near-identical rows that will only get reconciled on some *future* write's dedupe check, not this one. In the meantime, `recall()` can return both, and a stingy top-k might present the same fact twice while crowding out something else. This isn't a hypothetical for busy agents — any product where a user can have two sessions open (a web tab and a mobile app, or two background jobs touching the same account) hits it. Fixes, cheapest first: serialize writes per user (a lock or a single-writer queue in front of the store — the simplest fix for most products' actual concurrency level); or push the uniqueness check into the database as a real constraint plus a transaction with adequate isolation, so the check-then-act happens atomically instead of in application code; or accept the duplicate and let a periodic reconciliation pass merge near-identical rows. What doesn't work: adding more application-level 'check again before inserting' code, since that just narrows the race window without closing it.",
    },
    {
      type: "heading",
      text: "Two ways to trigger the write: explicit tool vs background job",
    },
    {
      type: "paragraph",
      text: "This lesson's write path runs as a **background extraction job**: at session end, a forced tool call distills the whole transcript into candidates, uniformly, whether or not the model itself noticed anything worth remembering. There's a second shape worth knowing for interviews: an **explicit memory tool** the model calls *during* the session — \"I should remember this\" becomes a tool_use block the moment the model decides it matters, the same pattern a client-side memory tool exposes as a directory of files the model reads and writes with ordinary file operations. The two aren't just implementation variants; they trade different things.",
    },
    {
      type: "table",
      headers: ["Write trigger", "What you gain", "What you risk"],
      rows: [
        [
          "Explicit tool (model calls it mid-session)",
          "Agency and visibility — the write is a plain tool_use block in the trace, timed exactly when the model judged something durable; no separate extraction pass or session-end latency",
          "Coverage — a fact the model doesn't think to flag never gets written; quality depends on the model's in-the-moment judgment, which is inconsistent across sessions and models",
        ],
        [
          "Background extraction job (this lesson)",
          "Coverage and consistency — every session gets the same uniform pass, independent of whether the model happened to notice anything; easy to route through a single write-path gauntlet",
          "Delay and opacity — nothing is written until the job runs, and it's a second LLM call reasoning about a transcript it didn't generate live, with less context than the model had in the moment",
        ],
      ],
    },
    {
      type: "paragraph",
      text: "Production systems increasingly run both: an explicit tool for high-confidence, in-the-moment saves the model is confident about, and a background extraction pass as a safety net that catches what the model didn't think to flag. Whichever you pick, the write-path gauntlet from this lesson — provenance screen, dedupe, contradiction check — applies identically; the trigger changes *when* a candidate is proposed, not what happens to it once it is.",
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
      type: "heading",
      text: "Two read-path shapes: injection vs retrieval-as-a-tool",
    },
    {
      type: "paragraph",
      text: "This lesson's `recall()` runs at session start and **injects** the result into the system prompt — the model never has to ask for its own memories, they're just there. The alternative is **retrieval-as-a-tool**: expose a `search_memory(query)` tool and let the model call it when it judges memory might help, the same shape as any other retrieval tool from Module 3. The choice is really about scale and certainty, not correctness.",
    },
    {
      type: "table",
      headers: ["Read shape", "When it wins", "Cost"],
      rows: [
        [
          "Injection at session start (this lesson)",
          "Small, cheap-to-score memory sets per user (tens to low hundreds of facts) where \"probably relevant to any task\" is a safe bet",
          "Pays the retrieval cost on every session even when memory turns out irrelevant that turn; doesn't scale to memory stores too large to score cheaply up front",
        ],
        [
          "Retrieval-as-a-tool",
          "Large or fast-growing memory stores where scoring everything up front is expensive, or where relevance genuinely depends on the specific task at hand",
          "Coverage risk — a model that doesn't think to search never recalls anything; adds a round-trip's latency exactly when it's used",
        ],
      ],
    },
    {
      type: "paragraph",
      text: "The same relevance/recency/importance scoring from this lesson applies either way — injection scores everything and takes the top-k up front, retrieval-as-a-tool scores against the query the model actually issues. A hybrid is common in practice: inject a handful of the highest-importance standing facts (the procedural \"always lints before committing\" kind), and expose the rest via a tool for anything more specific.",
    },
    {
      type: "callout",
      kind: "warning",
      title: "Context poisoning: the self-inflicted wound",
      text: "**Context poisoning** is bad content in the window steering generation — and over-eager recall is its most common *self-inflicted* form. Every recalled memory arrives with the implicit authority of \"known background fact\"; an irrelevant, stale, or wrong memory doesn't just waste tokens, it actively tilts answers. Symptoms: the agent keeps bringing up an old project, applies last month's constraint to this month's task, addresses the user by a stale detail. Treat recall like seasoning — the dish should work with none.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Why not just let the model call a `save_memory` tool whenever it wants, instead of this whole background extraction pipeline?"',
      answer:
        "Because the two trade agency for coverage, and neither one alone is safe to ship. An explicit tool gives you agency and visibility — the write happens exactly when the model judges something durable, as a plain tool_use block you can see in the trace — but coverage depends entirely on the model noticing in the moment, and models are inconsistent about that across sessions, especially under time pressure late in a long conversation. A background extraction job gives you uniform coverage — every session gets the same distillation pass regardless of what the model happened to flag — but it's opaque and delayed: nothing is written until the job runs, and that job is reasoning about a transcript after the fact with less context than the model had live. My actual answer: run both. Let the model call an explicit tool for high-confidence in-the-moment saves, and keep a background extraction pass as the safety net that catches what it didn't think to flag — and route *both* through the same write-path gauntlet from this lesson, because the trigger only changes when a candidate is proposed, not whether it needs a provenance screen and a contradiction check. **Follow-up probe:** \"doesn't that mean paying for two extraction mechanisms?\" → the background job usually gets cheaper once the explicit tool is in place, since it's now catching a smaller residual of what wasn't already saved live — tune it as a lower-cost, lower-frequency pass rather than the primary mechanism.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Your memory store just grew from 200 facts per user to 200,000 total across all users. What changes about your read path?"',
      answer:
        "Two things, and they're independent. First, if that 200,000 is spread across many users at roughly 200 each, the *per-session* read path barely changes — you're still scoring a couple hundred candidates for the user in front of you, which is cheap; what changes is that you now need real per-user isolation at the storage layer, not just at scoring time, because a shared index without a hard user_id filter turns 'irrelevant to this user' into 'a cross-tenant leak waiting for the wrong coincidence' — that's Lesson 5's territory, and it's the first thing I'd audit. Second, if the growth is genuinely per-user — a single account with tens of thousands of facts — brute-force cosine over the active set stops being 'microseconds' and injection-at-session-start stops being the obvious default: that's when I'd reach for retrieval-as-a-tool, or at minimum an ANN index (Module 3's vector-DB lesson) instead of a linear scan, and I'd expect the top-k and minimum-score floor to matter more, not less, since a bigger candidate pool means more near-miss noise clearing a loose threshold. **Follow-up probe:** \"how would you notice this had become a problem before a user complained?\" → log recall latency and candidate-pool size per call, and alert on the pool size crossing whatever threshold your brute-force scan stops being cheap at — that's a metric you can graph, not a judgment call you make once.",
    },
    {
      type: "keypoints",
      points: [
        "Write path gauntlet: extract → provenance screen → dedupe (≥0.90 sim) → contradiction check (same-topic zone + LLM judge) → store.",
        "Contradictions: version both with timestamps, supersede the old, prefer newer at recall, flag the conflict — overwrite only trivia, ask only for high-stakes facts.",
        "Recall score = 0.6·relevance + 0.25·recency (exponential decay) + 0.15·importance — then a stingy top-k AND a minimum-score floor.",
        "Nothing clearing the bar → inject nothing. Empty beats misleading.",
        "Over-eager recall is self-inflicted context poisoning; log every recall decision.",
        "Write triggers are a spectrum: an explicit memory tool trades coverage for agency and visibility; a background extraction job trades agency for uniform coverage — production systems often run both through the same gauntlet.",
        "Read shapes are a spectrum too: inject for small, cheap-to-score memory sets; retrieve-as-a-tool once scale or task-specificity makes scoring everything upfront wasteful.",
        "Supersede is the default for contradictions; hard delete is a separate, compliance-driven operation that must cascade to embeddings, logs, and backups — versioning isn't a substitute for actual erasure.",
      ],
    },
  ],
};
