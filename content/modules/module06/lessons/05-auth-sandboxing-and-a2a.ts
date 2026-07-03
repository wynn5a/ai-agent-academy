import type { Lesson } from "@/lib/types";

export const lesson05: Lesson = {
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
};
