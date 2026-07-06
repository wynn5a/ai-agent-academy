import type { Lesson } from "@/lib/types";

export const lesson06: Lesson = {
  slug: "multimodal-inputs",
  title: "Beyond Text: Images, PDFs & Files",
  minutes: 25,
  summary:
    "Real agent tasks aren't text-only: screenshots in bug reports, invoices as PDFs, documents to extract from. Multimodal input is just more content-block types in the same messages array.",
  sections: [
    {
      type: "paragraph",
      text: "Everything in this module so far sent `content` as a string. The full truth: `content` is a **list of typed blocks**, and text is only one block type. Add an `image` or `document` block and the same stateless, resend-the-array machinery now carries screenshots and PDFs. No new endpoint, no new mental model.",
    },
    {
      type: "code",
      language: "python",
      title: "images: base64 or URL blocks in a user message",
      code: `import base64

img_b64 = base64.standard_b64encode(open("error.png", "rb").read()).decode()

resp = client.messages.create(
    model="claude-sonnet-5", max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {"type": "image",
             "source": {"type": "base64",
                        "media_type": "image/png", "data": img_b64}},
            # or, if it's already hosted:
            # {"type": "image", "source": {"type": "url", "url": "https://..."}},
            {"type": "text", "text": "What's the error in this screenshot, and the likely fix?"},
        ],
    }],
)`,
      explanation:
        "Put media blocks **before** the text that asks about them. Images are billed as input tokens, and the count scales with resolution.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `import base64

img_b64 = base64.standard_b64encode(open("error.png", "rb").read()).decode()

resp = client.responses.create(
    model="gpt-5.5",
    input=[{
        "role": "user",
        "content": [
            {"type": "input_image",
             "image_url": f"data:image/png;base64,{img_b64}"},
            # or, if it's already hosted:
            # {"type": "input_image", "image_url": "https://..."},
            {"type": "input_text",
             "text": "What's the error in this screenshot, and the likely fix?"},
        ],
    }],
)`,
          explanation:
            "OpenAI folds base64 into a `data:` URL on a single `image_url` field (one shape for hosted and inline images) instead of Anthropic's typed `source` object, and text blocks are `input_text`.",
        },
      ],
    },
    {
      type: "paragraph",
      text: "Do the image-token math out loud when asked — it's a resolution question, not a flat fee. A typical image costs on the order of **~1,600 input tokens**; current high-resolution models accept much larger images (up to ~2,500px on the long edge) and a full-resolution image can run to **~4,800 tokens — roughly 3×**. At $3/MTok that's still under 2¢ per image, but three things compound it: images ride in the *history* and get re-billed every turn of the conversation, they eat context-window budget, and at 10K images/day the difference between 1.6K and 4.8K tokens is real money. The lever is **client-side resizing**: downsample to the smallest resolution that preserves what the model needs (reading a screenshot's error text needs far less than reading a dense schematic), and pull the image out of history once it's been discussed.",
    },
    {
      type: "paragraph",
      text: "PDFs work the same way with a `document` block — the model sees both the text layer and the rendered pages, so tables, stamps, and layout survive. This is the workhorse for extraction jobs: invoices, contracts, reports.",
    },
    {
      type: "code",
      language: "python",
      title: "PDFs: document blocks + structured extraction",
      code: `pdf_b64 = base64.standard_b64encode(open("invoice.pdf", "rb").read()).decode()

resp = client.messages.create(
    model="claude-sonnet-5", max_tokens=2048,
    output_config={"format": {"type": "json_schema", "schema": {
        "type": "object",
        "properties": {
            "line_items": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "qty": {"type": "integer"},
                    "unit_price": {"type": "number"},
                },
                "required": ["description", "qty", "unit_price"],
                "additionalProperties": False,
            }},
        },
        "required": ["line_items"],
        "additionalProperties": False,
    }}},
    messages=[{
        "role": "user",
        "content": [
            {"type": "document",
             "source": {"type": "base64",
                        "media_type": "application/pdf", "data": pdf_b64}},
            {"type": "text", "text": "Extract every line item."},
        ],
    }],
)`,
      explanation:
        "Notice the combo: a `document` block **plus** structured outputs from Lesson 4 — multimodal extraction with a guaranteed shape is the pattern behind half of real-world document automation. Know the concrete limits: requests cap around **32 MB**, PDFs at roughly **600 pages** on large-context models (about 100 on smaller ones), and the base64 string must have no newlines. Count tokens on big documents before sending — a long PDF bills both its text layer and its rendered pages.",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `pdf_b64 = base64.standard_b64encode(open("invoice.pdf", "rb").read()).decode()

