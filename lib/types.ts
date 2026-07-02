// ---------- Content schema for the Agent Engineering Academy ----------

export type CalloutKind = "info" | "tip" | "warning" | "danger" | "insight";

export type Section =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string } // supports **bold**, `code`, [text](url)
  | { type: "list"; ordered?: boolean; items: string[] }
  | { type: "callout"; kind: CalloutKind; title?: string; text: string }
  | {
      type: "code";
      language: string; // "python" | "typescript" | "bash" | "json" | ...
      title?: string;
      code: string;
      explanation?: string; // shown below the block; markdown-lite
    }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "animation"; name: AnimationName; caption?: string }
  | { type: "keypoints"; title?: string; points: string[] };

export type AnimationName =
  | "agent-loop"
  | "token-stream"
  | "temperature"
  | "context-window"
  | "tool-calling"
  | "rag-pipeline"
  | "embedding-space"
  | "chunking"
  | "memory-types"
  | "react-pattern"
  | "multi-agent"
  | "workflow-patterns"
  | "mcp-handshake"
  | "eval-loop"
  | "injection-attack"
  | "capstone-pipeline";

export interface Lesson {
  slug: string;
  title: string;
  minutes: number; // estimated reading time
  summary: string;
  sections: Section[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number; // index into options
  explanation: string;
}

export interface Lab {
  title: string;
  portfolio?: boolean;
  objective: string;
  sections: Section[];
  acceptanceCriteria: string[];
  stretchGoals?: string[];
}

export type ResourceKind =
  | "docs"
  | "guide"
  | "essay"
  | "paper"
  | "repo"
  | "book"
  | "course"
  | "interactive"
  | "benchmark";

export interface Resource {
  title: string;
  url: string;
  description: string;
  kind: ResourceKind;
}

export interface Module {
  id: number;
  slug: string;
  title: string;
  weeks: string; // e.g. "Weeks 1–2"
  phase: number;
  phaseTitle: string;
  description: string;
  outcomes: string[]; // what you'll be able to do
  lessons: Lesson[];
  quiz: QuizQuestion[];
  lab: Lab;
  resources: Resource[];
}

export interface Gate {
  id: string; // "G1"..."G4"
  afterModule: number;
  requirement: string;
}

export const GATES: Gate[] = [
  {
    id: "G1",
    afterModule: 2,
    requirement:
      "Quiz ≥ 80% on Modules 1–2 + Lab 02 meets all acceptance criteria",
  },
  {
    id: "G2",
    afterModule: 4,
    requirement: "Quiz ≥ 80% on Modules 3–4 + Lab 03 eval report reviewed",
  },
  {
    id: "G3",
    afterModule: 6,
    requirement: "Quiz ≥ 80% on Modules 5–6 + MCP server passes its test suite",
  },
  {
    id: "G4",
    afterModule: 8,
    requirement:
      'Full mock interview loop (design + take-home + behavioral) at "hire" bar',
  },
];

export const PASS_THRESHOLD = 0.8;
