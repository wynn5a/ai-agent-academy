# Agent Engineering Academy

Interactive learning platform for a 26-week "Senior AI Agent Engineer" curriculum: 8 modules, 39 lessons, 96 quiz questions, 8 hands-on labs, 16 animated concept diagrams. Fully client-rendered — no backend, no database. All progress lives in the browser's `localStorage`.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS v4 · Framer Motion · TypeScript · pnpm.

## Commands

```bash
pnpm dev       # http://localhost:3000
pnpm build
pnpm start
pnpm lint      # eslint . (flat config, eslint-config-next)
pnpm format    # prettier --write .
```

## Where things live

- `content/modules/moduleNN.ts` — the single source of truth for a module's lessons, quiz questions, and lab, as plain typed data validated against `lib/types.ts` (`Module`, `Lesson`, `QuizQuestion`, `Lab`, `Section`). To add or edit course content, edit these files directly — no CMS, no build step beyond TypeScript.
- `content/registry.ts` — aggregates all `moduleNN.ts` files into `modules[]`, plus `PHASES` and `getModule(slug)`.
- `lib/types.ts` — content schema, including `GATES` (checkpoint requirements) and `PASS_THRESHOLD` (0.8).
- `lib/progress.tsx` — `ProgressProvider`/`useProgress()`, a React context backed by `localStorage` key `aea-progress-v1`. Hydration happens in a `useEffect` on mount (client-only) — this is intentional, not fixable via lazy `useState` init, since `localStorage` isn't available during SSR.
- `lib/markdown.tsx` — tiny inline markdown renderer (`**bold**`, `` `code` ``, `[text](url)`) used by lesson/lab prose.
- `components/animations/*` — 16 Framer Motion SVG diagrams, dispatched by name via `components/animations/ConceptAnimation.tsx` (see `AnimationName` in `lib/types.ts`).
- `app/modules/[slug]/{page,quiz/page,lab/page,lessons/[lesson]/page}.tsx` — route handlers. All dynamic route `params` are `Promise`s (Next 15+ convention) — always `await params` before use.

## Styling

Tailwind v4, CSS-first config — there is no `tailwind.config.ts`. Theme customization (colors, fonts, custom `animate-*` keyframes) lives in the `@theme` block at the top of `app/globals.css`. `postcss.config.mjs` uses `@tailwindcss/postcss` (not the `tailwindcss` package directly, and no `autoprefixer` — v4 handles vendor prefixing internally).

## Conventions

- Content files are large (hundreds of lines per module) but are plain data literals — safe to append to without touching rendering logic.
- Gate logic (`gatePassed` in `lib/progress.tsx`) requires 100% lessons done + quiz passed + lab done for every module up to `afterModule`, not just the module the gate is named after.
- ESLint's `react-hooks` plugin is strict about `setState` calls inside effect bodies; the one legitimate exception (localStorage hydration on mount) is annotated with an inline `eslint-disable-next-line` and a comment explaining why — don't remove it or "fix" it into a lazy initializer, since that would break SSR.
