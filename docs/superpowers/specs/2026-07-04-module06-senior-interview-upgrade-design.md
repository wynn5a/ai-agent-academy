# Module 6 Senior-Interview Upgrade — Design

**Date:** 2026-07-04
**Goal:** Same four-axis pass as Modules 1–3 (drills, gaps, exercises, deeper why) applied to Module 6 "MCP & Tool Ecosystems," under the user's standing approval.

## Per-lesson changes

1. **01 mcp-architecture-and-protocol** — "why a protocol at all" sharpened into a concrete N×M vs N+M example (5 hosts × 20 servers = 100 vs 25); "what MCP deliberately does not solve" (tool quality, context economy, server trust — cross-referencing Lessons 4–5); context-bloat mechanics for multiple connected servers plus the deferred-loading/tool-search mitigation; versioning and capability-negotiation depth (version mismatch vs. capability gap, "declared not assumed"); predict exercise on a protocol-version mismatch; two whiteboard drills (steelman MCP adoption; diagnosing wrong-tool-calls after connecting eight servers). 25 → 35 min.
2. **02 building-a-server** — "choosing wrong: a design smell audit" deepening resources-vs-tools-vs-prompts with the "what happens if the model never calls it?" diagnostic; spot-the-bug exercise (holiday lookup wrongly built as a tool, ticket creation wrongly built as a resource); two whiteboard drills (a 40k-item resource dump; defending a prompt template against "just make it a tool"). 30 → 40 min.
3. **03 clients-and-transports** — new "OAuth for remote servers, concretely" section (delegated-auth flow, bearer-token semantics, client-level vs. per-call authentication); predict exercise on a shared never-rotated bearer token; two whiteboard drills (migrating a personal stdio server to a shared HTTP service; a scenario where stdio remains the right choice despite available infra). 25 → 35 min.
4. **04 designing-tools-agents-can-use** — explicit cross-reference callout tying the lesson's canon back to Module 1's tool-design section (relocated, not new); "the tool-count tax" section extending the existing tool-count-pressure row into the context-bloat/deferred-loading argument from Lesson 1; spot-the-bug exercise (a well-designed server degrades once combined with six others); two whiteboard drills (reviewing a raw `execute_query(sql)` tool; whether pagination is still right at 40 pages). 25 → 35 min.
5. **05 auth-sandboxing-and-a2a** — the richest gap fill: new sections on the confused-deputy problem, prompt injection via tool results and resource content framed as the lethal trifecta, and supply-chain risk of third-party servers (arbitrary code + a trusted voice in context), with the OAuth-scoping tie-back to Lesson 3; spot-the-bug exercise (an injected "already confirmed" cancellation request inside a support ticket); two whiteboard drills (explaining confused deputy to a skeptical PM; vetting a popular open-source third-party server). 30 → 40 min.

## Quiz

+5 questions (12 → 17): what MCP deliberately does not solve; context bloat from many connected servers and the tool-search/deferred-loading fix; the confused-deputy problem; the lethal trifecta of prompt injection via tool results/resources; supply-chain risk of third-party MCP servers. None re-cover material the original 12 questions already tested (credentials location, primitive taxonomy, handshake, endpoint-mirroring, tool descriptions, response budgeting, error signaling, sandbox properties, A2A, transport choice, testing layers, two-phase confirm).

## Consistency

No stale model IDs, `temperature`/`top_p`/`top_k`, or `resp.content[0].text`-style extraction existed anywhere in `content/modules/module06/` — the module's code examples are MCP server/client code (Python `mcp` SDK), not direct Anthropic API calls, so the course-canon fixes from the Module 1–3 passes had nothing to touch here. Verified via repo-wide grep before and after editing.

## Non-goals

Lab structure, resources, index outcomes, rendering, schema.
