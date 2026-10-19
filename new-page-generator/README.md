# New Page Generator — Phase 3 (isolated development)

Status: work in progress. This directory is **not a publishing endpoint**. Nothing here changes the frozen `/editor/`, existing pages, Worker routing, sitemap, or production content.

## Contract

- One logical page set contains supplied English, Japanese, and Traditional Chinese content. Missing language input is a blocking error. Never auto-translate or invent article text.
- Accepted source modes: Markdown (`.md`) for simple article structure, formatted HTML paste or `.html` for CSS-sensitive content, and DOCX for original Word documents that need source-level fidelity. Markdown support is intentionally conservative: headings, paragraphs, bold/italic/strikethrough, basic ordered/unordered lists, blockquotes, links, and images. Raw HTML, tables, task lists, fenced code blocks, and reference-style links are blocked until explicit support and tests exist. The DOCX text extractor is conservative and fail-closed; it now integrates `inspect-docx-assets.mjs` to extract checksum-verified inline image bytes, use content-addressed asset paths, preserve image alt text in converted HTML, and block any inspected image missing from output. Synthetic fixture tests cover this integration. This is not yet a complete end-to-end normalized content model, and must not be treated as approval to generate the pilot.
- Both sources must normalize into a common ordered content inventory, preserving headings, paragraphs, formatting, links, lists, tables, images and intentional whitespace. Any unsupported or ambiguous construct blocks generation pending review.
- Build-time shared shell produces complete static HTML for each language; no runtime fetch of headers/footers.
- Use the approved navigation, theme behavior, monochrome circled-A branding, Contact/Reddit/Disclaimer footer and © 2017 Awakenology. Canonical host: https://awakenology.space.
- Validate source-to-output text and content-bearing element inventories, assets, route uniqueness, HTML structure, SEO metadata, hreflang reciprocity, internal links and sitemap changes. A character count alone is not sufficient.
- Generate a review report and full-page previews; only an explicitly reviewed Draft PR may enter the existing CI and approval process.
- Never write to `main`, merge, deploy, or edit existing article files as a side effect of generation.

## Delivery slices

1. Establish the isolated generator specification and source inventory (this commit).
2. Implement and test DOCX, HTML paste, and conservative Markdown adapters with fixture coverage for EN/JP/zh-Hant and tricky formatting.
3. Implement the common content model and strict loss/ambiguity reporting.
4. Implement a versioned static shell derived from verified existing site components.
5. Generate three complete pages, reports and preview artifacts without publishing.
6. Pilot against owner-supplied representative source; compare content block by block.
7. Open a Draft PR for owner review. Merge/deployment require separate approval.

## Existing-site observations (read-only inspection, 2026-10-18)

- `index.html` includes the circled-A SVG; the representative `與退化派對話8/index.html` article has a text-only brand.
- `English/index.html`, `Japanese/index.html`, `Chinese/index.html`, and the article use differing typography, header spacing and footer styles.
- `ai-search/index.html` uses text labels for Contact/Disclaimer rather than the icon markup on the homepage.
- Therefore, do **not** copy an arbitrary page's entire shell verbatim. Extract and test an approved shared shell for *new* output only. Leave existing pages untouched.

## Explicit non-goals

No site-wide global header/footer migration, no runtime template loading, no automatic translation, no silent DOCX feature dropping, no changes to the private editor, no production release during Phase 3.

## Latest verification note

The coordinator has a tested positive path for a minimal, supported synthetic DOCX: it emits static HTML only after independently comparing source and rendered rich-content inventories. It also has fail-closed tests for changed reviewed text and unsupported font metadata. This is not equivalent to supporting every DOCX feature; the real multilingual illustrated pilot remains blocked until its typography, language boundaries, and floating-image placement are losslessly handled and reviewed.

## HTML-paste URL guard (2026-10-19)

The paste inspector now rejects URL schemes outside the explicit link/image allowlists and strips ASCII control/whitespace characters before scheme detection, preventing obfuscated `javascript:` links from bypassing the first inspection layer. Tests cover unsafe and obfuscated link schemes, protocol-relative URLs, safe relative links, and image source schemes. CI passed: [run 39238916402](https://github.com/shifter888ai/awakenology/actions/runs/39238916402). The later review-inventory gate still requires image sources to be reviewed local asset paths. This is defense-in-depth, not a full HTML sanitizer or approval of production publishing.

## Supported style-reference resolution (2026-10-19)

The extractor no longer rejects paragraph/character style references solely because a reference exists. The rich-content resolver applies document defaults, paragraph-style inheritance, character-style inheritance, and direct run overrides in the supported formatting subset, and rejects missing/cyclic/wrong-type references or unsupported properties. The extractor still blocks unsupported font metadata, complex-script typography, spacing, list marker patterns the HTML adapter cannot represent exactly, and floating image fidelity. Standard list numbering definitions are now inventoried, but source/output list comparison must still pass. CI passed: [run 39240300513](https://github.com/shifter888ai/awakenology/actions/runs/39240300513). This removes an over-broad gate; it does not make the real pilot ready.

## Static shell baseline (2026-10-19)

Generated pages now include a dark-by-default theme at initial HTML render (avoiding a light-mode flash), one accessible sun/moon theme control injected into the approved header, a compact responsive article layout, responsive images, and a return-to-top control. The CSS and controls are static in each page; there is no runtime shell fetch. This is isolated to generated output and does not change existing pages. Shell tests verify the controls and responsive rules; the real DOCX content-fidelity gate remains independent.


## Markdown source adapter (2026-10-20)

The isolated generator now accepts `mode: "markdown"` and an `input.markdown` string. Markdown is converted to escaped HTML and then passes through the existing strict HTML inspector and common normalized inventory; it does not bypass the content-integrity gate. The adapter currently supports basic headings, paragraphs, bold/italic/strikethrough, simple ordered/unordered lists (including ordered-list starts), blockquotes, links, and images. Unsafe URL schemes and unsupported constructs fail closed. This adapter is a conservative first slice, not full CommonMark support; automated tests and the real page-generation pilot must pass before it is treated as release-ready.
