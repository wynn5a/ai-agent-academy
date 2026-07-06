import type { Lab } from "@/lib/types";

export const lab06: Lab = {
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
    {
      type: "heading",
      text: "Ship it to your portfolio",
    },
    {
      type: "list",
      items: [
        "**README that demos in 60 seconds:** open with a short GIF or clip of a real client (Claude Desktop or Claude Code) driving your tools — hiring managers look at GitHub before the résumé, and a repo that shows itself working gets read; one that starts with install steps gets skimmed.",
        "**Show the passing test suite:** paste the output of all three test layers (unit, protocol integration, sandbox) into the README. A green test run for an MCP server is exactly the evidence Gate G3 asks for, and it separates an evaluated project from a demo.",
        "**An honest \"Limitations\" section:** what the server doesn't handle (rate-limit backoff strategy, pagination edge cases, which API surface you deliberately skipped) and what you'd do next. Stated limits read as engineering judgment, not weakness.",
        "**Say how you sandboxed and authenticated it:** one short paragraph on the run_python isolation (which container flags, which test proves them) and one on the credential story (env vars, scope, what the stretch-goal HTTP+bearer setup would change). Sandboxed execution is a named skill in agent-engineer postings — make it findable.",
      ],
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
};
