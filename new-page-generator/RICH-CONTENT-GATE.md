# Rich-content review gate

The offline review coordinator accepts optional paired `sourceRichInventory` and `renderedRichInventory` for each language output. If either is supplied, both are required and `compareRichContent` must pass. This does **not** imply that inventories are extracted independently or trustworthy merely because a caller supplies them. Never treat caller-authored identical inventories as evidence of source fidelity.

Before this can become a mandatory approval gate, derive source runs and images from original DOCX OOXML with source locations, and derive rendered runs and images from the actual parsed output HTML. Do not copy one inventory to the other. Preserve exact text, bold, italic, underline, color, href, image asset path, paragraph placement, order and alt text. Unsupported or ambiguous constructs block review.

The existing rendered text/content inventory gate remains active. This branch is non-publishing. The actual trilingual pilot cannot be certified while original DOCX bytes are unavailable.


## Current real-DOCX status (2026-10-19)

The real trilingual pilot DOCX is available in `new-page-generator/temp/多重時空是什麽 - 繁體 - Copy.docx`, and CI now inspects the actual OOXML package. The earlier statement that original DOCX bytes were unavailable is obsolete.

The source and rendered inventories are independently derived. Each text run carries its paragraph index; the inventory requires total paragraph count and explicit line-break provenance. Image records include paragraph index, order, alt text, character offset within the paragraph, and shared marker order with line breaks. The comparator detects text/format changes, paragraph movement/count loss, image relocation, and image/line-break swaps at the same text offset. Rendered CSS, external stylesheets, unrecognized semantic layout, unresolved Word styles, unsupported typography/layout properties, and all Word tables remain blocked.

Latest verified code CI: [39204366041](https://github.com/shifter888ai/awakenology/actions/runs/39204366041), **143 tests passed**. Subsequent docs-only CI also passed. This is a fidelity-gate milestone, not approval to generate or publish pages. The real pilot still fails the rich-content and conversion gates; no generated pages, PR, merge, or deployment are authorized.
