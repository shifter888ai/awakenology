# Source adapters: conversion acceptance criteria

## Markdown (simple article structure)

The conservative `markdownToHtml` adapter supports headings, paragraphs, inline code, bold/italic/strikethrough, simple ordered/unordered lists, blockquotes, approved links, and root-relative local image assets. Unsafe URLs and unsupported constructs (including raw HTML, tables, nested lists, task lists, fenced code blocks, and reference-style links) block conversion. This is intentionally not full CommonMark; unsupported syntax must not be silently flattened.

## DOCX (source-fidelity route)

The adapter reads the actual DOCX package and inventories document XML, styles, numbering, relationships, and media. It resolves supported style inheritance and theme fonts by script/language, preserves paragraph-mark metadata, applies rich formatting, and returns verified content-addressed image assets alongside the HTML preview.

The real multilingual illustrated pilot currently passes:
- Source-map and paragraph-order inspection
- Asset checksum and image-placement inventory
- Rich formatting, numbering, paragraph spacing, and indentation comparison
- Source paragraph text alignment, including safely restored empty paragraphs omitted by Mammoth

The remaining pilot blocker is floating-image visual fidelity. The generated preview shows the floating image inline, which does not prove that Word wrapping and placement match. The preview is **not publishable** until a human compares it against the original Word document.

When floating-image layout is the only remaining extraction blocker, `inspectPageSet` exposes `previewHtml` and the exact `sourceSha256` with `stage: "visual-review-required"`. After visual comparison, pass `floatingImageReviewApprovedSha256` equal to that exact checksum. This clears only the visual-review gate for that unchanged file; all other source/content/fidelity blockers remain blocking.

The adapter remains fail-closed for unsupported or ambiguous features, including unresolved character-based indentation, unrepresented nested list boundaries, and source structures it cannot map unambiguously. No content may be silently discarded.

## Formatted HTML file or paste (supported-markup route)

`inspect-paste.mjs` performs strict browser-style inspection of the parsed document and retains source provenance. It does not sanitize arbitrary HTML for direct `innerHTML` injection. Generation must use the reviewed allowlist, escaping, and URL policy. Inline CSS is reviewed, not automatically trusted.

Unsupported elements, unsafe URL schemes, event handlers, external stylesheets, unreviewed CSS, malformed source repairs that change structure, and content that cannot be aligned with its source inventory remain blocking.

## Shared output model

Normalized blocks carry language, source mode/location, type, ordered children, text, formatting, links, assets, and issues. The generator is blocked whenever an issue indicates possible content loss, unsupported formatting, or ambiguous source-to-rendered alignment.

## Release boundary

Adapters and generators only produce reviewable artifacts. They cannot create a PR, edit existing pages, merge changes, or publish. Those are separate, explicitly review-gated steps.
