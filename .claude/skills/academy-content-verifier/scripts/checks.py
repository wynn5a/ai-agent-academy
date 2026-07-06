#!/usr/bin/env python3
"""Mechanical lint + content profile for Agent Engineering Academy content.

A *floor* beneath the human/AI review, never a substitute for it. Every check
here is deterministic and quote/bracket-aware so it won't false-alarm on prose
that happens to contain bracket-y characters. When a construct can't be parsed
cleanly it's skipped silently — this tool errs toward missing an issue rather
than inventing one, because a noisy linter trains reviewers to ignore it.

Usage:
    python checks.py <file-or-dir> [more files/dirs ...]

Reports, per target and in aggregate:
  * invalid `AnimationName`s (not in the union in lib/types.ts)
  * malformed markdown links ( ]( ... with no close, or empty url )
  * quiz `correct` indices that fall outside their `options` array
  * ragged tables (a row whose width != the header width)
  * a content profile: section-type counts, code blocks by provider and how
    many carry the *other* provider's variant, animations used, exercise and
    callout counts.

Exit status is 0 even when findings exist (it's informational); non-zero only
on a usage error.
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

CALLOUT_KINDS = {"info", "tip", "warning", "danger", "insight", "career"}
EXERCISE_KINDS = {"predict", "spot-the-bug", "concept"}


# ---------- repo + schema discovery ----------

def find_repo_root(start: Path) -> Path | None:
    for cand in [start.resolve()] + list(start.resolve().parents):
        if (cand / "package.json").exists() and (cand / "lib" / "types.ts").exists():
            return cand
    return None


def load_animation_names(root: Path) -> set[str] | None:
    try:
        types = (root / "lib" / "types.ts").read_text(encoding="utf-8")
    except OSError:
        return None
    m = re.search(r"AnimationName\s*=\s*(.*?);", types, re.S)
    if not m:
        return None
    return set(re.findall(r'"([^"]+)"', m.group(1)))


# ---------- quote/bracket-aware array parsing ----------

def extract_array(text: str, i: int):
    """text[i] must be '['. Return (substring_including_brackets, end_index)."""
    if i >= len(text) or text[i] != "[":
        return None, i
    depth = 0
    in_str = False
    q = ""
    j = i
    while j < len(text):
        c = text[j]
        if in_str:
            if c == "\\":
                j += 2
                continue
            if c == q:
                in_str = False
        else:
            if c in "\"'`":
                in_str = True
                q = c
            elif c == "[":
                depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    return text[i : j + 1], j + 1
        j += 1
    return None, len(text)


def top_level_parts(arr: str) -> list[str]:
    """Split the inside of a balanced array on top-level commas, quote-aware."""
    inner = arr[1:-1]
    parts, buf = [], ""
    depth = 0
    in_str = False
    q = ""
    j = 0
    while j < len(inner):
        c = inner[j]
        if in_str:
            buf += c
            if c == "\\" and j + 1 < len(inner):
                buf += inner[j + 1]
                j += 2
                continue
            if c == q:
                in_str = False
            j += 1
            continue
        if c in "\"'`":
            in_str = True
            q = c
            buf += c
        elif c in "[{(":
            depth += 1
            buf += c
        elif c in "]})":
            depth -= 1
            buf += c
        elif c == "," and depth == 0:
            parts.append(buf)
            buf = ""
        else:
            buf += c
        j += 1
    if buf.strip():
        parts.append(buf)
    return [p.strip() for p in parts if p.strip()]


def line_of(text: str, idx: int) -> int:
    return text.count("\n", 0, idx) + 1


# ---------- individual checks ----------

def check_animations(text: str, names: set[str] | None):
    findings = []
    used = []
    for m in re.finditer(r'type:\s*"animation"', text):
        window = text[m.start() : m.start() + 300]
        nm = re.search(r'name:\s*"([^"]+)"', window)
        if not nm:
            continue
        name = nm.group(1)
        used.append(name)
        if names is not None and name not in names:
            findings.append(
                (line_of(text, m.start()), f'invalid animation name "{name}" '
                 f"(not in AnimationName union)")
            )
    return findings, used


def check_links(text: str):
    findings = []
    for m in re.finditer(r"\]\(", text):
        seg = text[m.end() : m.end() + 600]
        close = seg.find(")")
        if close == -1:
            findings.append((line_of(text, m.start()), "markdown link with no closing paren"))
        else:
            url = seg[:close].strip()
            if not url:
                findings.append((line_of(text, m.start()), "markdown link with empty url"))
    return findings


def check_quiz(text: str):
    findings = []
    for m in re.finditer(r"options:\s*", text):
        br = text.find("[", m.end())
        if br == -1 or br - m.end() > 5:
            continue
        arr, end = extract_array(text, br)
        if arr is None:
            continue
        count = len(top_level_parts(arr))
        tail = text[end : end + 300]
        cm = re.search(r"correct:\s*(\d+)", tail)
        if not cm:
            continue
        idx = int(cm.group(1))
        if idx < 0 or idx >= count:
            findings.append(
                (line_of(text, m.start()),
                 f"quiz correct index {idx} out of range for {count} options")
            )
    return findings


def check_tables(text: str):
    findings = []
    for m in re.finditer(r"headers:\s*", text):
        br = text.find("[", m.end())
        if br == -1 or br - m.end() > 5:
            continue
        harr, hend = extract_array(text, br)
        if harr is None:
            continue
        ncols = len(top_level_parts(harr))
        rm = re.search(r"rows:\s*", text[hend : hend + 4000])
        if not rm:
            continue
        rbr = text.find("[", hend + rm.end())
        if rbr == -1:
            continue
        rarr, _ = extract_array(text, rbr)
        if rarr is None:
            continue
        for ri, part in enumerate(top_level_parts(rarr)):
            part = part.strip()
            if not part.startswith("["):
                continue
            row, _ = extract_array(part, 0)
            if row is None:
                continue
            w = len(top_level_parts(row))
            if w != ncols:
                findings.append(
                    (line_of(text, m.start()),
                     f"table row {ri} has {w} cells but header has {ncols}")
                )
    return findings


def profile(text: str):
    types = Counter(re.findall(r'type:\s*"([a-z-]+)"', text))
    providers = Counter(re.findall(r'provider:\s*"(claude|openai|neutral)"', text))
    variants = len(re.findall(r"variants:\s*\[", text))
    kinds = Counter(re.findall(r'kind:\s*"([a-z-]+)"', text))
    callouts = {k: v for k, v in kinds.items() if k in CALLOUT_KINDS}
    exercises = {k: v for k, v in kinds.items() if k in EXERCISE_KINDS}
    return types, providers, variants, callouts, exercises


# ---------- driver ----------

def gather(paths: list[str]) -> list[Path]:
    out = []
    for p in paths:
        pp = Path(p)
        if pp.is_dir():
            out.extend(sorted(pp.rglob("*.ts")))
        elif pp.is_file():
            out.append(pp)
    return out


def main(argv: list[str]) -> int:
    if not argv:
        print("usage: python checks.py <file-or-dir> [more ...]", file=sys.stderr)
        return 2

    files = gather(argv)
    if not files:
        print("no .ts files found in the given paths", file=sys.stderr)
        return 2

    root = find_repo_root(files[0].parent) or find_repo_root(Path.cwd())
    anim_names = load_animation_names(root) if root else None
    if anim_names is None:
        print("! could not load AnimationName union — skipping animation-name validation\n")

    total_findings = 0
    agg_types: Counter = Counter()
    agg_prov: Counter = Counter()
    agg_variants = 0
    agg_anims: Counter = Counter()

    for f in files:
        try:
            text = f.read_text(encoding="utf-8")
        except OSError as e:
            print(f"! cannot read {f}: {e}")
            continue

        findings = []
        af, used = check_animations(text, anim_names)
        findings += af
        findings += check_links(text)
        if f.name == "quiz.ts" or "QuizQuestion" in text:
            findings += check_quiz(text)
        findings += check_tables(text)

        types, prov, variants, callouts, exercises = profile(text)
        agg_types.update(types)
        agg_prov.update(prov)
        agg_variants += variants
        agg_anims.update(used)

        rel = f
        print(f"── {rel}")
        if findings:
            for ln, msg in sorted(findings):
                print(f"   ⚠ line {ln}: {msg}")
            total_findings += len(findings)
        else:
            print("   ✓ no mechanical issues")

        # compact per-file profile
        claude = prov.get("claude", 0)
        openai = prov.get("openai", 0)
        prof_bits = []
        for key in ("paragraph", "heading", "code", "table", "animation",
                    "exercise", "list", "callout", "keypoints", "tab-group"):
            if types.get(key):
                prof_bits.append(f"{key}={types[key]}")
        print("   profile: " + ", ".join(prof_bits))
        if claude or openai or variants:
            print(f"   providers: claude-tagged={claude}, openai-tagged={openai}, "
                  f"variant-blocks={variants}"
                  + ("   ⚑ asymmetric provider tags — one side may be missing its "
                     "counterpart; check both providers are shown"
                     if claude != openai else ""))
        if callouts:
            print("   callouts: " + ", ".join(f"{k}={v}" for k, v in sorted(callouts.items())))
        if exercises:
            print("   exercises: " + ", ".join(f"{k}={v}" for k, v in sorted(exercises.items())))
        if used:
            print("   animations: " + ", ".join(used))
        print()

    print("═══ aggregate ═══")
    print(f"files: {len(files)}   mechanical findings: {total_findings}")
    if agg_types:
        print("sections: " + ", ".join(f"{k}={v}" for k, v in agg_types.most_common()))
    print(f"provider tags: claude={agg_prov.get('claude',0)}, "
          f"openai={agg_prov.get('openai',0)}, "
          f"neutral={agg_prov.get('neutral',0)}, variant-blocks={agg_variants}")
    if agg_anims:
        dupes = {n: c for n, c in agg_anims.items() if c > 1}
        print("animations used: " + ", ".join(f"{n}(x{c})" if c > 1 else n
                                               for n, c in agg_anims.items()))
        if dupes:
            print("  note: repeated animation(s) across scope: "
                  + ", ".join(dupes) + " — fine if intentional, flag if accidental reuse")
    print("\n(reminder: this is the mechanical floor. The seven-standard review "
          "is the actual verification — read the content.)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
