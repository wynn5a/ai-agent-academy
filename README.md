# Agent Engineering Academy

Interactive learning platform for the 26-week "Senior AI Agent Engineer" curriculum.
Next.js 14 (App Router) + Tailwind CSS + Framer Motion. No backend — progress, quiz
scores, and gate status live in your browser's localStorage.

## What's inside

- **8 modules · 39 lessons** — rich technical content with inline code examples and explanations
- **16 animated concept diagrams** (agent loop, tool calling, RAG pipeline, MCP handshake, …)
- **96 quiz questions** with per-answer explanations; pass bar 80%, best score persists
- **8 hands-on labs** with acceptance criteria and stretch goals (3 portfolio pieces + capstone)
- **Checkpoint gates G1–G4** computed from lessons + quiz + lab completion

## Run locally

```bash
cd academy
pnpm install
pnpm dev        # http://localhost:3000
```

## Deploy to Vercel

Option A — CLI (fastest):

```bash
cd academy
pnpm install
pnpm dlx vercel          # first run: log in + link project
pnpm dlx vercel --prod
```

Option B — Git: push this folder to a GitHub repo, then vercel.com → Add New →
Project → import the repo. Framework preset "Next.js" is auto-detected; no env
vars or build settings needed.

## Structure

```
app/                    # routes: dashboard, module, lesson, quiz, lab
components/             # Quiz engine, CodeBlock, SectionRenderer, Sidebar
components/animations/  # 16 Framer Motion concept animations
content/modules/        # all course content as typed data (module01–08.ts)
lib/                    # types, localStorage progress store, mini-markdown
```

To edit content, open `content/modules/moduleNN.ts` — everything (lessons,
sections, quizzes, labs) is plain typed data validated by `lib/types.ts`.

## Progress data

Stored under localStorage key `aea-progress-v1`. Clearing site data resets
progress; use the browser's export/import or copy the key value to migrate.
