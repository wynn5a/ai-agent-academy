import type { Lesson } from "@/lib/types";

export const lesson01: Lesson = {
  slug: "mcp-architecture-and-protocol",
  title: "MCP Architecture & the JSON-RPC Flow",
  minutes: 25,
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
      type: "keypoints",
      points: [
        "MCP turns N×M bespoke integrations into N clients + M servers speaking one protocol.",
        "Host = the agent app (owns model + user); client = one per server connection inside the host; server = exposes capabilities, executes calls.",
        "**Credentials live server-side, never in model context** — what never enters the context can't leak from it.",
        "Wire = JSON-RPC 2.0: id-paired requests/responses plus fire-and-forget notifications.",
        "Session lifecycle: initialize (capability exchange) → initialized → tools/list → tools/call.",
        "Tool failures return in-band (`isError`) so the model can recover; protocol errors are reserved for protocol problems.",
      ],
    },
  ],
};
