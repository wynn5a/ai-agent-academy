import type { QuizQuestion } from "@/lib/types";

export const quiz06: QuizQuestion[] = [
  {
    question:
      "In the MCP architecture, where do API credentials live, and why there?",
    options: [
      "In the model's system prompt, so it can authenticate itself per call",
      "In the host application's UI settings, injected into the model's context at startup",
      "In the server process (env vars / secrets manager) — the model only ever sees tool names and schemas, so a secret that never enters model context can't leak through injection or model error",
      "Split between client and server so neither holds a complete key",
    ],
    correct: 2,
    explanation:
      "Everything in model context is exfiltratable — by prompt injection, by the model echoing configuration, by simple error. The architecture's answer is structural: the server holds and uses credentials to fulfill tool calls; the model requests actions by name and never touches the secret. This is the single most-quoted consequence of the host/client/server split.",
  },
  {
    question: "Tools, resources, and prompts — who invokes each?",
    options: [
      "Tools: the model, mid-task; resources: the application/host, which attaches them to context; prompts: the user, explicitly (slash-command style templates)",
      "All three are invoked by the model whenever it chooses",
      "Tools: the user; resources: the model; prompts: the host",
      "The server invokes all three and pushes results to the client",
    ],
    correct: 0,
    explanation:
      "The control model is the point of the taxonomy: tools are model-controlled actions, resources are application-controlled data (the host decides what to read into context), prompts are user-controlled templates. Choosing the wrong primitive — e.g., exposing reference data as a tool the model must remember to call — is a common server design smell.",
  },
  {
    question: "How does an MCP session begin?",
    options: [
      "The client immediately sends tools/call; discovery is optional",
      "The client sends an initialize request declaring protocol version and capabilities; the server responds with its own; the client sends an initialized notification — then normal traffic like tools/list can flow",
      "The server dials the client and streams its tool list unprompted",
      "Both sides exchange TLS certificates, which doubles as capability negotiation",
    ],
    correct: 1,
    explanation:
      "The handshake is mandatory and bidirectional: version + capability exchange lets each side know what the other supports, which is how the protocol evolves without breaking older peers. The closing `initialized` message is a notification — no id, no response expected — after which requests like tools/list and tools/call are legal.",
  },
  {
    question:
      "Your API has 12 REST endpoints. The straightforward MCP server mirrors each as a tool. Why is this usually wrong, and what's better?",
    options: [
      "It's correct — fidelity to the API is the goal of an MCP server",
      "Wrong only because 12 exceeds a protocol limit on tool count",
      "It's wrong because tools can't call more than one endpoint internally",
      "Models choose worse as tool count grows, and thin wrappers force the model to chain calls and join data in-context, burning tokens and multiplying failure points; better: fewer task-level tools that accept what the model has (names, queries) and return shaped, pre-joined summaries",
    ],
    correct: 3,
    explanation:
      "REST shapes suit programmers with cheap loops and persistent variables; models pay context for every byte and every round trip. `search_orders(query, status, date_range)` returning shaped summaries beats get_order + get_customer + list_shipments chained by the model. Rewriting `get_data(id)` into a task-level tool is checkpoint-quiz question 3 for a reason.",
  },
  {
    question: "Why are tool descriptions 'prompts in disguise'?",
    options: [
      "The client concatenates them into the system prompt verbatim, replacing your instructions",
      "They're validated by the API for prompt-injection patterns",
      "The model selects tools and forms arguments based on names, descriptions, and schemas alone — so a description change (e.g., adding 'NOT for refunds — use process_refund') directly changes agent behavior, exactly like editing a prompt",
      "They're only shown to human users browsing the server",
    ],
    correct: 2,
    explanation:
      "The docstring/description is the model's entire knowledge of your tool. Wrong-tool-selection bugs are usually description bugs: adding when-to-use guidance and explicit negative guidance ('NOT for X — use Y') fixes behavior without touching code. Budget prompt-engineering effort on descriptions accordingly.",
  },
  {
    question:
      "A tool can match 200k tokens of results. What's the right response strategy?",
    options: [
      "Return everything — the model will skim what it needs",
      "Silently return the first 1,000 tokens so the response stays small",
      "Refuse to answer queries that match too much data",
      "Server-enforced caps and pagination (bounded page_size, per-item truncation), plus an explicit signal — 'showing 20 of 3,400; more available, request page 2 or refine the query' — so the model knows the view is partial and what to do next",
    ],
    correct: 3,
    explanation:
      "Dumping 200k tokens evicts the task from context or overflows the window; silent truncation is worse than loud truncation because the model concludes the data doesn't exist and answers wrongly with confidence. Budget every response, and always tell the model that more exists and how to get it — including the nudge to refine rather than page.",
  },
  {
    question:
      "How should a tool signal errors, and why not just raise exceptions?",
    options: [
      "Raise exceptions — the client converts them into retries automatically",
      "Return instructive text the model can act on ('Ambiguous: 3 customers match — call again with a full name'; 'auth expired — tell the user, do not retry'), because the model can read and recover from in-band results but learns nothing actionable from a dead call",
      "Return HTTP status codes as bare integers",
      "Log the error server-side and return an empty string",
    ],
    correct: 1,
    explanation:
      "MCP carries tool failures in-band (result with isError) precisely so the model can incorporate them and adjust. An exception (or empty string) ends the exchange without teaching the model its next move. Good error text names the problem AND the recovery path — and never leaks credentials or stack internals.",
  },
  {
    question:
      "Name the sandbox property and the attack it prevents. Which pairing is correct?",
    options: [
      "Read-only filesystem → prevents infinite loops",
      "Memory limits → prevent data exfiltration",
      "No network access → prevents exfiltrating data/secrets and calling attacker infrastructure; memory/CPU/pids limits → prevent resource-exhaustion bombs; timeout → kills infinite loops; ephemeral non-root read-only FS → prevents persistence and privilege escalation",
      "Timeouts → prevent fork bombs",
    ],
    correct: 2,
    explanation:
      "Four properties, four attack classes: network isolation vs. exfiltration/callbacks; resource limits vs. memory/fork bombs; wall-clock timeout vs. spin loops; ephemeral read-only non-root filesystem vs. persistence and escalation-from-breakout. Lab 06 requires proving the first one with a test: socket-connect code must fail inside the sandbox.",
  },
  {
    question: "What problem does MCP solve versus A2A?",
    options: [
      "MCP connects an agent to tools and data (agent↔tool); A2A connects agents to other agents as opaque peers across trust boundaries (agent↔agent) — complementary, and an A2A peer may use MCP internally",
      "A2A is the successor protocol that deprecates MCP",
      "MCP is for local servers, A2A is MCP-over-HTTP",
      "MCP handles authentication while A2A handles tool schemas",
    ],
    correct: 0,
    explanation:
      "MCP is vertical: one agent's connection to its capabilities. A2A (Google-originated) is horizontal: peer agents advertising capabilities via agent cards, accepting tasks, reporting progress — without sharing internals or context, suited to crossing organizational boundaries. One crisp sentence of A2A knowledge is the expected depth here.",
  },
  {
    question: "When should you choose stdio versus streamable HTTP transport?",
    options: [
      "Always streamable HTTP — stdio is legacy",
      "stdio for anything with more than one user",
      "stdio when the client and server share a machine and a single user — the client spawns the server as a subprocess, inheriting local trust with zero deployment; streamable HTTP when the server is remote or shared by multiple clients, which brings auth, TLS, and ops obligations",
      "They're interchangeable; pick by personal taste",
    ],
    correct: 2,
    explanation:
      "The decision is topology, not fashion. Local single-user dev tools (Claude Desktop servers, Lab 06's default) fit stdio's process-per-client model. Team-shared or SaaS servers need streamable HTTP — the modern remote transport with streamed responses and session resumability — plus real authentication, because a URL is attack surface.",
  },
  {
    question: "What are the three layers of testing for an MCP server?",
    options: [
      "Linting, formatting, and type-checking",
      "Unit tests on the tool logic as plain functions (mock the real API); integration tests that speak actual MCP — spawn the server over stdio with a ClientSession, list and call tools, assert on results; and adversarial/end-to-end testing through a real client where someone tries to break it (bad IDs, huge queries, destructive calls without confirm)",
      "Load testing, soak testing, and chaos testing only",
      "Testing is unnecessary — the protocol validates everything",
    ],
    correct: 1,
    explanation:
      "Each layer catches what the others can't: unit tests verify logic fast; protocol-level integration tests catch schema generation, serialization, and stdout-pollution bugs invisible to unit tests; adversarial use through a real client (the Gate G3 practical) catches design failures — unhelpful errors, unbounded responses, ungated destructive calls.",
  },
  {
    question:
      "A model keeps calling your destructive delete_project tool during exploratory questions. Which defense is the right FIRST layer, within your server?",
    options: [
      "Remove the tool — destructive operations can never be exposed",
      "Rely on the host app's approval dialog and change nothing",
      "Rename the tool to something the model won't notice",
      "A two-phase confirm parameter defaulting to false — the bare call returns a preview of exactly what would be deleted, and only an explicit confirm=true call acts — with the docstring instructing that confirmation requires the user's explicit approval of the previewed item",
    ],
    correct: 3,
    explanation:
      "Default-false confirm makes hallucinated or injected destructive calls inert: the worst a spurious call produces is a preview. The docstring teaches the ceremony; host-side human approval is a valuable second layer, but your server shouldn't assume every host provides it. Defense in depth, starting with the layer you control.",
  },
];
