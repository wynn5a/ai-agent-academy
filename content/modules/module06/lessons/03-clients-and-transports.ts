import type { Lesson } from "@/lib/types";

export const lesson03: Lesson = {
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
};
