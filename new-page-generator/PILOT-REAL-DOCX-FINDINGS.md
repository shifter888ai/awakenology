# Original trilingual DOCX pilot — observed CI blockers

Source: `temp/多重時空是什麽 - 繁體 - Copy.docx`
Size: 501967 bytes
SHA-256: `b9b8e15366fbbdb2e4d921335315c26ce56c6eb83678f8a1306b7c5cc8116ea1`
Evidence: [CI job summary](https://github.com/shifter888ai/awakenology/actions/runs/39197545423).

## Observed results
- sourceMap: BLOCKED — unsupported or ambiguous text construct.
- assets: BLOCKED — floating `wp:anchor` drawings; drawing not recognized as inline; image reference outside recognized inline drawing.
- imagePlacement: BLOCKED — same image errors plus source-map blocker.
- richContent: BLOCKED — source-map blocker.
- conversion: BLOCKED — explicit Word text color and floating drawings/image adapter.
- `pilotApproved`: false. CI execution success is **not** a fidelity pass.

## Required next engineering work
1. Diagnose source-map unsupported constructs with **tag names and counts**, without silently discarding text.
2. Resolve floating drawing anchors and their actual placement and ordering, or retain a manual-review gate. Do not convert anchors to inline images by assumption.
3. Map explicit OOXML text colors losslessly; preserve red/blue, including inherited styles when present.
4. Rerun source/rich/image/conversion diagnostics on the unchanged uploaded file.
5. Only after every applicable integrity check passes, review EN/JP/Traditional Chinese boundaries, source images, and language-specific endings. Never synthesize missing endings.

No page generation, PR, merge, or deployment is authorized by this audit.

## Verified detailed OOXML diagnostic (CI run 39198114594)
- One `<w:br w:type="textWrapping"/>` in zero-based paragraph 124 (paragraph 125), after `------`; no text after the break in that paragraph. Preserve it as a break, not silently drop or concatenate it. Source-map currently fails closed on all `w:br`.
- Three drawings: two `wp:inline`, one `wp:anchor`. The anchor is in zero-based paragraph 21 (paragraph 22), relationship `rId4`, `wp:docPr id="28" name="Picture 1"`, with wrapping. Horizontal positioning: relative to column, offset 0; vertical: relative to paragraph, offset 0. `distL` and `distR` are each 114300 EMU; `behindDoc=0`, `allowOverlap=1`. Preserve this metadata and require visual placement review rather than coercing it into inline flow.
- Explicit color `333333` occurs 192 times. It is not evidence that red/blue elsewhere may be discarded; preserve all color semantics and validate rendered output against source.
- These are observations from the unchanged source; diagnostic CI success does not mean the extraction or conversion passed. [Detailed run](https://github.com/shifter888ai/awakenology/actions/runs/39198114594).

### Next implementation acceptance criteria
1. Add a tested source-map representation of text-wrapping breaks with source offsets and order, while continuing to reject unsupported tabs, carriage returns, and non-text-wrapping break types.
2. Add an explicit anchor inventory and placement-review status for `rId4`, with no automatic inline fallback; keep the generation gate closed until reviewed.
3. Validate color handling and exact text/image order in each of the three languages, rerunning the real pilot in CI after each change.


## Detailed run/paragraph property inventory (CI run 39200218682; source SHA-256 unchanged)

The property-inventory diagnostic now runs successfully, alongside all **111 automated tests passing**. It confirms the remaining rich-content blocker is substantive, not merely an overly broad unknown-property regex.

Run-level properties observed:

| OOXML property | Count | Preservation implication |
|---|---:|---|
| `rFonts` | 259 | Explicit font-family/hint metadata; needs a rendering policy or a reviewed decision that the relevant attributes are non-authorial. |
| `b` | 165 | Bold flags, including explicit off values. |
| `sz` / `szCs` | 254 each | Explicit font sizes; both normal and complex-script size properties need coherent mapping. |
| `lang` | 112 | Language metadata across Chinese, English, and Japanese runs. |
| `bCs` | 163 | Complex-script bold flags. |
| `i` / `iCs` | 132 each | Italic and complex-script italic flags, including explicit off values. |
| `caps` | 131 | Explicit capitalization flags; off values occur in the source. |
| `color` | 131 | Explicit color `333333` is frequent; color mapping is still not implemented in the conversion adapter. |
| `spacing` | 131 | Character-spacing metadata; currently not represented in the rich-run schema. |

Paragraph-level properties observed include `pStyle` (2), `numPr`/`ilvl`/`numId` (3 each), `ind` (3), `jc` (11), and `spacing` (119). These mean style inheritance, numbering/list semantics, indentation, alignment, and paragraph spacing cannot safely be flattened without explicit handling. The XML also contains hyperlink and advanced-formatting constructs that are blocked by the current conservative inspector.

Pilot stages after the diagnostic fix:
- source map: PASS — 184 paragraphs;
- assets: PASS — 3 assets extracted;
- image placement: PASS — 3 images mapped, including the floating drawing metadata;
- rich content: BLOCKED — inherited/advanced formatting and unsupported run properties remain unresolved;
- conversion: BLOCKED — explicit Word text color and floating drawing conversion remain unsupported.

**Decision:** do not whitelist these tags simply to turn the gate green. Next engineering work must either model and compare these properties end-to-end (source OOXML → extracted inventory → rendered HTML) or clearly scope a reviewed lossless mapping for the pilot. The generation gate remains closed; no HTML generation, PR, merge, or deployment is authorized.


### Aggregated blocker report (CI run 39200326470)

The rich-content inspector now reports unresolved OOXML property names and paragraph locations in grouped messages rather than emitting one generic error for nearly every paragraph. The corrected implementation passed **112 automated tests**.

The unchanged pilot now reports:
- `w:pStyle`: 2 occurrences;
- `w:rFonts`: 118 paragraphs;
- `w:sz` and `w:szCs`: 113 paragraphs each;
- `w:lang`: 58 paragraphs;
- `w:bCs`: 62 paragraphs;
- `w:iCs`, `w:caps`, and `w:spacing`: 36–37 paragraphs each;
- one ambiguous run/text mapping at paragraph 125 (the known explicit text-wrapping break).

This grouping confirms several distinct preservation requirements: explicit font/size/language metadata, complex-script formatting, capitalization/character spacing, style resolution, and ordered break handling. These should be addressed as separately testable capabilities, not waived together. The conversion adapter still correctly blocks explicit color and the floating drawing; rich-content and conversion remain blocked, and `pilotApproved` remains false.


## Extraction fail-closed guard expansion (CI run 39202544960)

The DOCX-to-HTML adapter now explicitly blocks source documents containing formatting/layout properties it does not yet preserve losslessly: explicit font families, font sizes, language metadata, complex-script bold/italic, capitalization/character spacing, paragraph/run style references, list numbering, indentation, and paragraph alignment. These were added as named feature checks in `extract-docx.mjs`, with regression tests proving the adapter returns `html: null` instead of silently flattening the affected formatting.

Validation: **115 automated tests passed**. The real pilot is still blocked, as expected, now with the unsupported properties clearly reported by the conversion stage. This change narrows the risk of accidental loss; it does not claim these features are supported, and no page output has been approved.


## Source-to-HTML line-break integrity (CI run 39202613055)

The source-to-converted-HTML comparison now checks explicit Word text-wrapping breaks in addition to exact text. It compares the count and UTF-16 character offsets of each source break against each rendered `<br>`, so a break that is missing, added, or moved fails the comparison even when the concatenated text remains identical.

Regression coverage verifies correct placement, missing breaks, relocated breaks, and extra HTML breaks. Validation: **117 automated tests passed**. The real pilot did not produce a line-break mismatch in this run; conversion remains blocked by the separately identified typography/style/list properties and floating image.


## Rich-content line-break provenance (CI run 39202723213)

The DOCX rich-content inspector now supports a Word run containing multiple text segments separated by explicit text-wrapping breaks. It emits those text segments in order and separately records each break's paragraph index and UTF-16 text offset. The rendered-HTML inspector independently records `<br>` positions, and `compareRichContent` now compares the line-break inventories rather than assuming text equality proves break fidelity.

Validation: **121 automated tests passed**. The real pilot's prior generic “ambiguous run/text mapping” error at paragraph 125 is gone; the inspector now extracts 256 text runs and records all 3 images. Rich-content approval remains blocked by the still-unresolved font family/size, language, complex-script properties, capitalization/character spacing, and paragraph style inheritance.


## More precise spacing diagnostics (CI run 39202789033)

The extraction gate now distinguishes **run-level character spacing** from **paragraph/line spacing** instead of reporting both under one ambiguous label. Each is independently blocked until it can be preserved losslessly. Regression tests cover both properties and confirm the diagnostic identifies both when they coexist.

Validation: **122 automated tests passed**. One intermediate CI run failed because it tested the updated implementation against the previous test expectation; the follow-up test commit updated that expectation and added the missing coverage, and its CI run passed.


## Paragraph-boundary fidelity and mandatory inventories (CI run 39203209912)

The source and rendered rich-text inventories now attach a paragraph index to every text run. The comparator checks that index alongside exact run text and formatting, so combining adjacent paragraphs or moving text between paragraphs is detected even when the concatenated text remains unchanged. The comparator also requires a line-break inventory on both sides; absence of provenance cannot be interpreted as “no line breaks.”

Regression coverage includes paragraph boundary movement, per-run paragraph indices, and omitted line-break metadata. The first strict-gate test run correctly failed because older test fixtures did not include the newly mandatory inventory; the fixtures were updated rather than weakening the gate. Validation: **127 tests passed, 0 failed** in [CI run 39203209912](https://github.com/shifter888ai/awakenology/actions/runs/39203209912).

This improves the comparator's ability to catch structure loss; it does not resolve inherited Word styles or approve the pilot. Those remain blocked.


## Paragraph structure, rendered-text fail-closed guard, and style-chain evidence (CI run 39203373115)

The rendered-HTML inspector now blocks text that appears outside a recognized paragraph container. This prevents unwrapped text or generic <div> text from being assigned a fabricated paragraph index and accidentally passing structural comparison. Regression coverage verifies both cases.

The pilot CI diagnostic now follows the actual referenced Word style chain rather than reporting only the direct style reference. The two `w:pStyle` references point to style ID `7` (“List Paragraph”), which inherits from style ID `1` (“Normal”). The List Paragraph style defines paragraph indentation; Normal defines run font, kerning, font size, complex-script font size, and language, plus paragraph widow control and alignment. Document defaults also define run font metadata. This confirms the blocker is genuine inherited formatting, not merely a vague parser warning.

Validation: **128 automated tests passed, 0 failed** in [CI run 39203373115](https://github.com/shifter888ai/awakenology/actions/runs/39203373115). The source map (184 paragraphs), asset extraction (3 images), and image-placement inspection (3 images) still pass; rich-content and conversion remain blocked. No pilot HTML has been approved or generated.


## Word table structure gate (CI run 39203460322)

The DOCX converter now blocks **all** Word tables, not just tables with merged cells. The previous guard could allow a simple table through even though cell order, row/column semantics, nested paragraphs and empty cells were not represented in the fidelity comparison. A regression test confirms even a one-cell table returns `html: null` until full table mapping exists.

Validation: **129 tests passed, 0 failed** in [CI run 39203460322](https://github.com/shifter888ai/awakenology/actions/runs/39203460322). This guard is intentionally conservative and does not indicate the pilot contains a table; it prevents other DOCX inputs from silently losing table structure.


## Rendered CSS and semantic-layout fail-closed guard (CI run 39203529462)

The rendered rich-content inspector now rejects embedded CSS rules, linked external stylesheets, and structural/semantic tags whose browser-default layout or formatting is not yet represented in the comparison (including headings, lists, tables, blockquotes, preformatted/code, superscript/subscript, and legacy font/mark tags). The inspector also blocks text outside recognized paragraph containers. This closes a gap where CSS or built-in browser styling could affect the page without appearing in the inline-format inventory.

Regression coverage verifies embedded CSS, external stylesheets and heading semantics. Validation: **131 tests passed, 0 failed** in [CI run 39203529462](https://github.com/shifter888ai/awakenology/actions/runs/39203529462). This is a conservative validation boundary, not support for these HTML structures.


## Image position relative to paragraph text (CI run 39203712577)

The source-map content stream now includes image anchors interleaved with text and line breaks in original XML order. Both the DOCX and rendered-HTML rich-content inventories record each image's character offset within its paragraph, and the comparator checks that offset along with image order, paragraph index, asset path and alt text. This closes a gap where text and image inventories could each pass independently even if the image had moved before or after the surrounding text.

Regression tests verify source sequence `text → image → text`, the extracted image offset, rendered image offset, and rejection of a relocated image. Validation: **134 tests passed, 0 failed** in [CI run 39203712577](https://github.com/shifter888ai/awakenology/actions/runs/39203712577). Floating-image conversion is still blocked; this comparison does not claim to preserve its actual page-relative coordinates or wrapping.


## Shared marker order and repeated-image occurrences (CI run 39203905399)

The rich-content inventory now records a shared per-paragraph marker order for images and explicit line breaks, in addition to each marker's text offset. This distinguishes cases where an image and a line break occur at the same character offset but swap order. The source map retains image anchors in the same ordered content stream as text and breaks.

Image asset mapping also pairs source image references with asset records by occurrence order, not merely relationship ID. This preserves per-occurrence alt text when the same media relationship is reused more than once. Regression tests cover swapping an image and break at a shared offset and reusing one image relationship with different alt text.

Validation: **136 tests passed, 0 failed** in [CI run 39203905399](https://github.com/shifter888ai/awakenology/actions/runs/39203905399). Floating image page-relative placement/wrapping and the pilot's inherited formatting remain blocked.


## Total paragraph-count integrity (CI run 39204047613)

The DOCX and rendered-HTML rich inventories now expose their total recognized paragraph count, and the comparator requires and compares it. This catches missing empty paragraphs—including trailing or otherwise textless paragraphs—that run indices alone cannot reliably detect. Missing paragraph-count metadata now blocks comparison.

Regression coverage verifies that dropping an empty paragraph fails even when all text runs are identical. Validation: **138 tests passed, 0 failed** in [CI run 39204047613](https://github.com/shifter888ai/awakenology/actions/runs/39204047613). The rendered inspector counts only recognized paragraph-like blocks; unsupported semantic structures and CSS remain blocked rather than counted as equivalent.


## Run effects and paragraph-flow safeguards (CI run 39204159713)

The conversion adapter now also blocks unhandled run effects and hidden-text controls (including superscript/subscript baseline shifts, vertical positioning, and vanish flags), plus paragraph pagination/direction/section-layout properties (including keep-next, page-break-before, widow control and section properties). The independent rich-content inspector reports these properties too, along with indentation, alignment and table structure; the two gates no longer disagree by allowing the rich inventory to appear clean when unsupported layout is present.

Regression tests cover run effects, paragraph page-flow properties, paragraph layout and tables. Validation: **141 tests passed, 0 failed** in [CI run 39204159713](https://github.com/shifter888ai/awakenology/actions/runs/39204159713). These properties remain intentionally unsupported; the gate reports them rather than flattening them.


## Raw HTML preflight for pasted content (CI run 39204366041)

The HTML-paste inspector now checks the raw input's tag vocabulary before relying on DOMParser's repaired body tree. This prevents unsupported tags hidden in a full-document head—or document wrappers discarded/moved by parser repair—from being overlooked while the original HTML string is later inserted into the page shell. It also rejects CSS and external stylesheets found in the head. Regression coverage includes a script inside a head that the test parser omits from its body result.

Validation: **143 tests passed, 0 failed** in [CI run 39204366041](https://github.com/shifter888ai/awakenology/actions/runs/39204366041). This remains a conservative inspector, not a complete HTML sanitizer; production output is not authorized by these tests alone.


## Word run-style inheritance resolver (CI run 39205462857)

Added a conservative style resolver for the rich-content source inventory. It resolves supported bold, italic, underline and explicit six-digit colors through document run defaults, paragraph-style inheritance, character styles, and direct run formatting in precedence order. It rejects missing/cyclic references, mismatched paragraph/character style types, theme-based colors, unsupported underline values, unmodeled inherited run properties (such as fonts and sizes), unmodeled paragraph-layout properties, and paragraph-mark formatting that must not be applied to all text runs.

The DOCX rich-content inspector now uses resolved formatting values for its run inventory. Style references and unsupported properties are still blocking, so this is not a claim that the real pilot now passes. Regression coverage includes inheritance order, explicit-off overrides, unsupported inherited properties, paragraph-mark separation and style type checks. Validation: **153 tests passed, 0 failed** in [CI run 39205462857](https://github.com/shifter888ai/awakenology/actions/runs/39205462857). The pilot remains blocked on unsupported inherited font/size/language, numbering and paragraph layout, floating-image rendering, and other unresolved content.


## Inherited-style blocker diagnostics (CI run 39205573952)

Style-resolution diagnostics now report shared document-default and style-chain blockers once rather than repeating them for every paragraph, while retaining paragraph-specific reports for effective-formatting failures. This makes the remaining blockers easier to act on without weakening the gate. The unchanged pilot still reports unsupported document-default `rFonts`; `List Paragraph` indentation; `Normal` style font family, kerning, sizes, language, widow control and alignment; direct run fonts/sizes/language/complex-script flags/capitalization/character spacing; paragraph alignment/indentation/numbering; and section layout. Rich-content and conversion remain blocked.

Validation: **154 tests passed, 0 failed** in [CI run 39205573952](https://github.com/shifter888ai/awakenology/actions/runs/39205573952). No pilot output is approved.


## Word font-size fidelity (CI run 39206257271)

The rich-content pipeline now resolves Word `w:sz` half-point values into point sizes through document defaults, paragraph-style inheritance, character styles, and direct run formatting. The independent rendered-HTML inventory reads explicit `font-size` declarations in `pt` or `px` (converting CSS px at 0.75 pt per px), rejects relative/unknown units, and the comparator requires font-size provenance for every run. This allows source-to-output size differences to be caught rather than silently ignored. Validation: **160 tests passed, 0 failed** in [CI run 39206257271](https://github.com/shifter888ai/awakenology/actions/runs/39206257271).

The real pilot remains blocked: document-default and inherited font families, complex-script sizes, language, kerning, paragraph alignment/indentation, numbering, section layout, paragraph-mark formatting and floating-image rendering still need independently faithful handling. Font-size support alone does not approve the pilot.

## Style-reference classification checkpoint (2026-10-19)

CI runs [39233662212](https://github.com/shifter888ai/awakenology/actions/runs/39233662212), [39236529926](https://github.com/shifter888ai/awakenology/actions/runs/39236529926), and [39237636426](https://github.com/shifter888ai/awakenology/actions/runs/39237636426) passed. The rich inspector now delegates paragraph and character style references to the inherited-style resolver instead of automatically marking every reference unsupported. Regression tests require missing styles, cyclic inheritance, and unsupported inherited/direct typography to remain blocking. This is a diagnostic classification improvement, **not** a pilot approval or a DOCX-to-HTML formatting implementation.

The converter still blocks the source's font family, font size, language metadata, complex-script properties, capitalization, character and paragraph spacing, numbering, section/layout properties, explicit color, and floating drawing. The rich-content comparator and converter must independently verify a lossless mapping for each before approval. Do not remove feature gates merely because the resolver can inventory a source property. The original source remains unchanged; `pilotApproved` remains false.

## Inherited-style package hardening (2026-10-19)

The converter now inspects `word/styles.xml` in addition to `word/document.xml` before calling Mammoth. Unsupported formatting in document defaults and named styles cannot bypass the existing fail-closed feature inventory merely because a run lacks direct properties. The styles part is capped at 5 MiB after decompression and decoded with fatal UTF-8 validation; oversized or malformed data blocks conversion. Regression coverage checks inherited font/language metadata, inherited paragraph spacing, oversized style XML, and malformed UTF-8.

Validation: [run 39238117016](https://github.com/shifter888ai/awakenology/actions/runs/39238117016) passed. This is defensive validation, not implementation of inherited typography in output. Current conservative scan can block on unsupported declarations anywhere in styles.xml; narrowing that behavior requires a correct used-style-chain/defaults resolver, not a broad whitelist. Pilot approval remains false.

## Pilot tag-count diagnostic regression fix (2026-10-19)

The pilot audit's dynamic XML-tag counting now uses a dedicated, tested helper with exact qualified-name boundaries. The tests cover self-closing and opening tags, whitespace boundaries, namespace-qualified names, similarly prefixed names, and invalid inputs. This prevents diagnostic tag counts from being skewed by incorrectly escaped whitespace in a dynamically constructed regular expression.

Validation: [run 39238529558](https://github.com/shifter888ai/awakenology/actions/runs/39238529558) passed the helper tests; [run 39238519698](https://github.com/shifter888ai/awakenology/actions/runs/39238519698) passed the implementation. This corrects diagnostics only; it does not resolve the actual formatting blockers or approve the pilot.

## Pilot break-location diagnostic corrected (2026-10-19)

The audit now records the pilot's explicit line break at zero-based paragraph 124 (paragraph 125), after `------`, with no following text in that paragraph. The diagnostic had only matched self-closing tags and therefore failed to record the break when its actual syntax did not fit that narrow pattern. It now accepts both self-closing and paired Word break tag syntax. Validation: [CI run 39238651095](https://github.com/shifter888ai/awakenology/actions/runs/39238651095) passed; the report now shows the exact break tag and paragraph location. Source map, assets, and image-placement inspections pass; rich-content and conversion remain blocked.

## Inherited color and complex-script guard coverage (2026-10-19)

Regression coverage now confirms that explicit color and complex-script bold/italic in `word/styles.xml` are blocking even when the visible document run contains plain text only. This complements the existing inherited font, language, and paragraph-spacing tests. CI: [run 39238732431](https://github.com/shifter888ai/awakenology/actions/runs/39238732431) passed. The behavior is deliberately fail-closed; it does not yet render these properties into output HTML.

## Source-image visual review artifact (2026-10-19)

The pilot CI now emits `pilot-visual-review.html` alongside the JSON diagnostic. It embeds the three validated source images, their checksums and placement metadata, and the preceding/current/following source paragraphs. It is explicitly labeled as a source-image review aid, not a converted page preview; the floating image still requires comparison with its original Word wrapping and position.

The artifact was uploaded successfully in [CI run 39239093393](https://github.com/shifter888ai/awakenology/actions/runs/39239093393): [download the diagnostic and visual-review bundle](https://github.com/shifter888ai/awakenology/actions/runs/39239093393/artifacts/12180571543). This aids the manual review step but does not approve the pilot.

The visual-review artifact now also contains all 184 source paragraphs in order, with paragraph numbers and explicit line-break markers. This helps inspect the EN/JP/Traditional Chinese boundaries and verify the Japanese ending against the original source rather than synthesizing missing text. The expanded artifact passed CI and was uploaded in [run 39239251281](https://github.com/shifter888ai/awakenology/actions/runs/39239251281): [download the latest diagnostic and visual-review bundle](https://github.com/shifter888ai/awakenology/actions/runs/39239251281/artifacts/12180517203). It remains a review aid, not converted page output.

## Supported style-reference resolution (2026-10-19)

The extractor no longer rejects paragraph/character style references solely because a reference exists. The rich-content resolver applies document defaults, paragraph-style inheritance, character-style inheritance, and direct run overrides in the supported formatting subset, and rejects missing/cyclic/wrong-type references or unsupported properties. The extractor still blocks unsupported font metadata, language, complex-script typography, spacing, list semantics, and floating image fidelity. CI passed: [run 39240300513](https://github.com/shifter888ai/awakenology/actions/runs/39240300513). This removes an over-broad gate; it does not make the real pilot ready.

The visual-review artifact now adds a linear source-order view that places each source image alongside its source paragraph, in addition to the separate image details and full paragraph index. This is more useful for checking image-to-text association, but explicitly does not simulate Word's typography or floating-image wrapping. CI verifies the linear view and source-image entries exist.

## Automatic Word line spacing and latest blockers (2026-10-19)

Word `w:spacing w:lineRule="auto"` now maps its line value (in 240ths of a line) to unitless CSS `line-height`; exact line spacing remains in points. The `atLeast` mode is still fail-closed rather than being misrepresented as CSS paragraph min-height. Tests cover both. The pilot-preview CI check now labels even an unavailable conversion preview `NOT APPROVED FOR PUBLICATION`, fixing the previous marker-check failure without bypassing the rich-content gate.

[Run 39272199525](https://github.com/shifter888ai/awakenology/actions/runs/39272199525) passed all 226 tests and artifact verification. [Download review artifacts](https://github.com/shifter888ai/awakenology/actions/runs/39272199525/artifacts/12195777718).

The remaining real-pilot rich-content errors are concentrated in numbering/indentation at paragraphs 5, 13 and 19; unsupported paragraph-mark font-family metadata; and inherited font-family metadata at paragraphs 121, 123 and 124. This is a narrower set of errors than earlier audits, but conversion is still BLOCKED. A floating image continues to require manual Word-versus-HTML visual comparison, and EN/JP/Chinese segmentation has not been approved.


## Latest pilot gate update (2026-10-20)

The current implementation resolves the prior typography, language, paragraph-mark, spacing, list-numbering, and paragraph-alignment blockers. The real pilot now passes **source map (184 paragraphs), asset extraction (3 images), image-placement inventory (3 images), and rich-content comparison**. The converter restores omitted empty paragraphs and the source text sequence now aligns with the converted preview.

Validation: [CI run 39292339481](https://github.com/shifter888ai/awakenology/actions/runs/39292339481) passed **309 tests, 0 failed** and uploaded the [pilot audit/review bundle](https://github.com/shifter888ai/awakenology/actions/runs/39292339481/artifacts/12205702599), including `pilot-converted-preview.html` and `pilot-review-checklist.md`.

Two human decisions remain before the page-set generator can be approved:

1. **Floating image layout:** compare the inline preview against the original DOCX in Word. The preview does not preserve proof of the original floating wrap/position. Approval must be bound to the exact source DOCX SHA-256.
2. **Missing image alt text:** `/assets/docx-b7dba7e21c2441ad.png` (PNG, 311,382 bytes; SHA-256 `b7dba7e21c2441ada87821f01380c2b8e6d5e0031fec00b8538270f7a0f0c32d`) has no alt text in the Word source. Inspect the image and provide a human-reviewed description via `imageAltTextBySrc` using that exact `src`.

The integration path now exposes a non-publishable preview, flags the missing alt text, accepts a source-specific alt-text override, and still blocks generation until the floating-image review is approved for the same source hash. `pilotApproved` remains false. No PR, merge, or production deployment has been authorized.

## Language-boundary inventory and source-bound review (2026-10-20)

- Added a fail-closed language segmenter using the three exact title markers in the unchanged source DOCX. It requires each marker to occur exactly once and in source order; it does not translate, rewrite, or fill gaps.
- The real source-map test confirms 184 ordered paragraphs divide into contiguous, non-overlapping ranges:
  - Traditional Chinese: paragraphs 1–58 (58 paragraphs; 1 image)
  - English: paragraphs 59–125 (67 paragraphs; 1 image)
  - Japanese: paragraphs 126–184 (59 paragraphs; 1 image)
- Latest CI diagnostic report records marker paragraph indices 0, 58, and 125, and reports all three ranges cover the complete source paragraph map. The report records each range's paragraph count, image count, and text-character count for subsequent source/output comparison.
- CI run: https://github.com/shifter888ai/awakenology/actions/runs/39344809858 — passed. Automated regression tests also cover missing/duplicated markers, source order, and the real DOCX ranges.
- The source-bound human visual review remains tied to SHA-256 `b9b8e15366fbbdb2e4d921335315c26ce56c6eb83678f8a1306b7c5cc8116ea1`; the approved missing-alt override remains `multi-planes`.

**Scope:** this is a validated paragraph-range inventory, not yet three generated article pages. The audit's conversion stage remains explicitly non-publishable because the floating-image renderer returns a review preview rather than ordinary final HTML. Next, the generator must split the converted article at these verified language boundaries and compare each language's own text, formatting, and image inventory independently before any page set can be marked review-ready. No PR, merge, or deployment is authorized.

## Language-separated HTML review artifact (2026-10-20)

- Added a title-marker HTML splitter that verifies the converted fragment's concatenated text is unchanged by splitting. It rejects missing/duplicate title blocks, out-of-order markers, and non-whitespace content before the first language title.
- The real DOCX test confirms the converted preview splits into three segments with paragraph/image counts matching the source ranges: zh-Hant 58/1, en 67/1, ja 59/1.
- CI now produces and uploads `pilot-language-segments.html`, visibly labels all three language sections, applies only the previously reviewed preview corrections, and prominently marks the artifact **REVIEW ONLY — NOT APPROVED FOR PUBLICATION**.
- The workflow verifies the review-only label and the presence of all three language sections before uploading the artifact.
- Latest verified run: https://github.com/shifter888ai/awakenology/actions/runs/39345146179 — passed. The artifact includes the language-separated review HTML and machine-readable `languageSegmentation` / `languageHtmlSegmentation` summaries.

**Remaining gate:** the segments are now isolated for language-specific review, but they are not yet independent generated pages. Next, compare each segment's rich-formatting and image inventory against the corresponding paragraph slice from the original DOCX, accounting only for explicitly reviewed corrections. Keep output generation fail-closed if any unexplained difference remains.

## Per-language rich-content comparison (2026-10-20)

- Added language-local slicing for source rich-content inventories. Run formatting, paragraph layout, explicit line breaks, and image metadata are rebased into each language's own paragraph range before comparison.
- The converted HTML is independently inspected for each segment and compared against the corresponding source inventory. Only two source-reviewed preview adjustments are allowed: the approved `multi-planes` alt text and dark-neutral text colors changed to the theme foreground. Red/blue emphasis remains strict; the approval is bound to the exact source SHA-256.
- The comparison now passes for all three languages with **zero unexplained rich-content issues**:
  - Traditional Chinese: 58 paragraphs, 64 runs, 1 image, 0 explicit line breaks.
  - English: 67 paragraphs, 159 runs, 1 image, 1 explicit line break.
  - Japanese: 59 paragraphs, 57 runs, 1 image, 0 explicit line breaks.
- For all three languages, concatenated text matches paragraph by paragraph, and source/rendered paragraph, image, and line-break counts match.
- The CI workflow now fails if any language segment is missing, has a text mismatch, or reports an unexplained rich-content issue. Latest verified gate run: https://github.com/shifter888ai/awakenology/actions/runs/39345849474 — passed.

**Important distinction:** this proves the current reviewed preview's source-to-rendered fidelity by language; it does not mean the actual page-set generator has emitted three final article pages. The conversion audit still deliberately labels the floating-image path as a non-publishable review preview. Next, wire these same segment-specific source inventories and reviewed HTML fragments into the generation coordinator, retain all route/content-integrity gates, and test that it produces a non-publishable three-language output bundle without duplicating or omitting language sections.