resp = client.responses.create(
    model="gpt-5.5",
    text={"format": {"type": "json_schema", "name": "invoice",
                     "strict": True, "schema": {
        "type": "object",
        "properties": {
            "line_items": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "qty": {"type": "integer"},
                    "unit_price": {"type": "number"},
                },
                "required": ["description", "qty", "unit_price"],
                "additionalProperties": False,
            }},
        },
        "required": ["line_items"],
        "additionalProperties": False,
    }}},
    input=[{
        "role": "user",
        "content": [
            {"type": "input_file", "filename": "invoice.pdf",
             "file_data": f"data:application/pdf;base64,{pdf_b64}"},
            {"type": "input_text", "text": "Extract every line item."},
        ],
    }],
)
data = json.loads(resp.output_text)`,
          explanation:
            "PDFs go in as `input_file` blocks (base64 via a `data:` URL in `file_data`, vs Anthropic's `document` + `source` object), and the guaranteed shape comes from `text.format` instead of `output_config.format` — same document-plus-schema pattern.",
        },
      ],
    },
    {
      type: "paragraph",
      text: "Inlining base64 is fine for one-shot calls, but an agent that consults the same 200-page handbook every session would resend megabytes per call. The **Files API** fixes that: upload once, get a `file_id`, reference it by id in any later request.",
    },
    {
      type: "code",
      language: "python",
      title: "Files API: upload once, reference forever",
      code: `# upload once (beta header required at the time of writing)
f = client.beta.files.upload(file=open("handbook.pdf", "rb"))

# reference by id in any later request — no re-upload, no base64
resp = client.beta.messages.create(
    model="claude-sonnet-5", max_tokens=1024,
    betas=["files-api-2025-04-14"],
    messages=[{
        "role": "user",
        "content": [
            {"type": "document", "source": {"type": "file", "file_id": f.id}},
            {"type": "text", "text": "What does the vacation policy say?"},
        ],
    }],
)`,
      explanation:
        "Rule of thumb: **inline base64** for one-off inputs, **URL** for already-hosted images, **Files API** for anything reused across requests or sessions. The file content still counts as input tokens each call — the Files API saves upload bandwidth and request size, not token cost (prompt caching handles that part).",
      provider: "claude",
      variants: [
        {
          provider: "openai",
          code: `# upload once
f = client.files.create(file=open("handbook.pdf", "rb"), purpose="user_data")

