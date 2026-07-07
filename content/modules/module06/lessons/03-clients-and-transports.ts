import type { Lesson } from "@/lib/types";

export const lesson03: Lesson = {
  slug: "clients-and-transports",
  title: "Clients & Transports: stdio and Streamable HTTP",
  minutes: 35,
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
      type: "heading",
      text: "OAuth for remote servers, concretely",
    },
    {
      type: "paragraph",
      text: "The spec's answer to 'how does a remote MCP server authenticate clients' is an OAuth 2.1-based flow modeled on standard delegated authorization: the client discovers (or is configured with) the server's authorization endpoints, redirects the user through a login/consent screen, and receives a token it attaches to subsequent HTTP requests as a bearer credential — the server never sees the user's actual account password, and the token can be scoped and revoked independently of it. Two consequences worth internalizing for a design or debugging conversation: first, the token is a **bearer** credential — anyone holding it can act as that client, so streamable HTTP transport isn't 'secure' merely because it does OAuth; the token still has to be stored safely and transmitted only over TLS. Second, OAuth authenticates the *client*, not each individual tool call — a compromised client with a valid, unexpired token can call every tool the token's scope allows, which is exactly why least-privilege scoping (Lesson 5) matters as much on the token side as on the server's own downstream API credentials. A stdio server skips all of this by inheriting the OS-level trust of whoever can run the process — a legitimate simplification for a single local user, not a workaround to avoid implementing auth 'for now' on something that's actually going to be shared.",
    },
    {
      type: "exercise",
      kind: "predict",
      prompt:
        "**Predict:** A team ships their internal MCP server over streamable HTTP with a hardcoded, never-rotated bearer token shared by every internal client — 'it's just for the office, and everyone's already on the VPN.' Six months later, what's the most likely way this goes wrong?",
      answer:
        "The token behaves like a static password that never expires and is shared across every consumer — so the first time it leaks (checked into a repo, pasted into a support ticket, left in a client's synced local config), there is no way to revoke access for just the leaked copy without breaking every legitimate client simultaneously, because they're all using the identical credential. There's also no per-client attribution: every tool call looks identical in the server's logs regardless of who actually made it, so when something goes wrong — a destructive tool fires unexpectedly, or a downstream API rate limit gets exhausted — there's no way to trace which client or session was responsible. The VPN argument only covers network-layer access, not application-layer authorization; anyone already inside the VPN (a compromised laptop, a contractor with broader network access than tool access) gets full tool access with zero additional barrier. The fix is per-client OAuth tokens (or at minimum per-client static tokens that can be individually revoked and are logged with caller identity) — cheap to set up early, expensive to retrofit once 'everyone already has the shared token' is the entrenched habit.",
    },
    {
      type: "heading",
      text: "Skipping the client entirely: provider-side MCP connectors",
    },
    {
      type: "paragraph",
      text: "Once your server speaks streamable HTTP, you don't even have to run the MCP client yourself: both major model providers can attach a remote MCP server **server-side**, on their end of the API call. You pass the server's URL in the request; the provider's infrastructure performs the handshake, injects the discovered tool schemas, executes `tools/call` round trips, and returns the finished conversation — your code makes one chat-API call and never touches JSON-RPC. The MCP server itself is identical in both cases, which is the whole point of the protocol: one server, every host, including hosts that are someone else's API.",
    },
    {
      type: "code",
      language: "python",
      title: "attaching a remote MCP server to a model call, server-side",
      provider: "claude",
      code: `# Anthropic Messages API: MCP connector (beta)
import anthropic

client = anthropic.Anthropic()

resp = client.beta.messages.create(
    model="claude-sonnet-5",
    max_tokens=1024,
    betas=["mcp-client-2025-11-20"],
    mcp_servers=[{
        "type": "url",
        "url": "https://orders.example.com/mcp",
        "name": "orders",
    }],
    tools=[{"type": "mcp_toolset", "mcp_server_name": "orders"}],
    messages=[{"role": "user",
               "content": "Any open orders mentioning late delivery?"}],
)
print(resp.content)`,
      explanation:
        "Anthropic's MCP connector is a beta on the Messages API: declare the remote server in `mcp_servers`, then expose its tools to the model with an `mcp_toolset` tool entry. Anthropic's infrastructure runs the MCP client — handshake, tools/list, tools/call — during the request; your code never speaks the protocol.",
      variants: [
        {
          provider: "openai",
          code: `# OpenAI Responses API: remote MCP servers are a built-in tool type
from openai import OpenAI

client = OpenAI()

resp = client.responses.create(
    model="gpt-5.5",
    tools=[{
        "type": "mcp",
        "server_label": "orders",
        "server_url": "https://orders.example.com/mcp",
        "require_approval": "never",
    }],
    input=[{"role": "user",
            "content": "Any open orders mentioning late delivery?"}],
)
print(resp.output_text)`,
          explanation:
            'OpenAI models the same thing as a tool entry with `"type": "mcp"`: give the Responses API the server\'s URL and label, and OpenAI\'s infrastructure connects, discovers tools, and executes calls during the request. `require_approval` controls whether tool calls pause for your approval — "never" only for servers you fully trust (Lesson 5).',
        },
      ],
    },
    {
      type: "paragraph",
      text: "Everything from the rest of this lesson still applies — the provider's connector is just another remote MCP *client*, so your server still needs auth (both vendors let you forward an authorization token for the server), TLS, and the same trust reasoning as any other multi-client deployment. What the connector removes is client plumbing, not responsibility.",
    },
    {
      type: "heading",
      text: "Testing an MCP server",
    },
    {
      type: "paragraph",
      text: "The client you just wrote is more than a demo — it's the middle layer of a three-layer testing story. **Unit tests** exercise the tool logic as plain functions with the real API mocked out: no protocol involved, fast enough to run on every save, verifying the joins, truncation, and error branches. **Protocol integration tests** drive the server the way a host would — spawn it over stdio with a `ClientSession`, `initialize`, `list_tools`, then call each tool and assert on the returned text (including the error strings: 'Ambiguous: 3 customers match' is part of your contract) — this layer catches what unit tests can't see: schema generation from type hints, serialization, stdout pollution. Finally, an **adversarial pass** puts a person (or a model) on the client side actively trying to break the server: nonexistent IDs, expired auth, queries that match everything, destructive calls without confirm. Unit tests prove the logic, integration tests prove the wire, and the adversarial pass proves the design.",
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "A personal GitHub-integration MCP server currently runs over stdio on your laptop. Product wants to make it a shared team tool. Walk me through everything that has to change — not just the transport flag."',
      answer:
        "Frame it as: transport is the easy 5% of this migration, trust boundary is the other 95%. Mechanically, flip `mcp.run()` to `transport=\"streamable-http\"` — that part really is that small, because transport is orthogonal to capabilities. Everything else changes: authentication goes from 'whoever can run this process' to 'every request needs a validated, scoped bearer token' via the spec's OAuth flow, which means standing up token issuance and storage; TLS becomes mandatory, not optional, since bearer tokens over plaintext HTTP are as good as no auth; the server's own downstream GitHub credentials need re-scoping — a personal server used only by you can hold a token with your full personal permissions, a shared server used by a team needs the narrowest token that covers every team member's legitimate use, because now a bug or injected prompt affects everyone connected, not just you; logging needs caller identity attached to every tool call, which didn't matter when there was one user; and operationally, someone now owns uptime, monitoring, and incident response for what used to just die when you closed your laptop. Close with the framing line: stdio's security model is 'inherit the OS,' and the moment you go multi-user that model doesn't degrade gracefully — it stops applying, and you have to build a real one from scratch. **Follow-up probe:** \"what's the single most commonly skipped step?\" → re-scoping the downstream credential — teams reuse the personal, over-permissioned token because it already works, and only notice the blast radius after an incident.",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        '**Drill:** "Give me a scenario where stdio is the better engineering choice even though the team has the infrastructure to run everything as a shared HTTP service."',
      answer:
        "Any tool that only makes sense scoped to one machine and one identity, where the 'shared service' framing actively adds risk without adding value. Concretely: a local filesystem or local-dev-environment MCP server — one that reads files from the user's own project directory, or drives their local git worktree — has no sensible multi-tenant story at all; as a shared HTTP service you're either running it once per user anyway (gaining nothing but auth overhead) or trying to make one process safely access forty different users' filesystems, a much harder and riskier problem than the one you started with. The other classic case is a debugging or admin tool intentionally scoped to 'whoever is sitting at this terminal' — a stdio server run by an on-call engineer during an incident inherits exactly the access that engineer already has, with zero additional attack surface; making it a shared HTTP service would mean building and auditing an entire auth layer for a tool whose entire threat model is 'already-trusted person, already on the machine.' The generalizable test: if the tool's natural scope is inherently single-user and single-machine, HTTP's multi-client story solves a problem you don't have while introducing the auth, TLS, and ops obligations you do have to solve instead. **Follow-up probe:** \"what if that local tool later needs to be triggered remotely, e.g. from CI?\" → that's a genuinely different requirement, not a 'let's future-proof it' preference — build the HTTP version when that concrete need arrives, informed by what CI actually needs to call, rather than speculatively.",
    },
    {
      type: "keypoints",
      points: [
        "A client = transport + `ClientSession`: initialize → list_tools → call_tool. The SDK is a typed veneer over Lesson 1's JSON.",
        "Your integration tests ARE a client: spawn the server via stdio, inject env, assert on results.",
        "stdio: local, single-user, spawned subprocess, zero deploy. Streamable HTTP: remote, multi-client, needs auth + TLS + ops.",
        "Transport is orthogonal to capabilities — same decorated functions serve both.",
        "Remote servers must authenticate clients (OAuth-based flow in the spec / bearer tokens at minimum) and scope their own credentials tightly.",
        "OAuth authenticates the client via a bearer token, not each tool call — an overscoped or leaked shared token gives full, unattributable tool access.",
        "Prefer per-client tokens over one shared static token: revocation and caller attribution both depend on it.",
        'Both major providers can attach a remote MCP server server-side — OpenAI via a `{"type": "mcp"}` tool entry, Anthropic via `mcp_servers` + an `mcp_toolset` tool (beta) — while the server itself stays identical.',
      ],
    },
  ],
};
