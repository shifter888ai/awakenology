# Source adapters: conversion acceptance criteria

## Markdown (simple article structure)\n\nA conservative `markdownToHtml` adapter supports headings, paragraphs, inline code, bold/italic/strikethrough, simple ordered/unordered lists, blockquotes, links, and images. Unsafe URLs and unsupported constructs (including raw HTML, tables, task lists, fenced code blocks, and reference-style links) block conversion. This is intentionally not full CommonMark; unsupported syntax must not be silently flattened.\n\n## DOCX (source-fidelity route)

DOCX must be parsed from the actual package, not inferred from a filename or pasted plain text. Implement using a reviewed DOCX parser in a subsequent slice; do not treat this document as evidence that conversion is already working.

Required fixture matrix:
- Headings 1–6, normal paragraphs, blank paragraphs, line breaks, Unicode and CJK punctuation
- Nested bold/italic/underline, red and blue foreground colors, mixed runs
- Ordered/unordered lists and nesting, links with displayed text and actual target
- Tables including merged cells; inline images with relationship targets and alt text
- Footnotes/endnotes, comments, tracked insertions/deletions, text boxes, floating shapes, equations, charts and embedded objects

Rules:
1. Detect package validity, document XML, styles, numbering, relationships and media; reject corrupt/missing parts.
2. Retain source order and exact text; retain formatting spans with source positions.
3. Any feature not faithfully representable in HTML must create a **blocking** issue with a source location. Never silently omit content.
4. Record image counts, identifiers, bytes/checksums, relationships and target output paths. No missing or invented assets.
5. Record original source checksum and an ordered inventory for source-to-output verification.
6. No conversion of tracked changes without explicit editorial resolution.

## Formatted HTML file or paste (CSS-sensitive route)

`inspect-paste.mjs` currently performs strict browser inspection only. It does not sanitize, transform or render the input. Passing inspection must never mean it is safe to inject with innerHTML; generation must construct approved DOM/HTML with escaping and URL policy. The initial allowlist is deliberately narrow. Inline CSS is reviewed, not automatically trusted.

Required browser fixture matrix:
- English, Japanese, Traditional Chinese; exact text and whitespace
- Nested bold/italic, colored spans (red/blue), hyperlinks, lists, tables, inline images
- Unsupported iframes/scripts/forms/events, style URL/expression, unsafe protocols, malformed HTML, comments
- Content that browser DOMParser repairs unexpectedly must be detected by source-to-normalized comparison before acceptance

## Shared output model (not implemented yet)

Every normalized block should carry `language`, `sourceMode`, `sourceLocation`, `type`, `orderedChildren`, `text`, `formatting`, `links`, `assets`, and `issues`. Generator is blocked whenever issues contain an unresolved warning about possible loss or ambiguity.

## Release boundary

Adapters cannot create a PR, edit existing pages or publish. Those are separate, review-gated steps.
