/**
 * Shared label/dot styling for provider tabs. Each dual-provider block owns
 * its own local tab state (see CodeBlock / TabGroup) — there is no global,
 * site-wide toggle, so flipping one block never moves any other.
 */
export type ProviderPref = "claude" | "openai";

export const PROVIDER_META: Record<ProviderPref, { label: string; dot: string }> =
  {
    claude: { label: "Anthropic", dot: "bg-[#d97757]" },
    openai: { label: "OpenAI", dot: "bg-emerald-400" },
  };
