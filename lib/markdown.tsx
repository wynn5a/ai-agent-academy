import React from "react";

/**
 * Tiny inline-markdown renderer: **bold**, `code`, [text](url), *italic*.
 * Emphasis nests (e.g. **bold with *italic* inside**) via recursion.
 * Intentionally minimal — block structure comes from the Section schema.
 */
export function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // order matters: code first so ** inside backticks is untouched
  // bold is non-greedy so it can wrap nested *italic* / `code` / links
  const pattern =
    /(`[^`]+`)|(\*\*.+?\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-sky-300"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-semibold text-slate-100">
          {renderInline(token.slice(2, -2))}
        </strong>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={key++} className="italic">
          {renderInline(token.slice(1, -1))}
        </em>,
      );
    } else {
      const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (m) {
        nodes.push(
          <a
            key={key++}
            href={m[2]}
            target="_blank"
            rel="noreferrer"
            className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
          >
            {m[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
