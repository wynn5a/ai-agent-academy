import type { Lesson } from "@/lib/types";

export const lesson04: Lesson = {
  slug: "designing-tools-agents-can-use",
  title: "Designing Tools Agents Can Actually Use",
  minutes: 35,
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
      code: `# Colab cell 1 — run once. No external API needed: a stub CRM lets the
# well-designed tool actually run so you can see each branch's output.
!pip install -q mcp

from collections import namedtuple

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("crm-server")

Customer = namedtuple("Customer", "id name")
Issue = namedtuple("Issue", "id title status opened")


class _CRM:                                   # stands in for your real CRM API
    _customers = [Customer("c1", "Acme Corp"), Customer("c2", "Acme Labs"),
                  Customer("c3", "Globex")]
    _issues = {"c3": [Issue("I-9", "checkout 500s", "open", "2026-07-10"),
                      Issue("I-7", "slow search", "open", "2026-07-02")]}

    def search_customers(self, name):
        return [c for c in self._customers if name.lower() in c.name.lower()]

    def issues(self, customer_id, status="open"):
        return [i for i in self._issues.get(customer_id, []) if i.status == status]


crm = _CRM()


# BAD: the model must already know an ID, gets a raw JSON dump,
# and learns nothing from the name or description.
@mcp.tool()
def get_data(id: str) -> str:
    """Gets data."""
    return str(crm._issues.get(id))          # nested JSON dump, good luck


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
                      for i in issues)


# @mcp.tool() leaves each a normal callable — run all three branches:
print("ambiguous ->", find_customer_issues("Acme"))
print("no match  ->", find_customer_issues("Nonexistent"))
print("success   ->\\n" + find_customer_issues("Globex"))`,
      explanation:
        'Every choice here is a design principle, and the printed output makes each one concrete. The tool takes what the model *has* (a name from the conversation) rather than what the API *wants* (a UUID). The ambiguous-match and no-match branches return **instructive text that tells the model its next move** — this is what "errors the model can recover from" means in practice, versus an exception that kills the call and teaches nothing. And output is shaped lines, not raw JSON: the model reads it just as well at a tenth of the tokens. The demo runs all three branches so you can compare their footprints side by side.',
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
      code: `# Colab cell 2 — run cell 1 first (it defines mcp). Stubbed log store.
from collections import namedtuple

LogLine = namedtuple("LogLine", "line")


class _LogStore:                              # stands in for your real log store
    _lines = [LogLine(f"2026-07-17T10:{i:02d}:00 ERROR timeout on shard {i}")
              for i in range(57)]             # 57 matches, to force paging

    def search(self, query):
        return [x for x in self._lines if query.lower() in x.line.lower()]


log_store = _LogStore()


@mcp.tool()
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
    return f"Showing all {total} results.\\n{body}"


# 57 matches, page_size 20 -> page 1 shows the MORE AVAILABLE trailer:
print(search_logs("timeout", page=1, page_size=20))`,
      explanation:
        "Layers of defense: a server-enforced `page_size` ceiling (never trust the model's arguments to be reasonable), a per-item length cap, and a loud MORE AVAILABLE trailer that tells the model both *that* it's seeing a partial view and *what to do about it*. The 'refine the query' nudge matters — paging through 40 pages is almost never what the user wanted, and the model will take the hint. Run the demo and read the trailer: that last line is the difference between the model knowing it saw 20 of 57 and silently concluding there were only 20.",
    },
    {
      type: "paragraph",
      text: 'One more description trick that fixes real behavior: **negative guidance**. If your server has both `search_orders` and `process_refund`, and the model keeps calling search when the user wants a refund, adding "NOT for refunds — use process_refund" to search\'s docstring usually fixes it outright. Descriptions steer selection; when selection is wrong, the cheapest fix is almost always the description, not the code. Treat every wrong-tool-choice bug as a docstring bug until proven otherwise.',
    },
    {
      type: "callout",
      kind: "info",
      title: "This is Module 1's canon, not new canon",
      text: "None of the tool-design principles above are MCP-specific — descriptions carrying the *when* to call a tool, response budgets, recoverable errors are exactly Module 1's tool-design section, applied to a tool that happens to live in a separate process instead of a function in yours. If that section isn't second nature yet, that's the prerequisite reading, not this lesson — MCP doesn't relax any of it, and the stakes are arguably higher: a poorly-designed MCP tool gets reused, flaws included, by every host that connects to your server.",
    },
    {
      type: "heading",
      text: "The tool-count tax, and how to pay less of it",
    },
    {
      type: "paragraph",
      text: "Every principle above compounds badly at scale, because the tool-count problem isn't about any single tool's design — it's an ecosystem cost that grows with the number of servers *connected*, not the number you personally wrote. This is the same context-bloat mechanism Lesson 1 introduced: every tool's full schema rides in every request regardless of relevance, and selection accuracy degrades as that count grows — so a genuinely well-designed five-tool server still contributes to the problem once it sits alongside seven other servers on the same host. The mitigation isn't limited to writing fewer tools per server, though that helps: hosts that support **deferred loading** or a **tool-search** capability let the model discover and load only the schemas relevant to the current task, keeping the always-visible set small no matter how many servers are connected. Where a host doesn't support that, the manual lever is curation — connect the servers relevant to the current project or session, not every server you've ever configured — and treat 'how many tools does the model currently see' as a metric you monitor, not an afterthought.",
    },
    {
      type: "exercise",
      kind: "spot-the-bug",
      prompt:
        "Your `orders-server` from Lesson 2 has five well-designed, task-level tools with excellent docstrings — by itself, agents use it flawlessly. After connecting it alongside six other equally well-designed servers (35 tools total), the same agent starts occasionally calling `search_orders` when the user actually asked about shipments, a mistake it never made before. Nothing about `orders-server` changed. What's the bug, and where do you fix it?",
      answer:
        "There is no bug in `orders-server` — every individual tool is well-described, well-scoped, and would perform fine in isolation. The bug is in the *aggregate*: tool-selection accuracy degrades as total visible tool count grows, independent of any single tool's quality, so a fine tool can start losing selection contests it used to win outright once it's competing against thirty others for the model's attention on every request. Chasing this as a docstring bug on `search_orders` will fail, because that docstring didn't get worse — the field it's competing in got much more crowded. The fix lives at the ecosystem level, not the single-server level: check whether the host supports deferred loading or tool search so only task-relevant schemas are visible; if it doesn't, curate which servers are connected per session rather than leaving all seven always-on; and if a specific cross-server confusion recurs (e.g. `search_orders` vs. some other server's `search_shipments`), disambiguating language in both descriptions can help — but only after ruling out sheer volume as the dominant cause. The interview signal is knowing to look *up a level*, from the tool to the tool set, before touching a docstring that was never the problem.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** \"You've been asked to review a candidate's MCP server design for a senior role. It has exactly one tool: `execute_query(sql: str)`, docstring 'Runs a SQL query against the database.' What do you say?\"",
      answer:
        "This fails nearly every principle in the lesson simultaneously, and naming them in order is the signal. It's the extreme endpoint-mirroring case — instead of mirroring REST endpoints, it mirrors the raw query interface underneath them, forcing the model to already know the schema and write correct SQL and joins itself, strictly harder than the 'model chains four REST calls' anti-pattern the lesson opens with. The response shape is unbounded — a `SELECT *` with no LIMIT can return arbitrarily many rows with no response budget, no pagination, no MORE AVAILABLE signal. The docstring gives zero task guidance — no example questions it answers, no schema description, no when-not-to-use guidance (this tool shouldn't coexist with a task-level `search_orders` that can answer the same question two conflicting ways). And there's a security dimension this lesson didn't cover directly but Lesson 5 will: a tool that accepts arbitrary SQL is one prompt injection away from a destructive `DROP TABLE`, arguing for either eliminating write capability entirely or gating it like the two-phase confirm pattern for destructive tools. The fix is the whole lesson: replace it with task-level tools that encode the actual questions users ask, each with bounded, shaped responses and its own scoped, ideally read-only, database credential. **Follow-up probe:** \"what if some users genuinely need ad hoc SQL access?\" → that's a real, narrower need — expose it as an explicitly-named `run_readonly_query` tool with a read-only credential, a hard row limit, and a docstring that says exactly that, rather than as the server's only tool wearing a generic name.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Your `search_logs` tool from this lesson pages beautifully. A user asks a question that takes 40 pages to fully answer. What actually happens, and is pagination still the right design here?"',
      answer:
        "Walk through the mechanics first: the model calls page 1, sees 'MORE AVAILABLE: 780 further results,' and now decides whether to keep paging — a naive agent loop will often just keep calling page 2, 3, 4..., burning tool-call budget and context tokens on a linear scan that was never going to converge, exactly the failure mode Module 2's termination-and-budgets lesson exists to catch from the loop side. From the tool-design side, though, the real issue is that pagination is right for *browsing* a bounded, roughly-sized result set, but wrong for a query whose result is inherently unbounded — at 40 pages, the tool's own 'or better, refine the query' hint was the correct answer all along, and the response should say so more forcefully: past some threshold (say, more than 3–4 pages remaining), stop offering 'request page N+1' as the primary suggestion and instead say something like 'this query is too broad to page through — add a time range or narrower search term.' That's a response-budget decision made *at the tool*, not left to the agent loop's discipline (which you can't fully control) or the user's patience (which you also can't control). **Follow-up probe:** \"should the tool ever hard-refuse instead of suggesting?\" → for a read-only search tool, no — refusing outright removes the model's ability to still get something useful from the first page; the stronger nudge is enough, paired with the agent-side budget from Module 2 as the backstop that actually prevents the runaway loop.",
    },
    {
      type: "keypoints",
      points: [
        "Fewer, task-level tools beat many endpoint mirrors: fewer calls, fewer tokens, better selection accuracy.",
        "Tools should accept what the model has (names, natural queries), not what the API wants (internal IDs).",
        'Errors are instructive text with a next move ("ambiguous — call again with full name"), never bare exceptions.',
        "Every tool gets a response budget: server-enforced caps, pagination, and an explicit MORE AVAILABLE signal — silent truncation causes confident wrong answers.",
        "Wrong tool selection is a docstring bug first: add when-to-use and when-NOT-to-use guidance before touching code.",
        "The tool-design canon here IS Module 1's — MCP relocates it, doesn't replace or relax it.",
        "Tool count is an ecosystem-level cost: a well-designed server can still degrade selection once combined with others. Deferred loading / tool search / server curation fixes it — not another docstring edit.",
      ],
    },
  ],
};
