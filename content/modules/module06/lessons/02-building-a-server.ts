import type { Lesson } from "@/lib/types";

export const lesson02: Lesson = {
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
};
