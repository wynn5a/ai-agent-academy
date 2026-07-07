# Verification report — Module 1, Lesson 6: Multimodal Inputs
_Date: 2026-07-06 · Files: `content/modules/module01/lessons/06-multimodal-inputs.ts`_

## Verdict at a glance
| Standard | Verdict | One-line reason |
|---|---|---|
| 1. Factual accuracy | ✅ Strong | Every checked claim (image tokens, PDF/request limits, Files API beta status + header, OpenAI file formats) verified against current docs |
| 2. Clarity & fluency | 🟡 Adequate → ✅ Fixed | Three distinct subtopics (images/PDFs/Files API) ran together with only one heading; added three headings |
| 3. Comprehensive depth | 🟡 Adequate → ✅ Fixed | Files API storage/lifecycle facts (beta vs GA, size caps) were missing; folded into new decision table |
| 4. Anthropic + OpenAI | ✅ Strong | Every code block has a real variant with an explanation naming the actual API difference |
| 5. Engaging interactivity | ✅ Strong | 3 concept exercises incl. two capstone drills, 1 interview-angle callout — no change needed |
| 6. Tables/diagrams/animations | 🟠 Needs work → ✅ Fixed | Zero tables/animations despite two explicit prose decision-matrices; added two tables |
| 7. Role alignment | ✅ Strong | Interview-angle callout + 10K-invoices/day capstone drill map directly to document-automation hiring signal |

**Overall:** Factually solid on first read — no blockers. The gap was presentational: numeric comparisons and a three-way decision rule were buried in prose where the exemplar lessons (02, 04) would use tables, and the lesson had almost no headings to separate its three sub-topics. Applied all fixes per your go-ahead; the lesson is now internally consistent with house style and ready to ship.

## Findings (most severe first) — all fixed

