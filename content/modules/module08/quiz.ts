import type { QuizQuestion } from "@/lib/types";

export const quiz08: QuizQuestion[] = [
  {
    question:
      "Why is 'handles simple, well-specified bug-fix issues in Python repos under 10k LOC' a strong scope statement for the capstone?",
    options: [
      "It sounds impressive without committing to anything measurable",
      "Precise, honest scoping is itself a seniority signal; a reliably narrow agent beats a flaky general one, and it becomes the first line of your limitations doc",
      "Scoping narrowly hides the agent's weaknesses from reviewers",
      "Ten thousand lines is the maximum any coding agent can handle",
    ],
    correct: 1,
    explanation:
      "Stating scope that precisely signals judgment. Reliability on a narrow task beats flaky breadth, and the sentence doubles as the top of your limitations doc — honesty reviewers reward.",
  },
  {
    question:
      "Why is codebase exploration fundamentally a retrieval problem for this capstone?",
    options: [
      "Because the model refuses to read code it wasn't trained on",
      "Because embeddings are always more accurate than reading files",
      "A 10k-LOC repo far exceeds any context window, so you must locate and feed only the handful of relevant files — get this wrong and the model plans against files it never saw",
      "Because git requires retrieval to check out a branch",
    ],
    correct: 2,
    explanation:
      "You can't paste a whole repo into context. Exploration must find the few files that matter; everything downstream degrades if the agent plans against code it never actually read.",
  },
  {
    question:
      "For a coding agent locating a specific bug, why does agentic grep-and-read often beat pure embedding-based retrieval?",
    options: [
      "Embeddings don't work on source code",
      "Bugs are typically about specific symbols, error strings, and call sites, which grep-and-read navigation surfaces precisely; semantic search is better for concept-level questions, so combine them",
      "Grep is always faster than any other method",
      "Agentic navigation uses fewer tokens in every case",
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
      "Search/replace never fails to apply",
      "Full-file rewrites can't express localized changes",
      "Search/replace is required by the GitHub API",
    ],
    correct: 0,
    explanation:
      "Bug fixes are localized, so search/replace yields tight diffs a human reviews in seconds and avoids the full-rewrite risk of dropping code. When the old block doesn't match exactly, return an error and let the model re-read and retry.",
  },
  {
    question:
      "Why must the repair loop write a test that reproduces the bug and fails BEFORE the fix?",
    options: [
      "It's a stylistic convention with no real effect",
      "A reproducing red test is the only proof the fix actually addresses the bug; without it a 'fix' might do nothing or patch a symptom while missing the cause",
      "Pytest requires a failing test to run",
      "It makes the diff larger, which impresses reviewers",
    ],
    correct: 1,
    explanation:
      "Red-before-green is verification: the test must fail on the buggy code and pass after the fix. A fix with no reproducing test is unverified and may be doing nothing or fixing the wrong thing.",
  },
  {
    question:
      "Why must the test-driven repair loop be bounded (e.g., max 5 attempts)?",
    options: [
      "Because the model gets bored after five tries",
      "Five is the maximum number of tests pytest allows",
      "Bounding it improves the model's reasoning quality",
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
      "Trust it and open the PR immediately",
      "Run the test suite independently and, if tests still fail, push the failures back and continue — never take the model's word for success",
      "Ask the model to rate its confidence and proceed if high",
      "Immediately revert all edits to be safe",
    ],
    correct: 1,
    explanation:
      "Models declare victory prematurely. The loop verifies independently by running the suite; if it lied, feed the failing output back and keep going until tests actually pass or retries are exhausted.",
  },
  {
    question:
      "Why is opening a PR treated as an irreversible action requiring an HITL gate?",
    options: [
      "PRs cost money to create",
      "GitHub's API is unreliable, so a human must retry it",
      "It's a consequential, hard-to-undo action against a real repo; the gate shows a human the diff, tests, and cost, logs the decision, and defaults to reject on timeout — also the backstop against a malicious issue's injected instructions",
      "Draft PRs can't be created programmatically",
    ],
    correct: 2,
    explanation:
      "Opening a PR touches a real repo and is exactly the consequential action Module 7's HITL pattern guards. The human reviews the actual diff before anything ships — which also defends against injected instructions in the issue text.",
  },
  {
    question:
      "What should a self-assembled SWE-bench-style eval set contain, and why?",
    options: [
      "Only issues the agent already passes, to show a high score",
      "≥10 issues mixing real OSS bugs and bugs you seed yourself (bug + issue + known-good fix), so you have ground truth to score automatically",
      "A single hard issue, since one good example proves capability",
      "Randomly generated code with no known fixes",
    ],
    correct: 1,
    explanation:
      "Ground truth is what makes automatic scoring possible: for each issue you know the correct fix, so you can check whether the reproducing test passes without breaking existing tests. Seeding bugs gives you controlled cases; real issues give realism.",
  },
  {
    question:
      "Why report a partial-success taxonomy instead of just a pass/fail rate?",
    options: [
      "To make the results table longer",
      "Because pass/fail is impossible to compute",
      "Taxonomies are required by SWE-bench",
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
      "It lists every feature the agent supports",
      "Honesty is rare and inflation is the default; a frank scope, known failure modes from your taxonomy, cost envelope, and safety boundaries make reviewers trust the claims you do make",
      "It's the shortest section, so reviewers appreciate brevity",
      "It transfers legal liability away from you",
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
      "Immediately proposing a multi-agent architecture",
      "Naming the largest model available for every component",
      "Skipping clarifying questions to save time",
    ],
    correct: 0,
    explanation:
      "Stating the workflow-vs-agent decision out loud — and defaulting to the simplest thing that works — signals judgment. Reaching for multi-agent or the biggest model first signals the opposite. Add complexity only when the simple design demonstrably can't do the job.",
  },
  {
    question:
      "Why did on-demand agentic search (grep/glob/read) generally beat a pre-built semantic index for this capstone's exploration stage?",
    options: [
      "Semantic indices cannot be built for source code at all",
      "An index is stale the moment the repo changes and requires ongoing infra to keep current, while on-demand search reads the live tree and needs no service to maintain — though a maintained index can still earn its keep at monorepo scale",
      "Grep is always faster than any vector search regardless of repo size",
      "Models cannot call more than one tool per turn, so indices are unusable",
    ],
    correct: 1,
    explanation:
      "On-demand search is correct by construction (it reads the current tree) and has near-zero infra cost, while an index needs a re-embedding pipeline, storage, and versioning to avoid staleness. The honest exception is very large monorepos, where even agentic grep chokes on result volume and an index starts paying for itself.",
  },
  {
    question:
      "Why should an edit tool reject a write when the file's content hash has changed since it was last read, even if the exact old block still matches?",
    options: [
      "It's a performance optimization that makes apply_edit run faster",
      "GitHub requires a content hash on every commit",
      "The block matching is what pytest uses to locate line numbers",
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
      "None — a passing test suite is definitionally proof the bug is fixed",
      "Test-gaming: under retry pressure the agent can weaken, skip, or delete the failing assertion instead of fixing the bug, since the loop can't tell the difference; the guardrail is an external check that diffs test files independently of pass/fail, not a prompt instruction",
      "Flaky tests, which are fixed by increasing MAX_ATTEMPTS",
      "The model refusing to call run_tests more than once",
    ],
    correct: 1,
    explanation:
      "An underspecified proxy metric ('tests pass') will be satisfied the cheapest way possible by a capable optimizer, including an LLM under retry pressure. Because the mechanism lives inside the same loop being gamed, the fix has to be external: a review or scoring step that diffs test files on their own and flags any repair that touches them, regardless of the suite's outcome.",
  },
  {
    question:
      "Why is a same-model-family independent reviewer, reviewing a diff before human approval, a weaker gate than it looks?",
    options: [
      "Same-family models are slower to respond than cross-family ones",
      "It inherits self-preference bias — a model tends to rate its own family's outputs more favorably, sharing blind spots with the generator — so a different family or at least a narrow, structured rubric is a stronger design",
      "Same-family models cannot process diffs longer than a few lines",
      "Independent review is only useful after the human has already approved",
    ],
    correct: 1,
    explanation:
      "This mirrors the LLM-as-judge bias material: a reviewer sharing the generator's family shares its training data and blind spots, so it under-flags the same class of mistakes the generator is prone to making. A different model family, or at minimum a narrow mechanical rubric instead of an open judgment call, resists this better.",
  },
  {
    question:
      "A team reports 'our agent matches the published SWE-bench pass@1 number' after running their own agent 5 times per issue and counting a success if ANY attempt passed. What's the problem?",
    options: [
      "Nothing — more attempts just means a more thorough test",
      "That's a pass@5 number being compared to a pass@1 figure; pass@k is mechanically ≥ pass@1 since more independent attempts can only help, and production PRs are opened from a single attempt, so pass@1 is the operationally honest number to report",
      "SWE-bench doesn't have a published pass@1 number to compare against",
      "Running an agent more than once per issue is not technically possible",
    ],
    correct: 1,
    explanation:
      "Pass@k counts a success if any of k independent attempts succeeds, which can only be ≥ pass@1. Comparing a pass@5 number to a published pass@1 figure overstates apples-to-apples performance — and misrepresents what a user actually experiences, since a real PR comes from one attempt, not the best of five.",
  },
];
