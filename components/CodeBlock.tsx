"use client";

import { useState } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { renderInline } from "@/lib/markdown";

SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("yaml", yaml);

export default function CodeBlock({
  language,
  title,
  code,
  explanation,
}: {
  language: string;
  title?: string;
  code: string;
  explanation?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <figure className="border-border my-6 overflow-hidden rounded-xl border bg-[#0d1220]">
      <figcaption className="border-border flex items-center justify-between border-b px-4 py-2">
        <span className="font-mono text-xs text-slate-400">
          {title ?? language}
        </span>
        <button
          onClick={copy}
          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-white/5 hover:text-slate-300"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </figcaption>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          background: "transparent",
          fontSize: "0.825rem",
          lineHeight: 1.6,
          padding: "1rem 1.25rem",
        }}
        codeTagProps={{
          style: {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          },
        }}
      >
        {code.trimEnd()}
      </SyntaxHighlighter>
      {explanation && (
        <div className="border-border border-t bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-slate-400">
          {renderInline(explanation)}
        </div>
      )}
    </figure>
  );
}