# reference by id in any later request — no re-upload, no base64
resp = client.responses.create(
    model="gpt-5.5",
    input=[{
        "role": "user",
        "content": [
            {"type": "input_file", "file_id": f.id},
            {"type": "input_text", "text": "What does the vacation policy say?"},
        ],
    }],
)`,
          explanation:
            'OpenAI\'s Files API is GA (no beta header): upload with `purpose="user_data"`, then reference the `file_id` inside an `input_file` block.',
        },
      ],
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "Three inputs: (a) a screenshot a user just pasted into your support bot, (b) a product image already on your CDN, (c) a 300-page compliance manual your agent consults on every run. Base64, URL, or Files API for each — and which one still needs prompt caching to be economical?",
      answer:
        "(a) **base64** — it's a one-off blob you already hold in memory. (b) **URL** — it's hosted; let the provider fetch it. (c) **Files API** — upload once, reference by `file_id`. But (c) still bills its tokens as input on *every* call, so pair the `file_id` reference with **prompt caching** (stable prefix) to cut the repeated cost by ~90%. Files API solves re-uploading; caching solves re-processing.",
    },
    {
      type: "callout",
      kind: "insight",
      title: "Interview angle",
      text: 'Multimodal questions are usually cost questions in disguise: "design a pipeline that processes 10K invoices/day." Strong answers combine this lesson\'s blocks — document input + structured outputs + a cheap model tier + batching — and mention the failure modes: page limits, image token costs, and validating extracted numbers client-side.',
    },
    {
      type: "heading",
      text: "Whiteboard drills",
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** Design the 10K-invoices/day extraction pipeline end-to-end — components, model choice, cost ballpark, and failure handling. This is the capstone question for everything in Module 1.",
      answer:
        '**Shape**: invoices arrive during the day, results needed next morning → throughput problem → **Batch API** (50% off). **Per invoice**: a `document` block + **native structured outputs** with a line-items schema (`additionalProperties: false`, enums where possible), on the **small/fast tier** — extraction is exactly what it\'s for. **Validation layer** (Lesson 4): Pydantic checks the constrained decoder can\'t make — quantities positive, `sum(line_items) == total` (the killer check: the *document itself* provides ground truth) — failures go to a feedback-retry pass, then escalate to the workhorse tier, then to a human queue. **Cost math aloud**: ~3 pages ≈ 5–8K tokens in, ~500 out → 10K × ~7K = 70M input tokens/day; at ~$1/MTok halved by batch ≈ **$35–40/day** plus ~$12 output — say that unit-economics sentence unprompted and you\'ve cleared the bar. **Ops**: `custom_id` = invoice id, per-item failure handling since batch results succeed/fail individually, morning completion check with a real-time fallback lane, and the Lesson 5 log line per item. **Follow-up probes**: "invoices are scanned faxes?" → same API path (the model reads rendered pages), but expect more validation failures — budget a higher escalation rate; "a 900-page contract?" → over the page cap: split client-side and merge results.',
    },
    {
      type: "exercise",
      kind: "concept",
      prompt:
        "**Drill:** A user uploads a 40 MB scanned PDF to your assistant. Walk through what breaks and every option you have.",
      answer:
        "First failure: **request size** — 40 MB of base64 (which inflates size ~33%) blows past the ~32 MB request cap, so inlining is out before the model ever sees it. Options in order: (1) **compress/downsample** the scan client-side — scanned PDFs are usually wildly oversized, and 150 DPI grayscale often preserves legibility at a fraction of the bytes; (2) **split into chunks** under the size and page caps, process per-chunk, merge — with an overlap page if answers can straddle boundaries; (3) **Files API** — solves *re-upload* across requests, but note precisely that it does **not** lift per-request size/page/token limits, a distinction interviewers listen for; (4) if the doc will be queried repeatedly, this is the doorway to **RAG** (Module 3): extract text/regions once, index, retrieve only relevant chunks per question — cheaper than resending 600 pages of rendered scan per query. Also say: scanned means no text layer, so the model works from rendered page images — that's supported, just more tokens and more extraction errors, so validate harder. **Follow-up probe:** \"which option changes if it's 40 MB but only 5 pages?\" → pure resolution problem — downsample; splitting adds nothing.",
    },
    {
      type: "keypoints",
      points: [
        "`content` is a list of typed blocks — images and PDFs are just more block types in the same stateless array.",
        "Media blocks go before the text that references them; images cost resolution-dependent input tokens (~1.6K typical, ~4.8K at full high-res) — resize client-side, and remember they're re-billed every turn they stay in history.",
        "Concrete limits: ~32 MB per request, ~600 PDF pages on large-context models (~100 on smaller) — split or downsample past them.",
        "`document` blocks + structured outputs = schema-guaranteed extraction, the core document-automation pattern.",
        "Base64 for one-offs, URL for hosted media, Files API (`file_id`) for anything reused — plus caching for repeated token cost.",
        "Check per-model limits (request size, page caps) and count tokens before sending large documents.",
      ],
    },
  ],
};
