import type { Lesson } from "@/lib/types";

export const lesson02: Lesson = {
  slug: "building-a-server",
  title: "Building a Server: Tools, Resources & Prompts",
  minutes: 40,
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
      code: `# Colab cell 1 — run once. Installs the official 'mcp' SDK. No external
# API needed: the tool queries an in-memory store so you can see it run.
!pip install -q mcp

import os

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("orders-server")

# Server-side secret: read from the environment, used only inside tool
# bodies, and NEVER placed in a schema, description, or response — the
# model never sees it. A real server passes this to httpx; here we query
# an in-memory store instead so the cell runs offline.
API_KEY = os.environ.get("ORDERS_API_KEY", "dev-key-not-real")

ORDERS = [
    {"id": "A1001", "customer": "Acme",     "status": "open",      "total": 250, "note": "late delivery reported"},
    {"id": "A1002", "customer": "Globex",   "status": "shipped",   "total": 80,  "note": "on time"},
    {"id": "A1003", "customer": "Initech",  "status": "open",      "total": 420, "note": "late delivery, wants refund"},
    {"id": "A1004", "customer": "Umbrella", "status": "cancelled", "total": 15,  "note": "duplicate order"},
]


@mcp.tool()
def search_orders(query: str, status: str = "open", limit: int = 10) -> str:
    """Search customer orders by free-text query and status.

    Returns up to 'limit' order summaries (id, customer, status, total).
    Use for questions about order history or finding a specific order.
    Do NOT use for refunds or edits -- this tool is read-only.
    """
    if status not in {"open", "shipped", "cancelled"}:
        # instructive error the model can act on -- not a stack trace
        return (f"Error: unknown status {status!r}. Valid values: "
                "open, shipped, cancelled.")
    q = query.lower()
    hits = [o for o in ORDERS
            if o["status"] == status and q in o["note"].lower()][:limit]
    lines = [f"{o['id']} | {o['customer']} | {o['status']} | {o['total']}"
             for o in hits]
    return "\\n".join(lines) if lines else "No orders matched."


# In production, mcp.run() serves the server over stdio and a host spawns it;
# in Colab that would block forever. Because @mcp.tool() leaves the function
# a normal callable, we invoke it directly to see the EXACT text the model
# would receive as the tool result:
print(search_orders("late delivery", status="open"))
print("--- unknown status ---")
print(search_orders("late delivery", status="pending"))`,
      explanation:
        "FastMCP derives everything from the function: the **name** from the function name, the **input schema** from type hints (with defaults becoming optional parameters), and the **description** from the docstring. That docstring is being read by a model, not a human — note it states purpose, what's returned, when to use it, and when *not* to. The invalid-status branch returns an instructive string instead of raising: the model can act on 'valid values are X, Y, Z'; it can't act on a stack trace. The demo calls the tool directly so you see its output; a real host would reach it over the protocol (Lesson 3) — either way the returned text is identical. Swap the in-memory `ORDERS` for an `httpx` call using `API_KEY` and nothing else changes.",
    },
    {
      type: "code",
      language: "python",
      title: "the same server: resources and prompts",
      code: `# Colab cell 2 — run cell 1 first (it defines mcp and ORDERS).
def fetch_recent(customer_id: str) -> str:     # stub for your real API call
    hits = [o for o in ORDERS if o["customer"].lower() == customer_id.lower()]
    return "\\n".join(f"{o['id']} | {o['status']} | {o['total']}"
                      for o in hits) or f"No orders for {customer_id!r}."


@mcp.resource("orders://status-codes")
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
            f"Cite specific timestamps.")


# each primitive is a normal callable too — see what each returns:
print("[resource] status_codes:\\n" + status_codes())
print("\\n[resource] recent_orders('Acme'):\\n" + recent_orders("Acme"))
print("\\n[prompt] order_investigation('A1003'):\\n" + order_investigation("A1003"))`,
      explanation:
        "Resources are identified by URI, and templates like `orders://recent/{customer_id}` parameterize them — the host picks which to attach to context. The prompt becomes a user-facing command in clients that support it: a support engineer picks 'order_investigation', supplies the ID, and gets a consistent, well-engineered starting prompt instead of freestyling one. The demo calls all three directly so you can read exactly what each produces; in a real host the *invoker* differs per primitive (model, application, user), but the returned content is what you see here. Ask yourself for each capability: who should decide this gets used? That answer picks the primitive.",
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
      type: "heading",
      text: "Choosing wrong: a design smell audit",
    },
    {
      type: "paragraph",
      text: "When a 'tool' is really reference data the model must remember to call — a `get_status_codes()` tool added so the model can 'look up' values — that's the resource primitive's job, and using a tool for it costs a wasted round trip plus a real chance the model just guesses the values from training data rather than calling the tool at all. The symmetric mistake runs the other way: exposing an action (e.g. 'restart the service') as a resource nobody would ever proactively attach to context is invisible to the model and simply never fires, because nothing in the resource model lets the model *decide* to trigger it. The diagnostic question from the summary — who decides this gets used? — has a companion worth asking for every capability: what happens if the model never calls it? If the answer is 'the task silently degrades to guessing,' it was probably reference data mis-modeled as a tool.",
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "A teammate builds an internal knowledge server. They add `get_company_holidays()` as a **tool** ('call this to see the holiday calendar') and `create_ticket(title, description)` as a **resource** template (`tickets://create/{title}`), reasoning 'resources feel more RESTful for both.' Two weeks in, users report the agent frequently answers holiday questions wrong, and never actually files tickets even when asked to. What's broken, and how do you fix it?",
      answer:
        "Both primitives are backwards, and each failure matches this lesson's control model. `get_company_holidays` is static reference data with no side effects and no situational judgment about *when* to fetch it — that's a resource: the host should attach it to context (or tell the model it's available) proactively, not leave it as a tool the model must remember exists and choose to invoke. Because it's a tool, the model often skips calling it and answers a holiday question from training data instead — plausible-sounding, occasionally wrong, and exactly why retrieval-shaped data belongs in resources rather than gated behind a call the model must decide to make. `create_ticket` is backwards in the other direction: it's an action with side effects that must fire precisely when the model decides a ticket is warranted, mid-conversation — the textbook tool case. Modeled as a resource, nothing ever invokes it, because resources are attached by the *host*, and no host proactively decides 'now is the moment to create a ticket' — there's no mechanism for the model to trigger it at all. Fix: swap them. `get_company_holidays` becomes a resource (`company://holidays`) the host attaches whenever holiday-adjacent context is useful; `create_ticket(title, description)` becomes a tool the model calls mid-task, with a docstring stating purpose, arguments, and confirmation semantics if it should be gated. The interview line: **primitive choice is a control-flow decision, not a styling preference — get it backwards and the capability doesn't just work worse, it doesn't fire.**",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"You're reviewing a new MCP server PR. It has one resource: `data://everything`, which returns the company's entire product catalog as raw JSON — 40,000 items. What's wrong, and what would you ask the author to change?\"",
      answer:
        "This is a resource problem *and* a response-budget problem stacked together. Resources are host-attached rather than model-invoked, but the host still has to put the resource's content into context if it decides to attach it — and 40,000 items of raw JSON is exactly the context-bloat and token-cost disaster Lesson 4's response-budget rules exist to prevent, just triggered from the resource side instead of the tool side. Ask the author three things: does this need to be one resource at all, or should it be parameterized (`data://catalog/{category}`) so the host attaches only the slice relevant to the current task, mirroring how tools take arguments instead of returning everything; is raw JSON the right shape, or should it be pre-summarized the way a well-designed tool response would be; and — the deeper question — is a 40,000-item catalog resource-shaped at all, or is 'search the catalog' a tool the model should call with a query, since nobody realistically wants the entire catalog attached to every conversation touching this server. Probable answer: keep a small resource for genuinely static reference data (e.g. category taxonomy) and convert bulk lookups into a `search_catalog(query)` tool. **Follow-up probe:** \"the author says resources aren't token-metered the way tool calls are, so it's fine\" → that's false economics — whatever gets attached to context still occupies the context window and costs input tokens on every subsequent turn of that conversation, arguably worse than a tool call's one-time cost, because it persists.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"A prompt template you wrote, `order_investigation(order_id)`, works great in Claude Desktop's slash-command UI. A teammate asks why you didn't just make this a tool instead — 'then the model could invoke it automatically when relevant.' Defend the choice.\"",
      answer:
        "The whole value of the prompt primitive is that a human explicitly picks it — not an accidental limitation, the point. `order_investigation` is a procedure a support engineer wants to run deliberately and consistently: same steps, same citation discipline, every time they start investigating a problem order. Making it a tool hands that decision to the model, which now decides whether and when to run the full investigation protocol — including moments the human didn't ask for it, and possibly skipping it when they did. There's a UX argument too: users who want the reusable, well-engineered version of 'investigate an order' benefit from picking it by name rather than hoping their phrasing triggers the right tool call — the same reason slash commands exist in chat products generally, instead of relying purely on natural-language intent detection. The tradeoff is real, though: a prompt template is invisible to the model's own reasoning; if part of the value is the model *deciding* mid-task that a full investigation is warranted — not just the user explicitly starting one — that argues for exposing the same underlying logic as a tool too, since nothing stops a server offering both a prompt template and a tool built on the same procedure for different invocation paths. **Follow-up probe:** \"so should every prompt template also be a tool?\" → no — only when there's a real scenario where the *model*, not the user, should be the one deciding the procedure applies; if it's a human muscle-memory workflow, leave it prompt-only.",
    },
    {
      type: "keypoints",
      points: [
        "Tools are model-invoked; resources are application-invoked; prompts are user-invoked. That's quiz material and a design compass.",
        "Wrong-primitive smell: reference data modeled as a tool gets skipped and guessed instead of called; an action modeled as a resource never fires because nothing invokes it.",
        "Whatever a resource returns still occupies context and costs tokens on every subsequent turn — resources need response budgeting too, not just tools.",
        "FastMCP: `@mcp.tool()` on a typed, docstringed function → name, schema, description generated for you.",
        "Docstrings are prompts — purpose, output shape, limits, and when NOT to use the tool.",
        "Credentials come from env vars into the server process; the model never sees them.",
        "Return errors as instructive text the model can act on, not exceptions.",
        "On stdio, stdout is the wire: log to stderr, never print().",
      ],
    },
  ],
};