### [Major] No table for the base64 / URL / Files API decision matrix
- **Where:** was `06-multimodal-inputs.ts:174-175` (old), in the Files API code block's `explanation`
- **Standard:** 6. Tables/diagrams/animations
- **Issue:** The explanation stated a three-way decision rule ("inline base64 for one-off inputs, URL for already-hosted images, Files API for anything reused...") entirely in prose — exactly the rubric's "multi-way comparison done in prose that begs for a table" smell. Lesson 4's exemplar handles an analogous three/four-way comparison (JSON mode vs native structured outputs vs forced tool call) as a table.
- **Why it matters:** A learner scanning for "which do I use when" has to parse a sentence instead of a glance; interviewers ask this exact question ("design a pipeline...") and a table is how you'd whiteboard the answer.
- **Fix applied:** Added a `Method | Best for | Notes` table right after the Files API code block, before the exercise that already tests this exact decision. Folded in the previously-missing Files API lifecycle/size facts (see Major #2) into the Notes column so nothing was lost from the trimmed explanation.

### [Major] Image-token economics stated as numbers-in-prose instead of a table
- **Where:** was `06-multimodal-inputs.ts:67` (old), the paragraph after the images code block
- **Standard:** 6. Tables/diagrams/animations (secondarily 3. Depth)
- **Issue:** "~1,600 input tokens... up to ~2,500px... ~4,800 tokens — roughly 3×" packed several distinct numbers into one sentence. The current Anthropic vision docs present exactly this as a table (image size → standard-tier tokens → high-res-tier tokens), and confirm the formula (`⌈width/28⌉ × ⌈height/28⌉`, 28×28px patches) that the lesson didn't mention at all.
- **Why it matters:** Cost math is the whole point of the "interview angle" callout later in the lesson ("design a pipeline that processes 10K invoices/day") — a learner needs to glance at real numbers, not parse a run-on sentence, and the patch-tiling mechanism is a senior-level detail (parallel to Lesson 4's "schema compiles to a grammar" mechanism explanation) that was previously just asserted, not explained.
- **Fix applied:** Added the 28×28-patch tiling formula to the prose (mirrors Lesson 4's "how constrained decoding actually works" mechanism-first style), then added a 4-row table with real size/token pairs sourced from current Anthropic docs.

### [Minor] Missing section headings for Images / PDFs / Files API
- **Where:** whole lesson body (old profile: only 1 heading total, before "Whiteboard drills")
- **Standard:** 2. Clarity & fluency, 5. Engaging interactivity
- **Issue:** The lesson covers three clearly distinct sub-topics (images, PDFs, Files API) back-to-back with zero headings dividing them — a marked contrast with the exemplar (Lesson 2: ~9 headings) and Lesson 4 (headings before each major mechanism). The mechanical profile confirmed this quantitatively.
- **Why it matters:** Headings are free navigation and scanning aids; their absence here made the lesson read as one long block despite covering three separable ideas, and made it harder to jump back to "wait, what were the PDF limits again?"
- **Fix applied:** Added `"Images: cost and placement"`, `"PDFs: text and layout together"`, and `"The Files API: upload once, reuse everywhere"` headings at the natural topic boundaries. Profile is now heading=4.

### [Minor] Files API storage/lifecycle facts absent
- **Where:** was the Files API code block's `explanation` (Anthropic side)
- **Standard:** 3. Comprehensive depth
- **Issue:** The lesson never mentioned that Anthropic's Files API is still in beta with an explicit beta-header requirement (it hedged "at the time of writing" in a code comment, which was correct but easy to miss), that files persist until explicitly deleted (no auto-expiry), or the size caps (500 MB/file Anthropic; 50 MB/file+request combined on OpenAI). A senior engineer designing a "reuse across sessions" system needs these numbers to reason about storage costs and cleanup.
- **Why it matters:** "Upload once, reference forever" invites the question "forever how, and does it cost anything to keep around?" — leaving it unanswered is exactly the kind of unhappy-path gap the depth standard flags.
- **Fix applied:** Folded into the new decision-matrix table's Notes column (beta status + header + size caps for both providers), where a learner comparing options will naturally see it.

## Fact-check log
| Claim | Location | Status | Source |
|---|---|---|---|
| Image cost ≈ `⌈w/28⌉×⌈h/28⌉` visual tokens; standard tier max 1568 tokens/1568px, high-res tier max 4784 tokens/2576px; high-res ≈3× standard | `:36` (image code explanation) | **verified** | platform.claude.com/docs/en/docs/build-with-claude/vision — "Resolution and token cost" section, exact 3× phrasing matches |
| PDF request cap 32 MB; page cap 600 (100 for 200k-context models) | PDF code explanation | **verified** | platform.claude.com/docs/en/docs/build-with-claude/pdf-support — "Check PDF requirements" table, exact numbers |
| Files API is still in beta; header `anthropic-beta: files-api-2025-04-14`; `client.beta.files.upload` / `client.beta.messages.create(betas=[...])` | Files API code block | **verified** | platform.claude.com/docs/en/docs/build-with-claude/files — explicit "The Files API is in beta" note, exact header string and SDK calls |
| Anthropic Files API: 500 MB/file, 500 GB/org storage, files persist until deleted | new table (added) | **verified** | same Files API doc, "Storage limits" section |
| OpenAI Files API: GA, `purpose="user_data"` for model-input files, `input_file` block with `file_id` | OpenAI Files variant | **verified** | developers.openai.com file-input-methods docs; no beta header anywhere in OpenAI's file docs |
| OpenAI file size: 50 MB/file, 50 MB combined per request | new table (added) | **verified** | developers.openai.com/api/docs/guides/pdf-files — "Key Constraint" |
| OpenAI base64 PDF: `input_file` + `filename` + `file_data` as `data:` URL | PDF OpenAI variant | **verified** | same OpenAI PDF docs |
| OpenAI base64 image: `input_image` + `image_url` as `data:` URL; text is `input_text` | Image OpenAI variant | **verified** | developers.openai.com/api/docs/guides/images-vision |
| `output_config: {format: {type: "json_schema", schema}}` (Anthropic) / `text: {format: {type: "json_schema", ...}}` (OpenAI) for the PDF extraction example | PDF code block | **verified** | consistent with Lesson 4's already-fact-checked structured-outputs pattern — no drift |

## Mechanical pass
Before fix: `checks.py` clean (0 findings), `tsc --noEmit` clean. Profile: paragraph=4, heading=1, code=3, exercise=3, callout=1, keypoints=1 — 0 tables.
After fix: `checks.py` clean (0 findings), `tsc --noEmit` clean. Profile: paragraph=4, heading=4, code=3, table=2, exercise=3, callout=1, keypoints=1.

## Strengths worth keeping
- The two "Whiteboard drills" exercises (10K-invoices/day capstone; 40 MB scanned PDF) are genuinely senior-level: they force cost math, an escalation ladder, and a RAG cross-reference (correctly deferring to Module 3) rather than a single trivia answer.
- Every code example already had a real Anthropic/OpenAI variant with an explanation naming the actual API-shape difference (not a lazy find-replace) — this was true before any fixes and didn't need touching.
- The `additionalProperties: false` / JSON-schema pattern in the PDF extraction example is consistent with Lesson 4's already-verified structured-outputs conventions — good cross-lesson consistency.
- The concept exercise right after the Files API section already tests the exact base64/URL/Files-API decision now reinforced by the new table — good exercise placement that didn't need to change.
