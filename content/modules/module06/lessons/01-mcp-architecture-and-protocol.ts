import type { Lesson } from "@/lib/types";

export const lesson01: Lesson = {
  slug: "mcp-architecture-and-protocol",
  title: "MCP Architecture & the JSON-RPC Flow",
  minutes: 35,
  summary:
    "Before MCP, every agent app integrated every tool bespoke — an N×M explosion. MCP standardizes the wire: hosts run clients, clients hold 1:1 connections to servers, and everything speaks JSON-RPC 2.0. Learn the three roles and the message flow cold; both are interview staples.",
  sections: [
    {
      type: "paragraph",
      text: "The problem MCP solves is combinatorial. N agent applications (Claude Desktop, IDEs, your custom host) each needing M integrations (GitHub, Jira, your internal API) used to mean N×M bespoke adapters, each with its own auth handling, schema format, and bugs. MCP replaces that with one protocol: a tool provider writes **one server**, any compliant host can use it; a host implements **one client**, and every server on the ecosystem becomes available. Same play as USB-C or ODBC — standardize the connector, commoditize the integrations.",
    },
    {
      type: "animation",
      name: "mcp-handshake",
      caption:
        "Host spawns a client per server; initialize → capability exchange → initialized; then tools/list and tools/call traffic flows.",
    },
    {
      type: "heading",
      text: "Host, client, server — three roles, strict boundaries",
    },
    {
      type: "table",
      headers: ["Role", "What it is", "Responsibilities"],
      rows: [
        [
          "**Host**",
          "The agent application: Claude Desktop, Claude Code, an IDE, your own app",
          "Owns the model loop and the user relationship; decides which servers to connect and what the model may do; enforces human confirmation for sensitive actions",
        ],
        [
          "**Client**",
          "A protocol component *inside* the host — one client per server connection",
          "Maintains a stateful 1:1 session with its server: handshake, request/response plumbing, capability tracking",
        ],
        [
          "**Server**",
          "A standalone program exposing capabilities",
          "Publishes tools/resources/prompts; executes tool calls against the real API; **holds the credentials**",
        ],
      ],
    },
    {
      type: "paragraph",
      text: "The credential rule is the architecture's most important consequence: **secrets live in the server process, never in the model's context.** The model sees a tool named `search_orders` and its schema; it never sees the API key the server uses to fulfill the call. This matters because everything in the model's context can be exfiltrated — by prompt injection (Module 7), by simple model error, or by the model helpfully echoing 'its' configuration. A server-side secret can't leak through a channel it never entered.",
    },
    {
      type: "paragraph",
      text: "Every MCP message on the wire is JSON-RPC 2.0: **requests** carry an `id` and expect a response; **responses** carry the same `id` with a `result` or `error`; **notifications** have no `id` and expect nothing back. A session begins with a mandatory handshake — the client sends `initialize` declaring its protocol version and capabilities, the server responds with its own, and the client fires an `initialized` notification. Capability negotiation is what lets the protocol evolve: a client that doesn't support, say, server-initiated sampling just doesn't advertise it, and the server won't attempt it.",
    },
    {
      type: "code",
      language: "json",
      title: "the initialize handshake",
      code: `{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": { "sampling": {} },
    "clientInfo": { "name": "my-agent-host", "version": "0.1.0" }
  }
}

// server responds with ITS capabilities:
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": {},
      "prompts": {}
    },
    "serverInfo": { "name": "orders-server", "version": "1.0.0" }
  }
}

// client then sends a notification (no id -> no response expected):
{ "jsonrpc": "2.0", "method": "notifications/initialized" }`,
      explanation:
        "Three things to notice: the matching `id: 1` pairs response to request; capabilities are exchanged both ways so each side knows what the other supports (`listChanged: true` means the server will notify when its tool list changes); and the final `initialized` message is a notification — no `id`, fire-and-forget. Protocol version strings are dated; use whatever your SDK pins.",
    },
    {
      type: "code",
      language: "json",
      title: "discovering and calling a tool",
      code: `// client asks what's available:
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }

{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [{
      "name": "search_orders",
      "description": "Search customer orders by text query, status, and date range. Returns order summaries. Use for questions about order history; NOT for refunds (use process_refund).",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query":  { "type": "string" },
          "status": { "type": "string", "enum": ["open", "shipped", "cancelled"] }
        },
        "required": ["query"]
      }
    }]
  }
}

// host's model decides to call it; the client relays:
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": { "name": "search_orders",
              "arguments": { "query": "late delivery", "status": "open" } }
}

{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{ "type": "text", "text": "3 open orders match: ..." }],
    "isError": false
  }
}`,
      explanation:
        "This is Module 1's tool-calling loop with the tool living in another process: the host injects the discovered schemas into the model's context; when the model emits a tool call, the client translates it into `tools/call`; the result content goes back into the messages array as a tool result. Note `isError: false` — tool failures are returned *in-band* as results, not as JSON-RPC protocol errors, so the model can read and recover from them.",
    },
    {
      type: "callout",
      kind: "insight",
      text: "MCP doesn't replace anything you learned in Module 1 — it **relocates** it. Tool schemas, descriptions-as-prompts, the execute-and-return loop: all identical. What changes is *who owns the tool*: instead of a function in your process, it's a capability advertised by a separate program you (or someone else) can reuse across every host. The protocol is boring plumbing by design; the value is the ecosystem the boring plumbing enables.",
    },
    {
      type: "heading",
      text: "Why a protocol at all — and what it doesn't buy you",
    },
    {
      type: "paragraph",
      text: "Put a number on the combinatorics: 5 agent hosts (Claude Desktop, Claude Code, your IDE plugin, a Slack bot, an internal ops console) each wanting to reach 20 tool providers (GitHub, Jira, your CRM, ...) is 100 bespoke integrations without a shared protocol — every pair reinvents auth, retries, error shapes, and schema conventions. With MCP each host writes one client (5) and each provider writes one server (20): 25 components instead of 100, and the count grows additively, not multiplicatively, as either side adds a member. That's the whole economic argument in one line: **standardization turns multiplication into addition.** The actual product of standardizing the wire is more specific than 'fewer lines of code': a server you write once is usable, unmodified, by any compliant host — including hosts that don't exist yet — and a host you build once can adopt any server on the ecosystem without writing a line of provider-specific glue. That's what 'client-agnostic tools' and 'reusable servers' mean in practice, and it's why a GitHub MCP server built by GitHub itself works unmodified in Claude Desktop, Claude Code, and a dozen other hosts.",
    },
    {
      type: "heading",
      text: "What MCP deliberately does not solve",
    },
    {
      type: "paragraph",
      text: "Standardizing the wire is a narrower claim than it sounds, and interviewers probe the boundary. MCP does **not** make your tools good — a protocol-compliant server can still expose `get_data(id)` with a one-line docstring and a token-bloated response; tool design quality is entirely on you (Lesson 4). MCP does **not** manage context — every server you connect adds its tools' full schemas to every request, and the protocol has no opinion on how many servers is too many (next section). And MCP does **not** vet the code running inside a server — the protocol verifies message *shape*, never the server's trustworthiness, so connecting to a third-party server is exactly as risky as running that party's code, because that's exactly what you're doing (Lesson 5 covers this as a supply-chain problem). Treat 'we're using MCP' as a statement about wire compatibility, not a statement about safety or quality.",
    },
    {
      type: "heading",
      text: "Context bloat: what happens when servers pile up",
    },
    {
      type: "paragraph",
      text: "Every tool a client discovers gets its full schema — name, description, JSON schema, all of it — injected into the model's context on every single request, whether or not that tool is relevant to the current turn. Connect five servers averaging eight tools each and you're paying for forty schemas' worth of tokens before the model reads the user's actual question — and Lesson 4's finding holds here too: tool-selection accuracy measurably degrades as the visible tool count grows, so the cost isn't just tokens, it's *worse decisions*. The symptom is specific and diagnosable: if an agent starts calling a plausible-sounding wrong tool, or ignoring a tool it clearly has access to, count how many tools are currently loaded before you touch a single docstring. The mitigation pattern is **deferred loading** (sometimes exposed as a 'tool search' capability): instead of injecting every schema up front, the host exposes a small search/discovery tool, and full schemas are loaded into context only for tools the model has indicated it needs for the current task — pay for what you use, not for what merely exists. If your MCP client doesn't support deferred loading, the manual equivalent is curation: connect fewer servers per session, or split rarely-used tools into a server you attach only when the task actually needs it.",
    },
    {
      type: "heading",
      text: "Versioning and capability negotiation, in practice",
    },
    {
      type: "paragraph",
      text: "The `initialize` handshake isn't decorative — it's how the ecosystem evolves without every client and server needing to ship in lockstep. Two failure modes to recognize: a **version mismatch**, where client and server support non-overlapping protocol versions and the handshake itself should fail cleanly (a well-behaved server responds with the highest version it supports and lets the client decide whether to proceed, rather than silently guessing); and a **capability gap**, where both sides agree on a protocol version but one lacks a specific feature — e.g. a client requesting server-initiated sampling from a server that never advertised it. The contract is that capabilities are *declared, not assumed*: a client must check `capabilities.tools.listChanged` before relying on change notifications, and a server must never invoke a client capability the client didn't advertise in its own `initialize` payload. This is what lets an older client keep working against a newer server (and vice versa, within reason) — each side does only what the other confirmed it understands.",
    },
    {
      type: "exercise",
      kind: "predict",
      prompt:
        "**Predict:** A client sends `initialize` with `\"protocolVersion\": \"2024-11-05\"`. The server only supports `\"2025-03-26\"` and later. What should a well-behaved server do, and what's the failure mode if it instead just replies with its own latest version and proceeds?",
      answer:
        "A well-behaved server detects the unsupported version and returns an error for `initialize` (or negotiates down to the latest version it shares with the client, if a shared version exists) rather than silently proceeding — the client needs an explicit signal that the versions don't match, because it's the one that decided which version to open with. If the server instead just replies with `2025-03-26` and moves on, the client is now speaking a version it never agreed to: it may fail to parse fields the newer version added, silently ignore capabilities it doesn't recognize, or misinterpret a field that changed shape between versions and send malformed `tools/call` requests the server rejects deep into the session — long after the point where the mismatch was cheap to catch. The general principle: version-negotiation failures should surface at the handshake, loudly, not downstream as a mysterious tools/call error five minutes into a demo.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"Your team is debating whether to build a bespoke internal tool-calling layer instead of adopting MCP for a new agent product. Make the case for MCP — and steelman the case against it.\"",
      answer:
        "For MCP: reuse across hosts and tool providers you don't control yet (the N+M argument), a growing ecosystem of pre-built servers (GitHub, Slack, Jira, filesystems) you get for free instead of writing and maintaining, and a spec that's already solved the boring but easy-to-get-wrong parts — capability negotiation, in-band error signaling, session lifecycle. Steelman against: if you have exactly one host and a handful of internal-only tools you'll never expose to a second host or reuse across products, a protocol layer is pure overhead — you pay JSON-RPC framing, transport plumbing, and a spec you don't control, for zero N+M benefit because N=M=1. The honest trigger for adopting MCP isn't 'tools exist,' it's 'more than one host will use these tools, or these tools should be reusable by hosts you don't control yet.' A single internal automation script calling three internal APIs doesn't need MCP; a company standardizing how every internal AI feature reaches its APIs does. **Follow-up probe:** \"what if you're not sure whether a second host is coming?\" → default to a plain function-calling layer for the first host, and reach for MCP the moment a second consumer materializes — the migration cost is bounded (you're mostly rewriting docstrings as decorated functions), while premature protocol adoption costs ongoing complexity for a benefit you may never realize.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"We just connected our agent to eight new MCP servers and now it calls the wrong tool constantly. Walk me through your diagnosis, in order.\"",
      answer:
        "First, count total tools now visible across all eight servers — jumping from, say, 10 to 70 is very likely sufficient explanation on its own, since selection accuracy degrades with visible tool count regardless of description quality. Second, look for near-duplicate tools across servers — two servers each exposing a generic `search` tool is a classic collision the model can't disambiguate; rename or scope by prefix. Third, audit descriptions for missing negative guidance — a tool that doesn't say what it's NOT for gets called for adjacent-but-wrong tasks. Fourth, if the count itself is the driver, look for a deferred-loading or tool-search option in the client rather than trying to prompt-engineer around forty always-visible schemas — that's treating a context-bloat problem as a wording problem. Fifth, only after ruling out volume and collisions, treat it as an individual-tool description bug and iterate on that one tool's docstring. The ordering is the interview signal: junior engineers jump straight to step five without checking whether the real cause is that the model is drowning in forty barely-differentiated options. **Follow-up probe:** \"the client has no tool search feature\" → the manual mitigation is curation: split the eight servers into task-scoped bundles and connect only the bundle relevant to the current session, rather than all eight all the time.",
    },
    {
      type: "keypoints",
      points: [
        "Standardization is additive, not multiplicative: N hosts + M servers costs N+M integrations instead of N×M — and lets components be reused across hosts/providers that don't exist yet.",
        "MCP standardizes the wire, not tool quality, context economy, or server trustworthiness — each is a separate, deliberate design problem (Lessons 4–5).",
        "More connected servers means more schemas riding in every request and worse tool selection; deferred loading / tool search (or manual curation) is the fix, not more prompt tuning.",
        "Capabilities are declared, not assumed — version and capability mismatches should fail at the handshake, loudly, not downstream mid-session.",
        "Host = the agent app (owns model + user); client = one per server connection inside the host; server = exposes capabilities, executes calls.",
        "**Credentials live server-side, never in model context** — what never enters the context can't leak from it.",
        "Wire = JSON-RPC 2.0: id-paired requests/responses plus fire-and-forget notifications.",
        "Session lifecycle: initialize (capability exchange) → initialized → tools/list → tools/call.",
        "Tool failures return in-band (`isError`) so the model can recover; protocol errors are reserved for protocol problems.",
      ],
    },
  ],
};
