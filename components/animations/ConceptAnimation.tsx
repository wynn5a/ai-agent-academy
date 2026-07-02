"use client";

import React from "react";
import type { AnimationName } from "@/lib/types";
import {
  AgentLoopAnim,
  TokenStreamAnim,
  TemperatureAnim,
  ContextWindowAnim,
  ToolCallingAnim,
  ReactPatternAnim,
} from "./FoundationAnims";
import {
  RagPipelineAnim,
  EmbeddingSpaceAnim,
  ChunkingAnim,
  MemoryTypesAnim,
} from "./KnowledgeAnims";
import {
  MultiAgentAnim,
  WorkflowPatternsAnim,
  McpHandshakeAnim,
} from "./ScaleAnims";
import {
  EvalLoopAnim,
  InjectionAttackAnim,
  CapstonePipelineAnim,
} from "./ProdAnims";

const REGISTRY: Record<AnimationName, React.ComponentType> = {
  "agent-loop": AgentLoopAnim,
  "token-stream": TokenStreamAnim,
  temperature: TemperatureAnim,
  "context-window": ContextWindowAnim,
  "tool-calling": ToolCallingAnim,
  "react-pattern": ReactPatternAnim,
  "rag-pipeline": RagPipelineAnim,
  "embedding-space": EmbeddingSpaceAnim,
  chunking: ChunkingAnim,
  "memory-types": MemoryTypesAnim,
  "multi-agent": MultiAgentAnim,
  "workflow-patterns": WorkflowPatternsAnim,
  "mcp-handshake": McpHandshakeAnim,
  "eval-loop": EvalLoopAnim,
  "injection-attack": InjectionAttackAnim,
  "capstone-pipeline": CapstonePipelineAnim,
};

export default function ConceptAnimation({
  name,
  caption,
}: {
  name: AnimationName;
  caption?: string;
}) {
  const Anim = REGISTRY[name];
  if (!Anim) return null;
  return (
    <figure className="border-border my-8 overflow-hidden rounded-xl border bg-[#0d1220]">
      <div className="px-4 pt-4">
        <Anim />
      </div>
      {caption && (
        <figcaption className="border-border/60 border-t px-4 py-2.5 text-center text-xs text-slate-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
