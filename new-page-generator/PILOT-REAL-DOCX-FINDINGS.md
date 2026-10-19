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
