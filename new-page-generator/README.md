# New Page Generator — Phase 3 (isolated development)

Status: work in progress. This directory is **not a publishing endpoint**. Nothing here changes the frozen `/editor/`, existing pages, Worker routing, sitemap, or production content.

## Contract

- One logical page set contains supplied English, Japanese, and Traditional Chinese content. Missing language input is a blocking error. Never auto-translate or invent article text.
- Accepted source modes: DOCX (primary, to be implemented and tested) and formatted HTML paste (alternative).
- Both sources must normalize into a common ordered content inventory, preserving headings, paragraphs, formatting, links, lists, tables, images and intentional whitespace. Any unsupported or ambiguous construct blocks generation pending review.
- Build-time shared shell produces complete static HTML for each language; no runtime fetch of headers/footers.
- Use the approved navigation, theme behavior, monochrome circled-A branding, Contact/Reddit/Disclaimer footer and © 2017 Awakenology. Canonical host: https://awakenology.space.
- Validate source-to-output text and content-bearing element inventories, assets, route uniqueness, HTML structure, SEO metadata, hreflang reciprocity, internal links and sitemap changes. A character count alone is not sufficient.
- Generate a review report and full-page previews; only an explicitly reviewed Draft PR may enter the existing CI and approval process.
- Never write to `main`, merge, deploy, or edit existing article files as a side effect of generation.

## Delivery slices

1. Establish the isolated generator specification and source inventory (this commit).
2. Implement and test DOCX and paste adapters with fixture coverage for EN/JP/zh-Hant and tricky formatting.
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
