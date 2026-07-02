import type { Module } from "@/lib/types";

export const module06: Module = {
  id: 6,
  slug: "mcp-tools",
  title: "MCP & Tool Ecosystems",
  weeks: "Weeks 15–17",
  phase: 3,
  phaseTitle: "Scale & interoperability",
  description:
    "The Model Context Protocol is the USB-C of agent tooling: one protocol connecting any agent host to any tool server. You'll learn the architecture and JSON-RPC flow, build a real server and client, master the tool-design principles that make agents actually use your tools well, and run agent-generated code safely in a sandbox.",
  outcomes: [
    "Draw the MCP host/client/server architecture and explain where credentials live and why",
    "Trace the JSON-RPC message flow: initialize handshake, capability negotiation, tools/list, tools/call",
    "Build an MCP server exposing tools, resources, and prompts, and connect it to a real client",
    "Write a stdio MCP client and choose correctly between stdio and streamable HTTP transports",
    "Design task-level tools with prompt-quality descriptions, response budgets, and recoverable errors",
    "Execute agent-generated code in a sandbox (Docker/E2B) with network, memory, and time limits",
  ],
  lessons: [
    {
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
    },
    {
      slug: "building-a-server",
      title: "Building a Server: Tools, Resources & Prompts",
      minutes: 30,
      summary:
        "The official Python SDK's FastMCP style makes a server almost embarrassingly small: decorate functions and run. The real content of this lesson is the three primitives — tools, resources, prompts — and the question that distinguishes them: who invokes each?",
      sections: [
        {
          type: "paragraph",
          text: "MCP servers expose three kinds of capability, and the cleanest way to keep them straight is by **who decides to use them**. **Tools** are *model-controlled*: the model reads the schema and decides mid-task to call one — actions and lookups. **Resources** are *application-controlled*: the host decides which to read and attach to context — files, records, reference data the app surfaces. **Prompts** are *user-controlled*: templates a human explicitly picks (think slash commands) that expand into structured messages. Same server, three different invokers.",
        },
        {
          type: "table",
          headers: ["Primitive", "Invoked by", "Nature", "Example"],
          rows: [
            [
              "Tool",
              "The **model**, mid-task",
              "Action or query with side effects allowed",
              "`search_orders(query, status)`, `create_ticket(...)`",
            ],
            [
              "Resource",
              "The **application/host**",
              "Read-only data identified by URI",
              "`orders://recent`, `file:///docs/policy.md`",
            ],
            [
              "Prompt",
              "The **user**, explicitly",
              "Reusable message template with arguments",
              "`/weekly-report customer=acme`",
            ],
          ],
        },
        {
          type: "code",
          language: "python",
          title: "a FastMCP server: tools",
          code: `# server.py — official 'mcp' Python package, FastMCP style
import os

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("orders-server")

API_BASE = "https://api.example.internal"
API_KEY = os.environ["ORDERS_API_KEY"]     # server-side; model never sees it


@mcp.tool()
def search_orders(query: str, status: str = "open", limit: int = 10) -> str:
    """Search customer orders by free-text query and status.

    Returns up to 'limit' order summaries (id, customer, status, total).
    Use for questions about order history or finding a specific order.
    Do NOT use for refunds or edits -- this tool is read-only.
    """
    resp = httpx.get(
        f"{API_BASE}/orders",
        params={"q": query, "status": status, "limit": limit},
        headers={"Authorization": f"Bearer {API_KEY}"},
        timeout=10.0,
    )
    if resp.status_code == 401:
        return ("Error: orders API rejected credentials. The server's "
                "ORDERS_API_KEY is missing or expired -- tell the user "
                "to check server configuration. Do not retry.")
    resp.raise_for_status()
    orders = resp.json()["orders"]
    lines = [f"{o['id']} | {o['customer']} | {o['status']} | {o['total']}"
             for o in orders]
    return "\\n".join(lines) if lines else "No orders matched."


if __name__ == "__main__":
    mcp.run()        # stdio transport by default`,
          explanation:
            "FastMCP derives everything from the function: the **name** from the function name, the **input schema** from type hints (with defaults becoming optional parameters), and the **description** from the docstring. That docstring is being read by a model, not a human — note it states purpose, what's returned, when to use it, and when *not* to. The 401 branch returns an instructive string instead of raising: the model can act on 'tell the user, do not retry'; it can't act on a stack trace.",
        },
        {
          type: "code",
          language: "python",
          title: "the same server: resources and prompts",
          code: `@mcp.resource("orders://status-codes")
def status_codes() -> str:
    """Reference: every order status code and its meaning."""
    return ("open: placed, not yet shipped\\n"
            "shipped: with carrier\\n"
            "cancelled: cancelled before shipment")


@mcp.resource("orders://recent/{customer_id}")
def recent_orders(customer_id: str) -> str:
    """The 5 most recent orders for one customer, as a summary."""
    return fetch_recent(customer_id)     # your API call


@mcp.prompt()
def order_investigation(order_id: str) -> str:
    """Template for investigating a problematic order end to end."""
    return (f"Investigate order {order_id}. Steps: (1) fetch the order "
            f"and its status history; (2) check shipping events; "
            f"(3) summarize what went wrong and draft a customer reply. "
            f"Cite specific timestamps.")`,
          explanation:
            "Resources are identified by URI, and templates like `orders://recent/{customer_id}` parameterize them — the host picks which to attach to context. The prompt becomes a user-facing command in clients that support it: a support engineer picks 'order_investigation', supplies the ID, and gets a consistent, well-engineered starting prompt instead of freestyling one. Ask yourself for each capability: who should decide this gets used? That answer picks the primitive.",
        },
        {
          type: "callout",
          kind: "tip",
          title: "Docstrings are production prompt engineering",
          text: 'Everything you learned in Module 1 about tool descriptions applies verbatim: the docstring is the *only* thing the model sees when deciding whether and how to call your tool. Budget real effort: purpose, arguments and their formats, output shape, limits, and explicit "do not use for X — use Y instead" redirects. A server with mediocre code and excellent docstrings outperforms the reverse.',
        },
        {
          type: "heading",
          text: "Connecting it to a real client",
        },
        {
          type: "list",
          ordered: true,
          items: [
            "**Claude Desktop:** add your server to `claude_desktop_config.json` under `mcpServers` — a name, a `command` (e.g. `python`), and `args` (the path to server.py, or use `uv run` with your project). Restart the app; the tool icon appears.",
            "**Claude Code:** register with `claude mcp add orders -- python /abs/path/server.py` (stdio), then verify with `/mcp` in a session.",
            "**Debugging:** the MCP Inspector (an official dev tool) connects to your server and lets you list and call tools interactively — use it before blaming the client. And remember: with stdio, **stdout belongs to the protocol** — a stray `print()` corrupts framing. Log to stderr.",
          ],
        },
        {
          type: "callout",
          kind: "warning",
          title: "print() is not your friend anymore",
          text: "The single most common first-server bug: debug prints to stdout interleave with JSON-RPC messages and the client reports a cryptic parse error or hangs. On stdio transport, stdout is the wire. Use `logging` configured to stderr, or print to `sys.stderr`. If your server works in the Inspector but not in Claude Desktop, check for stdout pollution first.",
        },
        {
          type: "keypoints",
          points: [
            "Tools are model-invoked; resources are application-invoked; prompts are user-invoked. That's checkpoint-quiz material and a design compass.",
            "FastMCP: `@mcp.tool()` on a typed, docstringed function → name, schema, description generated for you.",
            "Docstrings are prompts — purpose, output shape, limits, and when NOT to use the tool.",
            "Credentials come from env vars into the server process; the model never sees them.",
            "Return errors as instructive text the model can act on, not exceptions.",
            "On stdio, stdout is the wire: log to stderr, never print().",
          ],
        },
      ],
    },
    {
      slug: "clients-and-transports",
      title: "Clients & Transports: stdio and Streamable HTTP",
      minutes: 25,
      summary:
        "A server nobody can talk to is a file of decorators. Write a minimal client so the protocol stops being abstract, then choose transports deliberately: stdio for local single-user tools, streamable HTTP for anything remote or shared.",
      sections: [
        {
          type: "paragraph",
          text: "Writing a client teaches you what hosts like Claude Desktop actually do on your behalf, and Lab 06's integration tests need one. The Python SDK gives you the pieces: a transport (spawn a subprocess for stdio, or open an HTTP connection) and a `ClientSession` that performs the handshake and speaks the protocol. Fifteen lines of async code and you can list and call tools programmatically — which is exactly what an integration test is.",
        },
        {
          type: "code",
          language: "python",
          title: "a minimal stdio client",
          code: `# client.py — connects to server.py over stdio
import asyncio

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main() -> None:
    params = StdioServerParameters(
        command="python",
        args=["server.py"],
        env={"ORDERS_API_KEY": "test-key-for-dev"},
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()          # the handshake from Lesson 1

            tools = await session.list_tools()
            for t in tools.tools:
                print(t.name, "-", t.description.splitlines()[0])

            result = await session.call_tool(
                "search_orders",
                arguments={"query": "late delivery", "status": "open"},
            )
            print(result.content[0].text)


asyncio.run(main())`,
          explanation:
            "Read it against Lesson 1's JSON: `initialize()` is the handshake, `list_tools()` is `tools/list`, `call_tool()` is `tools/call` — the SDK is a thin, typed veneer over those messages. The client *spawns the server as a subprocess* and owns its lifetime; `env` is how tests inject fake credentials. This exact pattern, wrapped in pytest with assertions on `result.content`, is your Lab 06 integration test.",
        },
        {
          type: "heading",
          text: "Choosing a transport",
        },
        {
          type: "table",
          headers: ["", "stdio", "Streamable HTTP"],
          rows: [
            [
              "Topology",
              "Client spawns server as a local subprocess; pipes are the wire",
              "Server is an independent HTTP service; clients connect over the network",
            ],
            [
              "Users",
              "One client, one server instance, one machine",
              "Many concurrent clients, sessions multiplexed",
            ],
            [
              "Auth",
              "Inherits local trust — whoever can run the process",
              "Required: token/OAuth-based auth at the HTTP layer",
            ],
            [
              "Ops",
              "Nothing to deploy; dies with the client",
              "Deploy, monitor, scale like any web service; supports streaming responses and resumable sessions",
            ],
            [
              "Fits",
              "Personal dev tools, Claude Desktop/Code local servers, Lab 06's default",
              "Team-shared servers, SaaS integrations, anything centrally updated",
            ],
          ],
        },
        {
          type: "paragraph",
          text: "The decision rule is boring and correct: **local and single-user → stdio; remote or multi-user → streamable HTTP.** Streamable HTTP is the modern remote transport in the spec — a single endpoint handling POSTed messages with optional streamed (SSE-style) responses and session resumability; it replaced the older separate HTTP+SSE arrangement. Don't reach for HTTP because it feels more \"production\": a personal GitHub helper on your laptop gains nothing from being a web service, and stdio's process-per-client model gives you isolation for free.",
        },
        {
          type: "code",
          language: "python",
          title: "same server, remote transport",
          code: `# FastMCP servers switch transports at run() time -- the tools,
# resources, and prompts don't change at all.

if __name__ == "__main__":
    import sys

    if "--http" in sys.argv:
        # serves the MCP endpoint over streamable HTTP on a port
        mcp.run(transport="streamable-http")
    else:
        mcp.run()    # stdio default: spawned by the client`,
          explanation:
            "Transport is deliberately orthogonal to capability — that's the protocol working as designed. What *does* change with HTTP is everything around the process: you now need authentication (the spec defines an OAuth-based flow for remote servers; at minimum, require a bearer token), TLS, and to treat every incoming session as untrusted. Exact serving details (port flags, mounting in an ASGI app) vary by SDK version — check its docs rather than memorizing.",
        },
        {
          type: "callout",
          kind: "warning",
          title: "Remote servers are attack surface",
          text: "The moment your server has a URL, it's a web service holding credentials for a real API. Minimum bar: authenticate every client, run TLS, scope the server's own API tokens to the narrowest permissions that work, and log every tool call with caller identity. A stdio server inherits your laptop's trust boundary; an HTTP server has to build its own.",
        },
        {
          type: "animation",
          name: "mcp-handshake",
          caption:
            "Same handshake, either wire: stdio pipes to a subprocess, or streamable HTTP to a remote service — capabilities and messages are identical.",
        },
        {
          type: "keypoints",
          points: [
            "A client = transport + `ClientSession`: initialize → list_tools → call_tool. The SDK is a typed veneer over Lesson 1's JSON.",
            "Your integration tests ARE a client: spawn the server via stdio, inject env, assert on results.",
            "stdio: local, single-user, spawned subprocess, zero deploy. Streamable HTTP: remote, multi-client, needs auth + TLS + ops.",
            "Transport is orthogonal to capabilities — same decorated functions serve both.",
            "Remote servers must authenticate clients (OAuth-based flow in the spec / bearer tokens at minimum) and scope their own credentials tightly.",
          ],
        },
      ],
    },
    {
      slug: "designing-tools-agents-can-use",
      title: "Designing Tools Agents Can Actually Use",
      minutes: 25,
      summary:
        "The interview-gold lesson: most MCP servers fail not at the protocol layer but at the design layer — twelve thin CRUD wrappers, novel-length responses, and errors that read like stack traces. Few good tools beat many thin ones; here's what 'good' means concretely.",
      sections: [
        {
          type: "callout",
          kind: "insight",
          text: "**Design tools around tasks, not endpoints.** Your REST API's shape was designed for programmers who read docs, keep state in variables, and loop cheaply. A model juggles everything in one context window, pays tokens for every byte a tool returns, and gets measurably worse at choosing as the tool count grows. Mirroring 12 CRUD endpoints 1:1 produces an agent that spends five calls and 30k tokens assembling what one well-designed tool should have returned in one shot.",
        },
        {
          type: "table",
          headers: ["", "Endpoint-mirroring (bad)", "Task-level (good)"],
          rows: [
            [
              "Shape",
              "`get_order(id)`, `get_customer(id)`, `list_shipments(order_id)`, `get_shipment(id)`…",
              "`search_orders(query, status, date_range)` returning joined, shaped summaries",
            ],
            [
              "Calls per user question",
              "4–6 chained calls, model does the joins",
              "1–2 calls, server does the joins",
            ],
            [
              "Tokens",
              "Full JSON payloads × every call",
              "Pre-summarized fields the task actually needs",
            ],
            [
              "Failure modes",
              "Model forgets an ID mid-chain, passes wrong FK, wanders",
              "One call, one schema, one place to fail",
            ],
            [
              "Tool-count pressure",
              "Dozens of tools dilute selection accuracy",
              "A handful of tools the model picks reliably",
            ],
          ],
        },
        {
          type: "animation",
          name: "tool-calling",
          caption:
            "Every round trip costs a model call and context tokens — task-level tools collapse call chains the model would otherwise perform itself.",
        },
        {
          type: "code",
          language: "python",
          title: "the rewrite: from get_data(id) to a task-level tool",
          code: `# BAD: the model must already know an ID, gets a raw JSON dump,
# and learns nothing from the name or description.
@mcp.tool()
def get_data(id: str) -> str:
    """Gets data."""
    return str(fetch(id))          # 8k tokens of nested JSON, good luck


# GOOD: named for the task, searchable by what the model actually has
# (words, not IDs), returns shaped text, documents its own limits.
@mcp.tool()
def find_customer_issues(
    customer_name: str,
    status: str = "open",
    max_results: int = 5,
) -> str:
    """Find a customer's support issues by company name.

    Searches customers by name (fuzzy), then returns up to max_results
    issues as lines of: issue_id | title | status | opened_date.
    Use when the user asks about a customer's problems or tickets.
    NOT for creating or editing issues (use create_issue).
    If several customers match the name, returns the candidate list
    instead -- call again with a more specific name.
    """
    customers = crm.search_customers(customer_name)
    if len(customers) > 1:
        names = ", ".join(c.name for c in customers[:5])
        return (f"Ambiguous: {len(customers)} customers match. "
                f"Candidates: {names}. Call again with a full name.")
    if not customers:
        return (f"No customer found matching '{customer_name}'. "
                f"Check spelling, or try a shorter fragment of the name.")
    issues = crm.issues(customers[0].id, status=status)[:max_results]
    return "\\n".join(f"{i.id} | {i.title} | {i.status} | {i.opened}"
                      for i in issues)`,
          explanation:
            'Every choice here is a design principle. The tool takes what the model *has* (a name from the conversation) rather than what the API *wants* (a UUID). The ambiguous-match and no-match branches return **instructive text that tells the model its next move** — this is what "errors the model can recover from" means in practice, versus an exception that kills the call and teaches nothing. And output is shaped lines, not raw JSON: the model reads it just as well at a tenth of the tokens.',
        },
        {
          type: "heading",
          text: "Response budgeting",
        },
        {
          type: "paragraph",
          text: "A tool that can return 200k tokens is a denial-of-service attack on your own agent: one call evicts the system prompt's influence, drowns the actual task, and may simply overflow the window. Every tool needs a **response budget**: a hard cap on what it returns, pagination or filtering to stay under it, and — critically — an **explicit signal that more exists and how to get it**. Silent truncation is the worst option, because the model concludes the data doesn't exist and reports wrong answers confidently.",
        },
        {
          type: "code",
          language: "python",
          title: "pagination with honest truncation signals",
          code: `@mcp.tool()
def search_logs(query: str, page: int = 1, page_size: int = 20) -> str:
    """Search application logs. Returns one page of matching lines.

    page_size max is 50. If the response says more pages exist,
    call again with page+1 -- or better, refine the query.
    """
    page_size = min(page_size, 50)                # server-enforced cap
    hits = log_store.search(query)
    total = len(hits)
    start = (page - 1) * page_size
    page_hits = hits[start:start + page_size]

    if not page_hits:
        return (f"No results on page {page} for '{query}' "
                f"({total} total). Try page 1 or broaden the query.")

    body = "\\n".join(h.line[:300] for h in page_hits)   # per-item cap too
    remaining = total - (start + len(page_hits))
    if remaining > 0:
        return (f"Showing {len(page_hits)} of {total} results "
                f"(page {page}).\\n{body}\\n"
                f"MORE AVAILABLE: {remaining} further results -- "
                f"request page {page + 1}, or refine the query to narrow.")
    return f"Showing all {total} results.\\n{body}"`,
          explanation:
            "Layers of defense: a server-enforced `page_size` ceiling (never trust the model's arguments to be reasonable), a per-item length cap, and a loud MORE AVAILABLE trailer that tells the model both *that* it's seeing a partial view and *what to do about it*. The 'refine the query' nudge matters — paging through 40 pages is almost never what the user wanted, and the model will take the hint.",
        },
        {
          type: "paragraph",
          text: 'One more description trick that fixes real behavior: **negative guidance**. If your server has both `search_orders` and `process_refund`, and the model keeps calling search when the user wants a refund, adding "NOT for refunds — use process_refund" to search\'s docstring usually fixes it outright. Descriptions steer selection; when selection is wrong, the cheapest fix is almost always the description, not the code. Treat every wrong-tool-choice bug as a docstring bug until proven otherwise.',
        },
        {
          type: "keypoints",
          points: [
            "Fewer, task-level tools beat many endpoint mirrors: fewer calls, fewer tokens, better selection accuracy.",
            "Tools should accept what the model has (names, natural queries), not what the API wants (internal IDs).",
            'Errors are instructive text with a next move ("ambiguous — call again with full name"), never bare exceptions.',
            "Every tool gets a response budget: server-enforced caps, pagination, and an explicit MORE AVAILABLE signal — silent truncation causes confident wrong answers.",
            "Wrong tool selection is a docstring bug first: add when-to-use and when-NOT-to-use guidance before touching code.",
          ],
        },
      ],
    },
    {
      slug: "auth-sandboxing-and-a2a",
      title: "Auth, Sandboxed Execution & A2A",
      minutes: 30,
      summary:
        "The safety lesson: where secrets live, how destructive tools get gated, and how to run code an agent wrote — which you must treat as untrusted input executing on your machine. Plus the one paragraph you need about A2A.",
      sections: [
        {
          type: "paragraph",
          text: "The trust model in one line: **the model is a clever, unvetted intern; the server is the employee with the keycard.** Credentials enter the server via environment variables (or a secrets manager) and are used inside tool implementations; they never appear in tool schemas, descriptions, responses, or logs. Scope them minimally — a read-only reporting server gets a read-only API token, so that even a fully compromised model session can't write. And any tool that destroys or spends needs a gate the model can't quietly walk through.",
        },
        {
          type: "list",
          items: [
            "**Server-side secrets:** `os.environ` at startup, fail fast with a clear message if missing. Never echo them in errors — sanitize before returning text to the model.",
            "**Minimal scope:** request the narrowest token that supports your tools. Separate read servers from write servers if the underlying API's scopes are coarse.",
            "**Destructive tools need confirmation:** a `confirm: true` parameter that defaults to false, so the first call returns a preview and the actual action requires an explicit second call — ideally surfaced to the human by the host.",
            "**Log every call:** tool name, arguments (sanitized), caller/session, outcome. When something goes wrong you reconstruct it from this log.",
          ],
        },
        {
          type: "code",
          language: "python",
          title: "gating a destructive tool behind confirm",
          code: `@mcp.tool()
def cancel_order(order_id: str, confirm: bool = False) -> str:
    """Cancel an order. DESTRUCTIVE -- cannot be undone.

    Call first with confirm=False (default) to get a preview of what
    will be cancelled. Only call with confirm=True after the user has
    explicitly approved the specific order shown in the preview.
    """
    order = orders_api.get(order_id)
    if order is None:
        return f"No order with id {order_id}. Use search_orders to find it."

    if not confirm:
        return (f"PREVIEW -- no action taken. Would cancel order "
                f"{order_id}: {order.customer}, {order.total}, "
                f"status {order.status}. If the user confirms THIS "
                f"order, call again with confirm=true.")

    orders_api.cancel(order_id)
    return f"Cancelled order {order_id}. Confirmation sent to customer."`,
          explanation:
            "The two-phase shape does three jobs: the preview forces the model to surface specifics to the user before acting; the default-false means a hallucinated or injected 'cancel everything' call is inert; and the docstring instructs the model on the ceremony. Defense in depth still applies — hosts like Claude Desktop add their own human-approval prompts for tool calls, but your server shouldn't rely on every host doing so.",
        },
        {
          type: "heading",
          text: "Sandboxed code execution",
        },
        {
          type: "paragraph",
          text: "A `run_python` tool is enormously useful — data analysis, quick computation, format conversion — and enormously dangerous, because you are executing **code written by a model that can be manipulated by anything in its context**. A prompt-injected web page can make your agent write `import shutil; shutil.rmtree(...)` with complete sincerity. The rule is absolute: **never `exec()` agent code in your server's process.** Run it in a disposable sandbox — a Docker container with no network, capped memory and CPU, a wall-clock timeout, and a non-root user — or use a hosted sandbox service (E2B and similar) that provides the same isolation as an API.",
        },
        {
          type: "code",
          language: "python",
          title: "run_python via a locked-down Docker container",
          code: `import subprocess
import tempfile


@mcp.tool()
def run_python(code: str, timeout_s: int = 30) -> str:
    """Execute Python code in an isolated sandbox and return its output.

    No network access. 512MB memory, 30s wall-clock limit. stdlib only.
    Use for calculations and data transforms; print() what you want back.
    """
    timeout_s = min(timeout_s, 30)
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
        f.write(code)
        host_path = f.name

    cmd = [
        "docker", "run",
        "--rm",                      # disposable: nothing persists
        "--network", "none",         # no exfiltration, no callbacks
        "--memory", "512m",          # no memory bombs
        "--cpus", "1",
        "--pids-limit", "128",       # no fork bombs
        "--read-only",               # immutable filesystem
        "--user", "65534:65534",     # non-root (nobody)
        "-v", f"{host_path}:/code/main.py:ro",
        "python:3.12-slim",
        "timeout", str(timeout_s), "python", "/code/main.py",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True,
                              timeout=timeout_s + 10)
    except subprocess.TimeoutExpired:
        return f"Error: execution exceeded {timeout_s}s and was killed."

    out = proc.stdout[-4000:]        # response budget applies here too
    err = proc.stderr[-2000:]
    if proc.returncode != 0:
        return (f"Code exited with status {proc.returncode}.\\n"
                f"stderr:\\n{err}\\nFix the code and try again.")
    return out if out else "Ran successfully but printed nothing."`,
          explanation:
            "Each flag answers an attack: `--network none` blocks data exfiltration and reverse shells; `--memory`/`--cpus`/`--pids-limit` stop resource-exhaustion bombs; `--read-only` plus `--rm` means nothing persists or gets tampered with; non-root limits what a container escape could reach. Lab 06 requires a test proving the isolation works — run `import socket` code that tries to connect out and assert it fails. Nonzero exits return stderr *to the model* so it can fix its own code, which is the whole workflow.",
        },
        {
          type: "table",
          headers: ["Sandbox property", "Attack it prevents"],
          rows: [
            [
              "No network (or strict allowlist)",
              "Exfiltrating secrets/data, downloading payloads, calling attacker infrastructure",
            ],
            [
              "Memory / CPU / process limits",
              "Resource-exhaustion: memory bombs, spin loops, fork bombs taking down the host",
            ],
            [
              "Wall-clock timeout",
              "Infinite loops burning compute and hanging the agent mid-task",
            ],
            [
              "Ephemeral, read-only, non-root filesystem",
              "Persistence between runs, tampering with the image, privilege escalation from a breakout",
            ],
          ],
        },
        {
          type: "heading",
          text: "A2A: the other protocol",
        },
        {
          type: "paragraph",
          text: "You'll hear MCP and **A2A (Agent-to-Agent, originated at Google)** in the same breath; they solve different problems. **MCP connects an agent to tools and data** — the vertical integration between one model loop and its capabilities. **A2A connects agents to other agents** — opaque peers that advertise capabilities (via \"agent cards\"), accept tasks, and report progress, without exposing their internals or sharing context. In Module 5 terms: your LangGraph nodes shared one state schema inside one process; A2A is for handoffs *across* organizational or vendor boundaries, where the other agent is a black box you talk to, not a node you own. For interviews, one crisp sentence suffices: *MCP is agent-to-tool, A2A is agent-to-agent, and they're complementary — an A2A peer might use MCP internally for its own tools.*",
        },
        {
          type: "keypoints",
          points: [
            "Model = untrusted intern, server = keycard holder: secrets in env vars, minimally scoped, never echoed in output or logs.",
            "Destructive tools: two-phase confirm — preview by default, `confirm: true` for the real action, documented in the docstring.",
            "Never exec() agent code in-process. Sandbox: no network, memory/CPU/pids limits, timeout, read-only ephemeral FS, non-root.",
            "Prove the sandbox with a test: socket-connect code must fail.",
            "Return sandbox stderr to the model so it can fix its own code — bounded by a response budget.",
            "MCP = agent↔tool; A2A = agent↔agent across trust boundaries. Complementary, not competing.",
          ],
        },
      ],
    },
  ],
  quiz: [
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
      question:
        "When should you choose stdio versus streamable HTTP transport?",
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
  ],
  lab: {
    title: "Production-Quality MCP Server",
    portfolio: true,
    objective:
      "Wrap a real API you actually use (Pacvue-adjacent, GitHub, Jira, or similar) in a Python MCP server with task-level tools, a resource, and a prompt — tested at three layers, hardened against bad inputs, with a sandboxed run_python tool. This is the artifact Gate G3's practical test attacks live. Starter code lives in labs/lab06-mcp-server/.",
    sections: [
      {
        type: "heading",
        text: "What you're building",
      },
      {
        type: "paragraph",
        text: 'A stdio MCP server that a stranger could clone, configure with their own credentials, and connect to Claude Desktop or Claude Code by following your README alone. At least four **task-level** tools (not endpoint mirrors), one resource, one prompt. Every tool description states purpose, arguments, output shape, and when *not* to use it. Large results paginate with explicit more-available signals; every error path returns actionable text; one destructive tool hides behind two-phase confirm; and a `run_python` tool executes agent code in a locked-down Docker container. Then you prove all of it with tests. Pick an API you genuinely use — a real one forces the real design decisions (which five *tasks* matter, what a shaped summary looks like, where pagination bites); GitHub or Jira work if work APIs are off-limits, but avoid toys — "production-quality weather wrapper" is an oxymoron on a portfolio.',
      },
      {
        type: "animation",
        name: "tool-calling",
        caption:
          "Gate G3's practical: Claude drives your server through a real client and tries to break it — every failure must be graceful and instructive.",
      },
      {
        type: "heading",
        text: "Suggested structure",
      },
      {
        type: "code",
        language: "python",
        title: "skeleton (fill in the TODOs)",
        code: `# server.py
import os

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("my-api-server")

API_KEY = os.environ.get("MYAPI_KEY")
if not API_KEY:
    raise SystemExit("MYAPI_KEY not set -- see README configuration.")


@mcp.tool()
def search_things(query: str, status: str = "open",
                  page: int = 1, page_size: int = 20) -> str:
    """One-paragraph purpose. Output shape. When NOT to use this.
    Pagination contract: page_size max 50; response states if more exist."""
    # TODO: call the real API; shape results into lines;
    # append MORE AVAILABLE trailer when truncated;
    # branch on 401/404/429 -> instructive error strings
    ...


@mcp.tool()
def dangerous_thing(item_id: str, confirm: bool = False) -> str:
    """DESTRUCTIVE. confirm=False returns a preview only."""
    ...


@mcp.tool()
def run_python(code: str, timeout_s: int = 30) -> str:
    """Sandboxed execution: docker run --rm --network none
    --memory 512m, timeout, non-root, read-only. See Lesson 5."""
    ...


@mcp.resource("myapi://reference/statuses")
def statuses() -> str: ...


@mcp.prompt()
def investigate(item_id: str) -> str: ...


if __name__ == "__main__":
    mcp.run()   # stdio

# tests/test_tools.py        -- unit: tool logic with the API mocked
# tests/test_protocol.py     -- integration: stdio_client + ClientSession,
#                               initialize, list_tools, call each tool,
#                               assert on error strings for bad IDs
# tests/test_sandbox.py      -- prove "import socket; ...connect..." FAILS,
#                               and that a 60s sleep is killed by timeout`,
        explanation:
          "Design decisions that matter: fail fast at startup on missing credentials (a server that starts broken produces mystifying client errors); keep tool logic in plain functions so unit tests don't need the protocol; the integration test IS a stdio client from Lesson 3, spawning the server with fake env; and the sandbox test asserts the negative — network access must fail, timeouts must kill — because an unproven sandbox is a hope, not a control.",
      },
      {
        type: "callout",
        kind: "warning",
        title: "Test the unhappy paths on purpose",
        text: "The acceptance criteria name three error scenarios — wrong ID, expired auth, rate limit — because they're what Gate G3's live attack will use. Each must return text that names the problem and the model's next move. And remember stdio's cardinal rule while debugging: stdout is the wire; log to stderr or your integration tests will fail with parse errors that look like SDK bugs.",
      },
    ],
    acceptanceCriteria: [
      "Python MCP server with ≥4 tools, ≥1 resource, ≥1 prompt; runs over stdio; connects to a real client (Claude Desktop or Claude Code)",
      "Tools are task-level, not endpoint mirrors; every description states purpose, arguments, output shape, and when not to use it",
      'Large results are paginated with explicit "more available" signals; all errors return as actionable messages (tested: wrong ID, expired auth, rate limit)',
      "Credentials come via env vars; one destructive tool is gated behind a confirm: true parameter, documented",
      "Test suite: unit tests for tool logic plus an integration test speaking the MCP protocol",
      "A run_python sandboxed-execution tool — Docker container, no network, 512MB/30s limits — with a test proving socket-connect code fails",
      "README with client setup instructions someone else could follow cold",
    ],
    stretchGoals: [
      "Serve the same server over streamable HTTP behind bearer-token auth, and document the trust-model differences from stdio in the README",
      "Add response-budget telemetry: log tokens-returned per tool call, and use a week of your own usage to tune page sizes and truncation caps",
      "Swap the Docker sandbox for a hosted sandbox service (E2B or similar) behind the same tool interface, proving the isolation tests still pass unchanged",
    ],
  },
};
