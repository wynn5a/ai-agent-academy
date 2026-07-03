import type { Lesson } from "@/lib/types";

export const lesson04: Lesson = {
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
};
