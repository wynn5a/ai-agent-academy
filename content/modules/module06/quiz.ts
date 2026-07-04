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
  {
    question:
      "Your team just adopted MCP for a new agent product. A skeptical engineer says 'great, now our tools are automatically good, our context usage is handled, and third-party servers are safe to connect.' What's wrong with that claim?",
    options: [
      "Nothing — standardizing the wire is exactly what guarantees tool quality, context economy, and server safety",
      "MCP standardizes the wire only: it says nothing about whether a tool is well-designed, how much context every connected server's schemas consume, or whether a given server's code and output can be trusted — each is a separate problem you still have to solve (Lessons 4 and 5)",
      "MCP guarantees tool quality and context economy, but never addresses server trust",
      "MCP guarantees server trust via mandatory code review, but never addresses tool quality",
    ],
    correct: 1,
    explanation:
      "Standardization is a claim about wire compatibility, not about safety or quality. A protocol-compliant server can still expose a badly-designed tool with a bloated response, and connecting to it is exactly as risky as running that party's code, because that's what you're doing. Treating 'we use MCP' as a safety statement is the mistake this question is checking for.",
  },
  {
    question:
      "You connect five MCP servers averaging eight tools each, and the agent's tool selection gets measurably worse — even though every individual tool is well-designed. What's happening, and what's the fix?",
    options: [
      "The servers are competing for network bandwidth; fix it by upgrading your connection",
      "Every connected server's full tool schemas ride in every request regardless of relevance, and selection accuracy degrades as the visible tool count grows; fix it with deferred loading / a tool-search capability (or manual curation of which servers are connected) rather than editing any single tool's docstring",
      "MCP enforces a hard 20-tool limit per host, so five servers of eight tools each is simply invalid and must be reduced",
      "The fix is always to merge all five servers' tools into one mega-tool",
    ],
    correct: 1,
    explanation:
      "This is context bloat: forty schemas' worth of tokens ride in every request whether or not they're relevant, and tool-selection accuracy drops as the count grows, independent of any single tool's quality. Deferred loading / tool search lets the model discover and load only task-relevant schemas; without that capability, curating which servers are connected per session is the manual equivalent. Rewriting one tool's description doesn't fix a volume problem.",
  },
  {
    question:
      "What is the 'confused deputy' problem as it applies to an MCP server, and why does it matter even if every user of your agent is fully trusted?",
    options: [
      "It's when two servers both claim the same tool name; the client can't tell which one to call",
      "A program (the server) holds more authority than the party asking it to act (the model); if untrusted content in the model's context manipulates the model into issuing a tool call, the server executes it with its own full credential because it can't distinguish a genuine user request from a manipulated one — so the risk exists independent of user trust",
      "It only matters when the user is malicious, since a trusted user would never trigger a harmful tool call",
      "It's a client-side bug where the wrong session ID gets attached to a tool call",
    ],
    correct: 1,
    explanation:
      "The server holds real authority (its API credential); the model has none of its own and acts entirely through the server's authority when it calls a tool. If a ticket, web page, or other content in context is engineered to redirect the model, the server sees an identical, well-formed tools/call either way — it can't tell 'the user asked for this' from 'the model was manipulated.' That's why minimal scoping and two-phase confirm matter regardless of how trustworthy the user is.",
  },
  {
    question:
      "What is the 'lethal trifecta,' and why does a well-connected MCP host assemble it easily?",
    options: [
      "Three unrelated bugs — a race condition, a memory leak, and a null pointer — that together crash the server",
      "An agent that has (1) access to private/sensitive data, (2) exposure to untrusted content such as fetched web pages or tickets, and (3) a channel that can exfiltrate or act on that data — a host with a filesystem server, a web-fetch server, and a write-capable API server live in the same session assembles all three legs without anyone deciding to",
      "Three transport protocols (stdio, SSE, streamable HTTP) running simultaneously, which the spec forbids",
      "Three servers sharing one OAuth token, which always triggers a security review",
    ],
    correct: 1,
    explanation:
      "Private data + untrusted content + an exfiltration/action channel, together in one session, is what turns injected text into real damage — none of the three legs is a problem alone. Mitigations layer: minimize tools that both read untrusted content and act with consequence in the same session, treat every tool result and resource as untrusted input, and gate destructive/write tools behind two-phase confirm so an injected instruction produces a preview, not an action.",
  },
  {
    question:
      "Why is connecting to a third-party MCP server a different — and larger — risk than adding a typical third-party library dependency?",
    options: [
      "It isn't different; both are just code you didn't write, and the same review process covers both identically",
      "A malicious or compromised MCP server is simultaneously arbitrary code execution (like any dependency) AND a trusted voice inside the model's context — its descriptions shape what the model decides to call and its responses shape what the model does next — so even a server whose code stays clean can start injecting the model via a compromised upstream data source",
      "Third-party MCP servers cannot hold credentials, so the worst case is limited to reading public data",
      "MCP servers are sandboxed by the protocol itself, so code risk is eliminated; only the library-dependency case carries code risk",
    ],
    correct: 1,
    explanation:
      "A library dependency doesn't get to inject instructions into your model's reasoning; an MCP server's tool descriptions and results do, with the same trust as your own system prompt. Vet a third-party server like a production dependency (source, maintenance, least-privileged credentials) — and separately treat everything it returns as untrusted input, because a legitimate server can be compromised upstream and start returning injected content without its published source ever changing.",
  },
];
