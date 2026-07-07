import type { QuizQuestion } from "@/lib/types";

export const quiz06: QuizQuestion[] = [
  {
    question:
      "In the MCP architecture, where do API credentials live, and why there?",
    options: [
      "In the model's system prompt, supplied once at session start, so the model can present the credential itself on every tools/call without the server having to track per-session auth state",
      "In the host application, which injects them into the model's context at startup — the host owns the user relationship, so it's the natural place for the user to enter secrets and for the model to pick them up",
      "In the server process (env vars / secrets manager) — the model only ever sees tool names and schemas, so a secret that never enters model context can't leak through injection or model error",
      "Split between the client and the server during the initialize handshake, so neither side ever holds a complete key and compromising one process alone yields nothing",
    ],
    correct: 2,
    explanation:
      "Everything in model context is exfiltratable — by prompt injection, by the model echoing configuration, by simple error. The architecture's answer is structural: the server holds and uses credentials to fulfill tool calls; the model requests actions by name and never touches the secret. This is the single most-quoted consequence of the host/client/server split.",
  },
  {
    question: "Tools, resources, and prompts — who invokes each?",
    options: [
      "Tools: the model, mid-task; resources: the application/host, which attaches them to context; prompts: the user, explicitly (slash-command style templates)",
      "All three are invoked by the model whenever it chooses — discovery exists precisely so that everything a server publishes becomes model-callable, with the host merely relaying the calls",
      "Tools: the user, who approves each action before it runs; resources: the model, which reads whatever data it decides it needs; prompts: the host, which injects templates automatically at session start",
      "The server invokes all three on its own schedule and pushes results to the client as notifications, since it's the side that owns the capabilities",
    ],
    correct: 0,
    explanation:
      "The control model is the point of the taxonomy: tools are model-controlled actions, resources are application-controlled data (the host decides what to read into context), prompts are user-controlled templates. Choosing the wrong primitive — e.g., exposing reference data as a tool the model must remember to call — is a common server design smell.",
  },
  {
    question: "How does an MCP session begin?",
    options: [
      "The client immediately sends tools/call for the tool it wants; discovery via tools/list is an optional optimization, and version differences surface later as per-request errors",
      "The client sends an initialize request declaring protocol version and capabilities; the server responds with its own; the client sends an initialized notification — then normal traffic like tools/list can flow",
      "The server dials the client and streams its full tool list unprompted, so schemas are in context before the first request; the client replies with the subset of capabilities it will keep",
      "Both sides exchange TLS certificates, which doubles as capability negotiation — supported features are encoded as certificate extensions, securing transport and protocol in one step",
    ],
    correct: 1,
    explanation:
      "The handshake is mandatory and bidirectional: version + capability exchange lets each side know what the other supports, which is how the protocol evolves without breaking older peers. The closing `initialized` message is a notification — no id, no response expected — after which requests like tools/list and tools/call are legal.",
  },
  {
    question:
      "Your API has 12 REST endpoints. The straightforward MCP server mirrors each as a tool. Why is this usually wrong, and what's better?",
    options: [
      "It's correct — fidelity to the API is the goal: a one-to-one mirror stays trivially in sync with the upstream endpoints, gives the model maximum freedom to compose calls the way a programmer would, and keeps product assumptions out of the tool layer, which is what makes a server reusable across hosts",
      "Wrong only because twelve exceeds the recommended per-server tool budget; below that cap, one tool per endpoint is the intended design, since clients rely on a stable one-to-one mapping between schemas and endpoints",
      "It's wrong because a tool may only call one downstream endpoint internally — the protocol has no way to represent a multi-endpoint result — so cross-endpoint workflows have to be left to the model to chain",
      "Models choose worse as tool count grows, and thin wrappers force the model to chain calls and join data in-context, burning tokens and multiplying failure points; better: fewer task-level tools that accept what the model has (names, queries) and return shaped, pre-joined summaries",
    ],
    correct: 3,
    explanation:
      "REST shapes suit programmers with cheap loops and persistent variables; models pay context for every byte and every round trip. `search_orders(query, status, date_range)` returning shaped summaries beats get_order + get_customer + list_shipments chained by the model. Rewriting `get_data(id)` into a task-level tool is the classic whiteboard exercise for a reason.",
  },
  {
    question: "Why are tool descriptions 'prompts in disguise'?",
    options: [
      "The client concatenates every connected server's descriptions verbatim into the system prompt, where later text overrides earlier text — so a third-party description can silently replace your own instructions, which is why hosts limit how many servers you may attach",
      "They're scanned by the provider's API for prompt-injection patterns before the model ever sees them — 'prompts in disguise' refers to that screening step, which is what makes third-party descriptions safe to load",
      "The model selects tools and forms arguments based on names, descriptions, and schemas alone — so a description change (e.g., adding 'NOT for refunds — use process_refund') directly changes agent behavior, exactly like editing a prompt",
      "They're rendered only to humans browsing the server in the MCP Inspector; the model itself sees just the name and input schema, so a description is documentation for developers, not something that steers behavior",
    ],
    correct: 2,
    explanation:
      "The docstring/description is the model's entire knowledge of your tool. Wrong-tool-selection bugs are usually description bugs: adding when-to-use guidance and explicit negative guidance ('NOT for X — use Y') fixes behavior without touching code. Budget prompt-engineering effort on descriptions accordingly.",
  },
  {
    question:
      "A tool can match 200k tokens of results. What's the right response strategy?",
    options: [
      "Return everything and let the model's attention skim to the relevant parts — withholding matches risks the model answering from incomplete information, and the context window is exactly the budget you were given to spend",
      "Quietly return the first 1,000 tokens so the response stays inside budget — the model doesn't need to know about the cutoff, and announcing that results were dropped would just spend more of the window on metadata the model can't act on anyway",
      "Refuse the query outright with an error whenever the match count would exceed the budget — a partial view is worse than none, because the model will reason from incomplete data",
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
      "Raise exceptions and let them propagate — the SDK maps them to JSON-RPC protocol errors, and clients respond to those with automatic retries and backoff, so the model never has to see failure text at all",
      "Return instructive text the model can act on ('Ambiguous: 3 customers match — call again with a full name'; 'auth expired — tell the user, do not retry'), because the model can read and recover from in-band results but learns nothing actionable from a dead call",
      "Return bare HTTP status codes as integers — models have seen the web's error conventions in training, so a 404 or 401 carries the full signal at a fraction of the tokens a prose message would cost under a response budget",
      "Log the full error server-side and return an empty string — that guarantees stack traces and credentials can never leak into model context, and an empty result is the conservative failure mode: the model simply concludes there's no matching data and moves on without retrying",
    ],
    correct: 1,
    explanation:
      "MCP carries tool failures in-band (result with isError) precisely so the model can incorporate them and adjust. An exception (or empty string) ends the exchange without teaching the model its next move. Good error text names the problem AND the recovery path — and never leaks credentials or stack internals.",
  },
  {
    question:
      "Name the sandbox property and the attack it prevents. Which pairing is correct?",
    options: [
      "Read-only filesystem → prevents infinite loops, since code that can't write scratch files can't accumulate the state a runaway loop needs; pair it with a non-root user and fork bombs are covered as well",
      "Memory limits → prevent data exfiltration, because a process capped at a few hundred megabytes can't buffer large files for transfer; once memory is bounded, network isolation is only needed on servers that also hold credentials, since exfiltration without a buffer isn't practical",
      "No network access → prevents exfiltrating data/secrets and calling attacker infrastructure; memory/CPU/pids limits → prevent resource-exhaustion bombs; timeout → kills infinite loops; ephemeral non-root read-only FS → prevents persistence and privilege escalation",
      "Timeouts → prevent fork bombs by killing the parent before it can spawn children, which is why pids limits are considered a redundant second layer that hardened sandbox configurations often drop",
    ],
    correct: 2,
    explanation:
      "Four properties, four attack classes: network isolation vs. exfiltration/callbacks; resource limits vs. memory/fork bombs; wall-clock timeout vs. spin loops; ephemeral read-only non-root filesystem vs. persistence and escalation-from-breakout. Lab 06 requires proving the first one with a test: socket-connect code must fail inside the sandbox.",
  },
  {
    question: "What problem does MCP solve versus A2A?",
    options: [
      "MCP connects an agent to tools and data (agent↔tool); A2A connects agents to other agents as opaque peers across trust boundaries (agent↔agent) — complementary, and an A2A peer may use MCP internally",
      "A2A is the successor protocol: it generalizes MCP's tools into tasks and agent cards, so new systems should expose an A2A endpoint and treat MCP servers as a legacy compatibility layer",
      "MCP is the local, stdio-only protocol; A2A is the same message set carried over HTTP for remote, multi-client deployments — which is why servers that need streamable HTTP are sometimes described as running in 'A2A mode'",
      "MCP handles authentication and credential storage between the two parties, while A2A defines the tool schemas and calling conventions — every real deployment runs both, one per layer",
    ],
    correct: 0,
    explanation:
      "MCP is vertical: one agent's connection to its capabilities. A2A (Google-originated) is horizontal: peer agents advertising capabilities via agent cards, accepting tasks, reporting progress — without sharing internals or context, suited to crossing organizational boundaries. One crisp sentence of A2A knowledge is the expected depth here.",
  },
  {
    question: "When should you choose stdio versus streamable HTTP transport?",
    options: [
      "Always streamable HTTP — stdio was the bootstrap transport and is effectively legacy; production means a real web service, and auth, TLS, and logging only exist at the HTTP layer, so starting on stdio just defers the inevitable migration",
      "stdio whenever more than one user needs the server, since spawning a private subprocess per user isolates their sessions — a shared HTTP deployment is the last resort, because multiplexed sessions all run inside one process's trust boundary",
      "stdio when the client and server share a machine and a single user — the client spawns the server as a subprocess, inheriting local trust with zero deployment; streamable HTTP when the server is remote or shared by multiple clients, which brings auth, TLS, and ops obligations",
      "They're fully interchangeable because transport is orthogonal to capabilities — the same decorated functions serve both wires — so the choice is team preference: flip the run() flag whenever convenient, since nothing about authentication, trust, or operations changes with the transport",
    ],
    correct: 2,
    explanation:
      "The decision is topology, not fashion. Local single-user dev tools (Claude Desktop servers, Lab 06's default) fit stdio's process-per-client model. Team-shared or SaaS servers need streamable HTTP — the modern remote transport with streamed responses and session resumability — plus real authentication, because a URL is attack surface.",
  },
  {
    question: "What are the three layers of testing for an MCP server?",
    options: [
      "Linting, type-checking, and schema validation — FastMCP derives schemas from type hints, so a server that passes a strict type-checker is already protocol-correct, and behavior follows from the types",
      "Unit tests on the tool logic as plain functions (mock the real API); integration tests that speak actual MCP — spawn the server over stdio with a ClientSession, list and call tools, assert on results; and adversarial/end-to-end testing through a real client where someone tries to break it (bad IDs, huge queries, destructive calls without confirm)",
      "Load testing, soak testing, and chaos testing — an MCP server is a web service first, so the standard production-readiness ladder applies unchanged and covers the tool logic implicitly along the way",
      "Contract tests validating every message against the spec's published JSON schemas — if each request and response validates, separate unit and integration layers add nothing, because the protocol layer is where servers actually break",
    ],
    correct: 1,
    explanation:
      "Each layer catches what the others can't: unit tests verify logic fast; protocol-level integration tests catch schema generation, serialization, and stdout-pollution bugs invisible to unit tests; adversarial use through a real client (the Gate G3 practical) catches design failures — unhelpful errors, unbounded responses, ungated destructive calls.",
  },
  {
    question:
      "A model keeps calling your destructive delete_project tool during exploratory questions. Which defense is the right FIRST layer, within your server?",
    options: [
      "Remove the tool from the server entirely — destructive operations can never be safely exposed to a model, so deletion has to remain a human-only path, and anything less leaves you one hallucinated argument away from data loss",
      "Rely on the host's human-approval dialog and change nothing server-side — hosts like Claude Desktop already prompt the human before sensitive tool calls, and duplicating that gate inside the server just makes every legitimate deletion a two-step chore for the layer that actually owns the user relationship",
      "Return an 'Are you sure?' message and act when the model replies affirmatively — a natural-language confirmation captures the user's intent without cluttering the schema with an extra parameter the model might set incorrectly",
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
      "Nothing — standardization is precisely how the ecosystem delivers all three: protocol compliance testing enforces a bar on tool quality, capability negotiation keeps unused schemas out of context until the model asks for them, and the initialize handshake authenticates each server before any tools/call is allowed to flow",
      "MCP standardizes the wire only: it says nothing about whether a tool is well-designed, how much context every connected server's schemas consume, or whether a given server's code and output can be trusted — each is a separate problem you still have to solve (Lessons 4 and 5)",
      "It's only one-third wrong — MCP does guarantee tool quality (schemas are validated at tools/list) and context economy (only task-relevant schemas are loaded by default), but server trustworthiness is genuinely out of scope",
      "It's two-thirds wrong — MCP guarantees server trust through mandatory registry review and package signing, but tool quality and context usage are explicitly left to hosts",
    ],
    correct: 1,
    explanation:
      "Standardization is a claim about wire compatibility, not about safety or quality. A protocol-compliant server can still expose a badly-designed tool with a bloated response, and connecting to it is exactly as risky as running that party's code, because that's what you're doing. Treating 'we use MCP' as a safety statement is the mistake this question is checking for.",
  },
  {
    question:
      "You connect five MCP servers averaging eight tools each, and the agent's tool selection gets measurably worse — even though every individual tool is well-designed. What's happening, and what's the fix?",
    options: [
      "Five stdio subprocesses are contending for the host's pipes and scheduler, so tool results arrive slowly and get attributed to the wrong session; fix it by moving the busiest servers to streamable HTTP, where responses stream independently",
      "Every connected server's full tool schemas ride in every request regardless of relevance, and selection accuracy degrades as the visible tool count grows; fix it with deferred loading / a tool-search capability (or manual curation of which servers are connected) rather than editing any single tool's docstring",
      "MCP caps a host at 20 visible tools; past that, the client silently drops schemas from the end of the tools/list response, so some tools are invisible to the model and it substitutes near-matches for the ones it can't see — the fix is staying under the cap, since beyond it selection behavior is undefined by the spec",
      "Merge all five servers into one server exposing a single mega-tool with a 'mode' argument — one schema always costs fewer tokens than forty, and the model only ever has to make one selection decision",
    ],
    correct: 1,
    explanation:
      "This is context bloat: forty schemas' worth of tokens ride in every request whether or not they're relevant, and tool-selection accuracy drops as the count grows, independent of any single tool's quality. Deferred loading / tool search lets the model discover and load only task-relevant schemas; without that capability, curating which servers are connected per session is the manual equivalent. Rewriting one tool's description doesn't fix a volume problem.",
  },
  {
    question:
      "What is the 'confused deputy' problem as it applies to an MCP server, and why does it matter even if every user of your agent is fully trusted?",
    options: [
      "It's a namespace collision: two servers claim the same tool name and the client can't tell which one to route a tools/call to, so the 'deputy' gets confused about which server was meant",
      "A program (the server) holds more authority than the party asking it to act (the model); if untrusted content in the model's context manipulates the model into issuing a tool call, the server executes it with its own full credential because it can't distinguish a genuine user request from a manipulated one — so the risk exists independent of user trust",
      "It only matters when a user is malicious — a trusted user never asks for a harmful call, so with vetted users the deputy has nobody to be confused by, and the right mitigation is user vetting rather than server design",
      "It's a client-side session bug: the wrong session ID gets attached to a tools/call, so one user's request executes with another user's authority — the standard argument for stdio's process-per-client isolation",
    ],
    correct: 1,
    explanation:
      "The server holds real authority (its API credential); the model has none of its own and acts entirely through the server's authority when it calls a tool. If a ticket, web page, or other content in context is engineered to redirect the model, the server sees an identical, well-formed tools/call either way — it can't tell 'the user asked for this' from 'the model was manipulated.' That's why minimal scoping and two-phase confirm matter regardless of how trustworthy the user is.",
  },
  {
    question:
      "What is the 'lethal trifecta,' and why does a well-connected MCP host assemble it easily?",
    options: [
      "The three protocol-level failure modes — version mismatch, capability gap, and stdout pollution — which a well-connected host hits easily because every additional server multiplies handshake and framing surface",
      "An agent that has (1) access to private/sensitive data, (2) exposure to untrusted content such as fetched web pages or tickets, and (3) a channel that can exfiltrate or act on that data — a host with a filesystem server, a web-fetch server, and a write-capable API server live in the same session assembles all three legs without anyone deciding to",
      "Running all three transports at once (stdio, the legacy HTTP+SSE arrangement, and streamable HTTP), which the spec forbids because sessions can't be safely multiplexed across different wires",
      "Three or more servers sharing one OAuth bearer token — well-connected hosts drift toward a single shared credential for convenience, which destroys per-client revocation and attribution the moment it leaks",
    ],
    correct: 1,
    explanation:
      "Private data + untrusted content + an exfiltration/action channel, together in one session, is what turns injected text into real damage — none of the three legs is a problem alone. Mitigations layer: minimize tools that both read untrusted content and act with consequence in the same session, treat every tool result and resource as untrusted input, and gate destructive/write tools behind two-phase confirm so an injected instruction produces a preview, not an action.",
  },
  {
    question:
      "Why is connecting to a third-party MCP server a different — and larger — risk than adding a typical third-party library dependency?",
    options: [
      "It isn't materially different — both are code you didn't write running with access you granted, so the same dependency review (read the source, pin a version, check maintenance) covers both identically, and once that review passes, the server's tool results deserve the same trust as a library's return values, since the audited code is what produces them in both cases",
      "A malicious or compromised MCP server is simultaneously arbitrary code execution (like any dependency) AND a trusted voice inside the model's context — its descriptions shape what the model decides to call and its responses shape what the model does next — so even a server whose code stays clean can start injecting the model via a compromised upstream data source",
      "Third-party MCP servers can't hold credentials of their own — the host injects short-lived, scoped tokens per call and revokes them afterward — so the worst case is bounded to reading data the current session already exposed",
      "The risk runs the other way: an MCP server is sandboxed by the protocol itself — the client validates every message's shape and mediates all I/O — so server-side code risk is eliminated and only the library case can execute arbitrary code on your machine",
    ],
    correct: 1,
    explanation:
      "A library dependency doesn't get to inject instructions into your model's reasoning; an MCP server's tool descriptions and results do, with the same trust as your own system prompt. Vet a third-party server like a production dependency (source, maintenance, least-privileged credentials) — and separately treat everything it returns as untrusted input, because a legitimate server can be compromised upstream and start returning injected content without its published source ever changing.",
  },
];
