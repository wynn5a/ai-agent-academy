import type { Module } from "@/lib/types";
import { lesson01 } from "./lessons/01-mcp-architecture-and-protocol";
import { lesson02 } from "./lessons/02-building-a-server";
import { lesson03 } from "./lessons/03-clients-and-transports";
import { lesson04 } from "./lessons/04-designing-tools-agents-can-use";
import { lesson05 } from "./lessons/05-auth-sandboxing-and-a2a";
import { quiz06 } from "./quiz";
import { lab06 } from "./lab";
import { resources06 } from "./resources";

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
  lessons: [lesson01, lesson02, lesson03, lesson04, lesson05],
  quiz: quiz06,
  lab: lab06,
  resources: resources06,
};
