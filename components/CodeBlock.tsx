"use client";

import { useState } from "react";
import clsx from "clsx";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { renderInline } from "@/lib/markdown";
import type { CodeVariant, Provider } from "@/lib/types";
import { PROVIDER_META, type ProviderPref } from "@/lib/provider";

SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("yaml", yaml);

interface Tab {
  provider: "claude" | "openai";
  label: string;
  language: string;
  code: string;
  explanation?: string;
}

export default function CodeBlock({
  language,
  title,
  code,
  explanation,
  provider = "neutral",
  variants,
}: {
  language: string;
  title?: string;
  code: string;
  explanation?: string;
  provider?: Provider;
  variants?: CodeVariant[];
}) {
  const [copied, setCopied] = useState(false);

  // A block becomes tabbed only when it ships alternative provider variants.
  const tabs: Tab[] | null = variants?.length
    ? [
        {
          provider: provider === "openai" ? "openai" : "claude",
          label:
            PROVIDER_META[provider === "openai" ? "openai" : "claude"].label,
          language,
          code,
          explanation,
        },
        ...variants.map((v) => ({
          provider: v.provider,
          label: v.label ?? PROVIDER_META[v.provider].label,
          language: v.language ?? language,
          code: v.code,
          explanation: v.explanation,
        })),
      ]
    : null;

  // Each block keeps its own tab selection — toggling one never moves another.
  const [pref, setPref] = useState<ProviderPref>(
    provider === "openai" ? "openai" : "claude",
  );

  const active: Tab = tabs
    ? (tabs.find((t) => t.provider === pref) ?? tabs[0])
    : { provider: "claude", label: "", language, code, explanation };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <figure className="border-border my-6 overflow-hidden rounded-xl border bg-[#0d1220]">
      <figcaption className="border-border flex items-center gap-3 border-b px-4 py-2">
        {tabs ? (
          <div
            role="tablist"
            aria-label="SDK provider"
            className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-0.5"
          >
            {tabs.map((t) => {
              const isActive = t.provider === active.provider;
              return (
                <button
                  key={t.provider}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setPref(t.provider)}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-white/10 text-slate-100"
                      : "text-slate-500 hover:text-slate-300",
                  )}
                >
                  <span
                    className={clsx(
                      "h-1.5 w-1.5 rounded-full",
                      PROVIDER_META[t.provider].dot,
                      !isActive && "opacity-40",
                    )}
                  />
                  {t.label}
                </button>
              );
            })}
          </div>
        ) : null}
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-400">
          {title ?? active.language}
        </span>
        <button
          onClick={copy}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </figcaption>
      <SyntaxHighlighter
        language={active.language}
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
        {active.code.trimEnd()}
      </SyntaxHighlighter>
      {active.explanation && (
        <div className="border-border border-t bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-slate-400">
          {renderInline(active.explanation)}
        </div>
      )}
    </figure>
  );
}
