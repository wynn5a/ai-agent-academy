import type { Lesson } from "@/lib/types";

export const lesson00: Lesson = {
  slug: "setup",
  title: "Setup: Keys, SDKs, and Your First Call",
  minutes: 15,
  summary:
    "Ten minutes of environment work so every code snippet in this course actually runs: provider accounts, API keys, a Python virtualenv, both SDKs, and a smoke-test call to prove the plumbing before Lesson 1 assumes it.",
  sections: [
    {
      type: "paragraph",
      text: "Everything in this course is raw API calls — no hosted playground, no notebook magic. That's the point: the mechanics you're here to learn live below the frameworks. It also means your machine needs to be able to make those calls before Lesson 1's first example, which casually assumes an installed SDK and an exported API key. Do this setup once now; nothing later will stop to explain it again.",
    },
    {
      type: "heading",
      text: "Accounts and API keys",
    },
    {
      type: "paragraph",
      text: "The course teaches every concept twice — Anthropic first, then the OpenAI equivalent — because real teams run both and interviewers probe for the differences. You only strictly need **one** provider to follow along, but getting both keys now means every tabbed example is runnable:",
    },
    {
      type: "list",
      items: [
        "**Anthropic**: sign in at [console.anthropic.com](https://console.anthropic.com), open **API Keys**, create a key. New accounts need a small prepaid credit before calls succeed.",
        "**OpenAI**: sign in at [platform.openai.com](https://platform.openai.com), open **API keys**, create a key. Same deal — add a small credit balance first.",
      ],
    },
    {
      type: "callout",
      kind: "tip",
      title: "What this course costs to run",
      text: "Individual lesson snippets typically cost fractions of a cent; a full lab session a few dollars; the whole 26 weeks realistically lands in the tens of dollars. Set a monthly spending limit in both consoles anyway — Module 2 builds loops, and a loop without a budget guard is exactly the failure mode you'll learn to prevent.",
    },
    {
      type: "heading",
      text: "Python environment",
    },
    {
      type: "code",
      language: "bash",
      title: "one-time setup (macOS/Linux)",
      code: `mkdir agent-academy && cd agent-academy
python3 -m venv .venv          # Python 3.11+
source .venv/bin/activate
pip install anthropic openai

# keys live in the environment, never in code
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."`,
      explanation:
        'The `export` lines last only for the current shell. To make them permanent, add them to your shell profile (`~/.zshrc` or `~/.bashrc`) — or keep a `.env` file and load it per-project. On Windows PowerShell, replace `source .venv/bin/activate` with `.venv\\Scripts\\Activate.ps1` and `export NAME="..."` with `$env:NAME = "..."`.',
    },
    {
      type: "heading",
      text: "Smoke test: your first call",
    },
    {
      type: "paragraph",
      text: "Run this before moving on. If it prints a sentence, every snippet in the next 39 lessons will run in this same environment.",
    },
    {
      type: "code",
      language: "python",
      title: "smoke_test.py",
      code: `import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment

response = client.messages.create(
    model="claude-sonnet-5",
    max_tokens=100,
    messages=[{"role": "user", "content": "Say hello in exactly five words."}],
)
print(response.content[0].text)`,
      explanation:
        "A successful run prints one short line of text. That's the whole loop you'll spend Module 1 dissecting: request out, tokens back.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `from openai import OpenAI

client = OpenAI()  # reads OPENAI_API_KEY from the environment

response = client.responses.create(
    model="gpt-5.5",
    input="Say hello in exactly five words.",
)
print(response.output_text)`,
          explanation:
            "A successful run prints one short line of text. That's the whole loop you'll spend Module 1 dissecting: request out, tokens back.",
        },
      ],
    },
    {
      type: "callout",
      kind: "info",
      title: "Model IDs drift — snippets don't",
      text: "The model IDs used throughout this course (`claude-sonnet-5`, `claude-haiku-4-5`, `gpt-5.5`, ...) are current as of writing, but providers retire and rename models on their own schedule. If any example fails with a model-not-found error, check the provider's models page and substitute the closest current ID — every other line of the snippet stays the same. Keeping the ID in one constant per project makes that swap a one-line change.",
    },
    {
      type: "heading",
      text: "If the smoke test fails",
    },
    {
      type: "list",
      items: [
        "**401 / authentication error** — the key isn't visible to this shell. `echo $ANTHROPIC_API_KEY` should print it; if not, re-run the `export` (or restart the terminal after editing your profile).",
        "**model not found** — a stale model ID; substitute a current one from the provider's models page.",
        "**credit / billing error** — the account has no prepaid balance yet; add credit in the console.",
        "**`ModuleNotFoundError`** — the virtualenv isn't active; re-run `source .venv/bin/activate` and confirm `which python` points inside `.venv`.",
      ],
    },
    {
      type: "keypoints",
      points: [
        "One provider key is enough to follow along; both keys make every tabbed example runnable.",
        "Keys live in environment variables, never in code — a habit, not a suggestion.",
        "Set a spending limit before Module 2 introduces loops.",
        "Model IDs are the only part of any snippet that goes stale; keep them in one swappable constant.",
        "If the smoke test prints a sentence, your environment is done for the entire course.",
      ],
    },
  ],
};
