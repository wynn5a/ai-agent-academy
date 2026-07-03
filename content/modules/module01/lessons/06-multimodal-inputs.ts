import type { Lesson } from "@/lib/types";

export const lesson06: Lesson = {
  slug: "multimodal-inputs",
  title: "Beyond Text: Images, PDFs & Files",
  minutes: 15,
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
        "Put media blocks **before** the text that asks about them. Images are billed as input tokens — on the order of ~1,500 tokens for a typical image, more at high resolution — so an image-heavy conversation eats the context window fast. Resize client-side when full fidelity isn't needed.",
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
        "Notice the combo: a `document` block **plus** structured outputs from Lesson 4 — multimodal extraction with a guaranteed shape is the pattern behind half of real-world document automation. Mind the limits (tens of MB per request, page caps per model) and count tokens on big documents before sending.",
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
      type: "keypoints",
      points: [
        "`content` is a list of typed blocks — images and PDFs are just more block types in the same stateless array.",
        "Media blocks go before the text that references them; images cost real input tokens (~1.5K+ each).",
        "`document` blocks + structured outputs = schema-guaranteed extraction, the core document-automation pattern.",
        "Base64 for one-offs, URL for hosted media, Files API (`file_id`) for anything reused — plus caching for repeated token cost.",
        "Check per-model limits (request size, page caps) and count tokens before sending large documents.",
      ],
    },
  ],
};
