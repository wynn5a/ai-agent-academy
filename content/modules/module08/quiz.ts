import type { QuizQuestion } from "@/lib/types";

export const quiz08: QuizQuestion[] = [
  {
    question:
      "Why is 'handles simple, well-specified bug-fix issues in Python repos under 10k LOC' a strong scope statement for the capstone?",
    options: [
      "It signals ambition to recruiters while staying vague enough that no reviewer can hold the agent to a measurable success rate, so the demo can never technically fall short of its claims",
      "Precise, honest scoping is itself a seniority signal; a reliably narrow agent beats a flaky general one, and it becomes the first line of your limitations doc",
      "Narrow scope keeps the hardest failure modes out of the eval set entirely, so reviewers only ever see flattering numbers and never think to probe what lies outside the boundary",
      "Ten thousand lines is roughly where every context window tops out, so the ceiling is a shared technical limit of current models rather than a scoping choice you made",
    ],
    correct: 1,
    explanation:
      "Stating scope that precisely signals judgment. Reliability on a narrow task beats flaky breadth, and the sentence doubles as the top of your limitations doc — honesty reviewers reward.",
  },
  {
    question:
      "Why is codebase exploration fundamentally a retrieval problem for this capstone?",
    options: [
      "Because models can only reliably reason over code that resembles their training data, so an unfamiliar repo has to be converted into embeddings before the model can make sense of it at all",
      "Because chunk-embed-search is the standard RAG recipe, and semantic similarity to the issue text ranks candidate files more reliably than the exact symbol matches a grep would return",
      "A 10k-LOC repo far exceeds any context window, so you must locate and feed only the handful of relevant files — get this wrong and the model plans against files it never saw",
      "Because GitHub rate-limits file reads, so the agent must batch-retrieve the repo once up front and work from that snapshot for the rest of the run",
    ],
    correct: 2,
    explanation:
      "You can't paste a whole repo into context. Exploration must find the few files that matter; everything downstream degrades if the agent plans against code it never actually read.",
  },
  {
    question:
      "For a coding agent locating a specific bug, why does agentic grep-and-read often beat pure embedding-based retrieval?",
    options: [
      "Source code carries too little natural-language signal for embedding models, so semantic search over a repo returns effectively random chunks and has no place anywhere in the pipeline",
      "Bugs are typically about specific symbols, error strings, and call sites, which grep-and-read navigation surfaces precisely; semantic search is better for concept-level questions, so combine them",
      "Grep runs locally with no API calls or embedding costs, and since retrieval latency dominates the exploration loop's budget, the faster primitive wins regardless of the kind of question being asked",
      "Agentic navigation reads only the exact lines it needs, so it consumes strictly fewer tokens than embedding retrieval on every repo and every query type",
    ],
    correct: 1,
    explanation:
      "A bug usually hinges on an exact symbol or error string and its call sites — grep-and-read follows those like a human engineer. Semantic search shines for 'where is X handled?' The practical answer combines: seed with semantic search, confirm and expand with grep/read.",
  },
  {
    question:
      "What is the main advantage of search/replace edits over full-file rewrites for bug fixes?",
    options: [
      "Small, reviewable diffs with minimal tokens and low collateral risk — no chance of the model rewriting a whole file and silently dropping unrelated code; its one failure mode (block mismatch) is easy to detect and recover from",
      "Exact-block matching is robust by construction — the model just read the file, so the old block always matches the current text, and search/replace edits apply cleanly without any error handling, staleness guard, or re-read-and-retry path",
      "Full-file rewrites can't represent a localized change, because the model must regenerate every line from scratch, so search/replace is the only strategy able to produce a diff smaller than the file itself",
      "Unified diffs are git's native patch format and search/replace blocks compile down to them, so the toolchain requires edits in this shape before a commit can be created",
    ],
    correct: 0,
    explanation:
      "Bug fixes are localized, so search/replace yields tight diffs a human reviews in seconds and avoids the full-rewrite risk of dropping code. When the old block doesn't match exactly, return an error and let the model re-read and retry.",
  },
  {
    question:
      "Why must the repair loop write a test that reproduces the bug and fails BEFORE the fix?",
    options: [
      "It's TDD etiquette carried over from human workflows; for an agent the ordering is cosmetic, since running the suite after the fix hands the loop the same green signal either way",
      "A reproducing red test is the only proof the fix actually addresses the bug; without it a 'fix' might do nothing or patch a symptom while missing the cause",
      "Writing the test after the fix would trip the staleness guard, because the test file's content hash changes after the source files were last read",
      "A test-plus-fix diff looks more substantial at the HITL gate, and reviewers approve changes faster when the PR shows visible testing effort",
    ],
    correct: 1,
    explanation:
      "Red-before-green is verification: the test must fail on the buggy code and pass after the fix. A fix with no reproducing test is unverified and may be doing nothing or fixing the wrong thing.",
  },
  {
    question:
      "Why must the test-driven repair loop be bounded (e.g., max 5 attempts)?",
    options: [
      "Each retry appends a full pytest traceback to the conversation, so after about five attempts the context window is guaranteed to overflow and the API call itself starts failing",
      "Pass@k scoring assumes exactly k attempts per issue, so the loop must stop at five for its numbers to stay comparable with published SWE-bench figures",
      "Scarcity sharpens the model: knowing attempts are limited makes it reason more carefully on each one, so the cap is primarily a quality lever rather than a cost control",
      "A confused agent can otherwise loop forever, burning budget; a hard cap makes it fail cleanly and become a scored 'exhausted' outcome for your eval",
    ],
    correct: 3,
    explanation:
      "Without a cap, a stuck agent spins and burns money indefinitely. A bounded loop fails cleanly, and 'exhausted retries' becomes a meaningful category in your partial-success taxonomy.",
  },
  {
    question:
      "When the model says it's finished fixing the bug, what should the loop do?",
    options: [
      "Accept the completion signal — the stop reason switching from tool_use to end_turn is the API's own confirmation that work is finished, so the loop can hand straight off to the PR stage",
      "Run the test suite independently and, if tests still fail, push the failures back and continue — never take the model's word for success",
      "Ask it to self-report a confidence score and re-run the suite only below a threshold, since a calibrated confidence check is far cheaper than executing every test on each declared finish",
      "Restore the .bak backups and restart the attempt, since a completion claim arriving before the retry cap usually means the red test was skipped",
    ],
    correct: 1,
    explanation:
      "Models declare victory prematurely. The loop verifies independently by running the suite; if it lied, feed the failing output back and keep going until tests actually pass or retries are exhausted.",
  },
  {
    question:
      "Why is opening a PR treated as an irreversible action requiring an HITL gate?",
    options: [
      "Every PR kicks off the repo's CI pipeline, and compute-billed CI runs on each agent proposal add up quickly, so the human's role is throttling spend by batching approvals",
      "Closing an unwanted PR is trivial, so the gate isn't really about reversibility — it exists to collect a human label on every proposal so the eval set accumulates ground truth over time",
      "It's a consequential, hard-to-undo action against a real repo; the gate shows a human the diff, tests, and cost, logs the decision, and defaults to reject on timeout — also the backstop against a malicious issue's injected instructions",
      "GitHub tokens are scoped to draft creation under least privilege, so only a human with elevated permissions can flip the draft to ready-for-review",
    ],
    correct: 2,
    explanation:
      "Opening a PR touches a real repo and is exactly the consequential action Module 7's HITL pattern guards. The human reviews the actual diff before anything ships — which also defends against injected instructions in the issue text.",
  },
  {
    question:
      "What should a self-assembled SWE-bench-style eval set contain, and why?",
    options: [
      "A curated set of issues the agent already handles well, since the eval's job is demonstrating the happy path and the limitations doc separately covers whatever it can't do",
      "≥10 issues mixing real OSS bugs and bugs you seed yourself (bug + issue + known-good fix), so you have ground truth to score automatically",
      "One genuinely hard multi-file issue, because depth beats breadth — a single convincing solve demonstrates more capability than ten simple bugs would",
      "Only live issues from active OSS repos, never seeded bugs — knowing the fix in advance contaminates the eval and biases the scoring toward your own agent",
    ],
    correct: 1,
    explanation:
      "Ground truth is what makes automatic scoring possible: for each issue you know the correct fix, so you can check whether the reproducing test passes without breaking existing tests. Seeding bugs gives you controlled cases; real issues give realism.",
  },
  {
    question:
      "Why report a partial-success taxonomy instead of just a pass/fail rate?",
    options: [
      "A multi-row taxonomy table reads as more rigorous to reviewers than one headline number, even when the extra categories wouldn't change any engineering decision you'd actually make",
      "Partial credit is what pass@k exists to quantify, and reporting a taxonomy is the standard mechanism for converting a batch of pass@1 runs into a figure comparable with published pass@k leaderboard numbers",
      "SWE-bench-style scoring mandates the standard failure categories, and results that omit them can't be placed on public leaderboards or compared with published baselines",
      "Coding agents fail in structured ways (wrong location, fix-without-test, regression introduced, exhausted); naming the categories reveals HOW it fails, guides fixes, and gives you interview vocabulary",
    ],
    correct: 3,
    explanation:
      "Binary scores hide the interesting signal. A histogram of failure modes tells you where to invest (e.g., wrong-location dominance means fix exploration) and demonstrates to a reviewer that you understand your agent's behavior.",
  },
  {
    question:
      "What makes a limitations doc the artifact that most signals seniority?",
    options: [
      "It doubles as the project's complete feature inventory, and reviewers use it to size the project's ambition, so a longer list of supported capabilities reads as a stronger artifact than any eval table",
      "Honesty is rare and inflation is the default; a frank scope, known failure modes from your taxonomy, cost envelope, and safety boundaries make reviewers trust the claims you do make",
      "It shows the agent fails only in exotic edge cases far outside normal use, which reassures reviewers that the core path is essentially solid",
      "Pre-declared limitations shift responsibility to whoever deploys outside the stated scope, and production teams require that liability boundary before sign-off",
    ],
    correct: 1,
    explanation:
      "Good companies are calibrated to detect inflation. Admitting narrow scope and documented failures makes the rest of your claims credible — 'here's exactly where it breaks' is a senior signal.",
  },
  {
    question:
      "In a system-design interview, which move most reliably signals seniority early?",
    options: [
      "Explicitly stating the workflow-vs-agent decision and starting with the simplest architecture that works, before adding autonomy",
      "Opening with a multi-agent decomposition — orchestrator, explorer, and repair specialists — since showing you can coordinate several models is what distinguishes senior systems design",
      "Specifying the flagship model for every component up front, because model capability is the dominant risk and cheaper-routing decisions are best deferred to a later optimization pass",
      "Diving straight into the design to demonstrate decisiveness, since interviewers deduct for time spent asking questions the prompt already implies answers to",
    ],
    correct: 0,
    explanation:
      "Stating the workflow-vs-agent decision out loud — and defaulting to the simplest thing that works — signals judgment. Reaching for multi-agent or the biggest model first signals the opposite. Add complexity only when the simple design demonstrably can't do the job.",
  },
  {
    question:
      "Why did on-demand agentic search (grep/glob/read) generally beat a pre-built semantic index for this capstone's exploration stage?",
    options: [
      "Embedding models are trained mostly on natural language, so source code maps into a space where similarity scores are meaningless and a semantic index returns noise for code queries",
      "An index is stale the moment the repo changes and requires ongoing infra to keep current, while on-demand search reads the live tree and needs no service to maintain — though a maintained index can still earn its keep at monorepo scale",
      "Ripgrep's raw scan speed beats vector search at any repo size regardless of change frequency, and since retrieval latency dominates the exploration budget, the faster primitive wins outright — staleness and infrastructure cost never enter the decision",
      "Building an index requires the entire repo to fit in the embedding model's context at indexing time, which already fails for any repo too large to paste into a prompt",
    ],
    correct: 1,
    explanation:
      "On-demand search is correct by construction (it reads the current tree) and has near-zero infra cost, while an index needs a re-embedding pipeline, storage, and versioning to avoid staleness. The honest exception is very large monorepos, where even agentic grep chokes on result volume and an index starts paying for itself.",
  },
  {
    question:
      "Why should an edit tool reject a write when the file's content hash has changed since it was last read, even if the exact old block still matches?",
    options: [
      "The hash comparison short-circuits the more expensive exact-block string search, so the guard mainly keeps apply_edit fast on large files where counting occurrences is slow",
      "Git stores files as content-addressed objects, so an edit applied against a stale hash would produce a commit whose SHA no longer matches the index — the guard keeps the sandbox worktree consistent with what git will eventually record",
      "Exact-match search/replace already catches every form of drift on its own, so the hash check is redundant defense-in-depth retained mainly to satisfy the audit log",
      "The model's broader understanding of the file may be based on a version that no longer exists even if the specific old block is unchanged, so a staleness check fails loudly and cheaply instead of risking a subtly wrong edit",
    ],
    correct: 3,
    explanation:
      "Exact-match search/replace already catches drift in the edited block, but the rest of the file — and the model's reasoning about it — could still be stale. A staleness check (hash captured at read time, verified at write time) rejects the whole edit if anything changed, forcing a fresh read rather than letting an edit land against assumptions that no longer hold.",
  },
  {
    question:
      "A repair loop's only success signal is 'the tests pass.' What failure mode does this create, and what actually guards against it?",
    options: [
      "None — the loop already runs the suite independently instead of trusting the model's word, so a green result is verified ground truth and no further guard is required",
      "Test-gaming: under retry pressure the agent can weaken, skip, or delete the failing assertion instead of fixing the bug, since the loop can't tell the difference; the guardrail is an external check that diffs test files independently of pass/fail, not a prompt instruction",
      "Flaky tests that intermittently fail look like real signal to the model; the guard is raising MAX_ATTEMPTS so repeated reruns average the noise out of the pass/fail decision",
      "Premature victory declarations, which are guarded by a system-prompt instruction telling the model never to claim success before the suite is actually green",
    ],
    correct: 1,
    explanation:
      "An underspecified proxy metric ('tests pass') will be satisfied the cheapest way possible by a capable optimizer, including an LLM under retry pressure. Because the mechanism lives inside the same loop being gamed, the fix has to be external: a review or scoring step that diffs test files on their own and flags any repair that touches them, regardless of the suite's outcome.",
  },
  {
    question:
      "Why is a same-model-family independent reviewer, reviewing a diff before human approval, a weaker gate than it looks?",
    options: [
      "Models from one family typically share serving infrastructure, so the review call queues behind the generator's traffic and the added latency pushes approvals past the HITL gate's timeout",
      "It inherits self-preference bias — a model tends to rate its own family's outputs more favorably, sharing blind spots with the generator — so a different family or at least a narrow, structured rubric is a stronger design",
      "A reviewer spun up in a fresh context has none of the generator's exploration history or repo understanding, so whatever its family it can only rubber-stamp the diff — the real weakness is missing context, not any bias shared between model families",
      "Independent review only adds value after the human has approved, as a post-merge audit — run before approval it merely duplicates the judgment the human is about to make anyway",
    ],
    correct: 1,
    explanation:
      "This mirrors the LLM-as-judge bias material: a reviewer sharing the generator's family shares its training data and blind spots, so it under-flags the same class of mistakes the generator is prone to making. A different model family, or at minimum a narrow mechanical rubric instead of an open judgment call, resists this better.",
  },
  {
    question:
      "A team reports 'our agent matches the published SWE-bench pass@1 number' after running their own agent 5 times per issue and counting a success if ANY attempt passed. What's the problem?",
    options: [
      "Nothing — taking the best of five attempts reduces variance, so the resulting figure is a fairer, more thorough estimate of the very same capability the published number measures",
      "That's a pass@5 number being compared to a pass@1 figure; pass@k is mechanically ≥ pass@1 since more independent attempts can only help, and production PRs are opened from a single attempt, so pass@1 is the operationally honest number to report",
      "The real problem is sample size — a small self-assembled issue set can't be compared to the full benchmark under any protocol — while the attempt-counting itself is sound since every run used the same agent",
      "Five attempts per issue breaks independence — later attempts see earlier failures in context, so the runs are contaminated and the number is meaningless rather than merely mislabeled",
    ],
    correct: 1,
    explanation:
      "Pass@k counts a success if any of k independent attempts succeeds, which can only be ≥ pass@1. Comparing a pass@5 number to a published pass@1 figure overstates apples-to-apples performance — and misrepresents what a user actually experiences, since a real PR comes from one attempt, not the best of five.",
  },
];
