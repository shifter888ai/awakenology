# Phase 3 review checkpoint — not ready for publishing

The implementation is an isolated proof of pipeline boundaries, not a working page-creation UI.

## Implemented in branch
- Three-language page-set metadata validator
- Browser paste inspection and ordered inventory
- Offline DOCX package inspection and conservative Mammoth HTML extraction
- Source/output inventory comparator
- Async page-set inspection orchestrator
- Derived three-language route manifest and reciprocal alternate verifier
- Reviewed-page-set coordinator that blocks before output unless all inputs and inventories pass
- Static HTML metadata wrapper requiring reviewed content and shell components
- Fail-closed coordinator tests for missing input, unavailable parser, and incomplete language set

## Verification status
- GitHub Actions clean-run verification: **43 tests passed, 0 failed** on commit `965f82e166ba89a554b4b5debe9f45a5a50dcd15`. Run: https://github.com/shifter888ai/awakenology/actions/runs/39091733226. The run completed successfully.
- A failing test exposed that self-closing `<w:drawing/>` / `<w:pict/>` tags were not caught; the guard was fixed and the suite rerun successfully.
- The coordinator now parses each actual `reviewedArticleHtml` string, validates that parsed inventory, and compares it against the inspected source inventory; it no longer trusts a caller-supplied output inventory. The parser and approved shell fragments are still supplied by the caller, so this is a review workflow gate, not a sanitizer or security boundary.
- No owner-supplied pilot content has been run through end to end.

## Remaining blockers before a Draft PR can be considered review-ready
1. Keep the clean CI suite green as implementation changes continue; do not report passing tests without evidence.
2. Harden DOCX fidelity: inherited styles, numbering/list structure, hyperlink relationships, Word tables, image extraction, and source XML-to-HTML loss accounting. Current parser deliberately blocks several complex features and explicit colors.
3. Harden HTML paste: sanitizer and output construction, CSS value validation, URL policy, parser-repair detection, attribute restrictions per tag, and image asset handling. The inspector is **not** an HTML sanitizer.
4. Normalize both adapters into one common source model with source locations and issue severity.
5. Extract and approve exact header/footer, CSS, circled-A logo and theme controls for *new pages only*; current static shell accepts components but does not supply or verify them.
6. Remove trust in caller-controlled approval flags and shell fragments; establish a trusted, reviewed shell source and a browser/HTML parser boundary. The current output HTML is parsed before inventory comparison, but `integrityApproved: true` remains an internal workflow flag, not a security boundary.
7. Preview EN/JP/zh-Hant in light/dark desktop/mobile, validate canonical routes, internal links and sitemap changes.
8. Dry-run on representative owner-supplied content, then Draft PR, CI, explicit owner approval. No automatic merge/deploy.

## Owner-supplied pilot: trilingual DOCX (2026-10-18)
- Added [pilot source audit](pilot-audit-multidimensional-space.md) for `多重時空是什麼` using the exact Library copy `多重時空是什麽 - 繁體 - Copy(1).docx` (501,967 bytes, indexed as 13 pages).
- The indexed text confirms separate Traditional Chinese, English, and Japanese streams in one file; boundaries occur mid-page, so a page-per-language assumption is invalid.
- The Library reader does not expose authorized raw DOCX bytes or rendered illustration pages. Pages 2, 6, and 11 have unresolved illustrations. Japanese indexed text ends at the Nth-dimension example without a visible closing block; this must be checked against the original file, not filled from another language.
- **Pilot remains blocked before HTML generation.** The available text extraction cannot validate real OOXML, images, run formatting, hyperlinks, exact paragraph order, or the Japanese end-of-document. Do not call this a completed DOCX dry-run or claim source/output integrity.
- Next step: obtain an authorized byte/media export path, then run the existing DOCX adapter on the exact source and compare all content-bearing blocks. Keep output generation fail-closed until image and language-boundary issues are resolved.

Existing pages and frozen private editor must remain untouched.

- Further source-adapter inspection found that `extract-docx.mjs` intentionally blocks all `w:drawing` / `w:pict` content in the main document. This is a second independent blocker: before this illustrated article can pass, implement and test inline image relationship extraction, byte checksums, alt text/order, and safe asset output paths while continuing to block unsupported floating shapes/charts. Do not remove the guard as a shortcut.

## DOCX image adapter implementation slice (2026-10-18)
- Added `inspect-docx-assets.mjs` and fixture tests for inline image extraction: relationship resolution, source order, deterministic output paths, alt text, byte length and SHA-256, plus fail-closed behavior for external/missing images, floating drawings, and non-image drawing content.
- CI passed for the initial adapter and tests at commit `3fe4345`: https://github.com/shifter888ai/awakenology/actions/runs/39102143170
- Follow-up hardening now blocks Word drawings that are not recognized inline image drawings and inline drawing shapes with no image reference. CI for the latest hardening commits is pending at checkpoint update time.
- This remains a standalone asset inspection stage, not an integrated DOCX-to-page conversion. Real pilot execution is still blocked by unavailable raw DOCX bytes; source formatting, all media, language boundaries and Japanese ending are not yet verified from the actual package.

- Hardening regression was caught by CI: the first guard edit had over-escaped regexes, causing a syntax failure; this was corrected in commit `a93a131`. Latest CI is green: https://github.com/shifter888ai/awakenology/actions/runs/39102267549

## DOCX text/image integration slice (2026-10-18)
- `extract-docx.mjs` now invokes the separate image inspector whenever Word drawings/pictures are present, passes validated image bytes through Mammoth's image converter, and returns asset metadata (without embedding raw bytes in the report).
- Image output paths are content-addressed, so repeated use of the same image bytes resolves to the same stable path. The extractor blocks conversion if any inspected asset is absent from the converted HTML.
- Added an end-to-end synthetic OOXML fixture test that verifies text and an inline image survive conversion with alt text and a verified asset record.
- CI passed at commit `0c76cfd`: https://github.com/shifter888ai/awakenology/actions/runs/39102543447
- This validates only the synthetic fixture and adapter integration. The real trilingual source DOCX is still unavailable as raw bytes, so the actual article, illustrations, formatting, language boundaries and Japanese ending remain unverified. Do not generate or publish the pilot yet.

## Shared normalized source model — first validation slice (2026-10-18)
- Added `normalized-source-model.mjs` with an explicit block schema: stable IDs, language/source mode, source locations, ordered child references, exact text, formatting, links, assets, and severity-coded issues.
- Unresolved warnings, errors, and blocking issues fail validation; source offsets, duplicate IDs, missing child references, and absent structural fields are also rejected.
- This is a schema/validation foundation only. The DOCX and HTML-paste adapters have not yet been refactored to emit this model, so no claim is made that the pilot is represented by it.
- Added unit tests for valid blocks, duplicate IDs, missing fields, unresolved issues, resolved notes, and child/source-offset errors. CI result for the new validator and tests is pending.

- Added `normalize-html-inventory.mjs`, a first bridge from the existing parsed HTML inventory into the shared normalized block shape. It preserves text nodes, ordered child references, basic inline-format markers, link targets, and image src/alt fields. It explicitly records paths in the parsed HTML tree, not fabricated DOCX XML offsets.
- Added tests for content/child order, formatting, links, image metadata, malformed input, and the source-location distinction. These tests do not replace original DOCX-to-HTML fidelity tests. CI status for this bridge is pending.

## Original DOCX source-map diagnostic slice (2026-10-18)
- Added `inspect-docx-source-map.mjs` to record original `word/document.xml` paragraph order, exact text-run values, source XML offsets and image relationship references with paragraph locations. It blocks constructs whose source positions cannot yet be mapped reliably.
- `extract-docx.mjs` now requires a passing source map, checks original image reference count/order against inspected image assets, and returns the diagnostic source map on success. Added synthetic fixture tests for text and image source locations.
- This is not a full semantic OOXML parser and does not yet prove rendered text/formatting fidelity; unsupported links and other ambiguous constructs deliberately fail closed pending dedicated mapping.
- The actual trilingual pilot remains blocked by unavailable original DOCX bytes. No generated pilot pages, PR, merge or deployment.

## Exact source-to-HTML text integrity gate (2026-10-18)
- Added `compare-docx-output.mjs`, which compares the concatenated original mapped Word text runs to converted HTML text without whitespace, Unicode, punctuation or variant normalization. It reports the first mismatch and original paragraph/XML location. Unknown HTML elements and unparsed markup block approval.
- `extract-docx.mjs` now requires this comparison to pass before returning intermediate HTML. Added tests for preserved entities, changed Chinese character variants, whitespace, missing characters, source locations and multiple paragraphs.
- This is a strict text-integrity slice, not a complete formatting or semantic-structure equivalence proof. Rich formatting (including bold/color), hyperlinks, table semantics and illustration placement still require separate source-to-output checks. The actual trilingual pilot remains blocked by unavailable raw source bytes.


## Updated real-DOCX fidelity checkpoint (2026-10-19)

The exact pilot DOCX is available in the repository at `new-page-generator/temp/多重時空是什麽 - 繁體 - Copy.docx`; the earlier statement that raw DOCX bytes were unavailable is superseded by the real-package CI diagnostics. Its SHA-256 is `b9b8e15366fbbdb2e4d921335315c26ce56c6eb83678f8a1306b7c5cc8116ea1` (501,967 bytes). The source-map, asset extraction, and image-placement stages have passed on the actual package.

Latest verified suite: **122 tests passed** in CI run [39202830200](https://github.com/shifter888ai/awakenology/actions/runs/39202830200). Additional fail-closed guards now explicitly block font families/sizes, language metadata, complex-script bold/italic, capitalization, character spacing, paragraph/line spacing, style inheritance, numbering/list semantics, indentation, and alignment until end-to-end mappings exist. Source-to-HTML line-break counts and exact text offsets are compared; source and rendered rich inventories separately record line-break positions.

### Current real-pilot stage results
- Source map: PASS — 184 paragraphs.
- Assets: PASS — 3 image assets.
- Image placement: PASS — 3 images, including floating drawing metadata.
- Rich content: BLOCKED — explicit typography and inherited paragraph styles remain unresolved.
- Conversion: BLOCKED — explicit color, typography/style/list properties, and floating drawing conversion remain unsupported.
- `pilotApproved`: **false**. No HTML generation, PR, merge, or deployment is authorized.

The historical sections above record the sequence of earlier implementation stages; this addendum is the current status. Remaining work is to implement source-to-rendered mappings for the blocked properties, verify image placement semantics and paragraph boundaries independently, then re-run the unchanged real DOCX through the complete gate. Do not weaken the gate or mark the pilot approved merely because unit tests pass.


## Paragraph-boundary comparison update (2026-10-19)

- Source and rendered text runs now carry paragraph indices, and the rich-content comparator compares them with text and formatting. This detects text moved between paragraphs or paragraphs accidentally merged.
- A line-break inventory is mandatory on both sides; missing provenance blocks comparison instead of being treated as an empty inventory.
- Regression tests verify paragraph boundaries and mandatory line-break metadata. CI run [39203209912](https://github.com/shifter888ai/awakenology/actions/runs/39203209912) passed **127/127 tests**.
- These are fidelity-gate improvements, not evidence that the pilot is publishable. The real DOCX remains blocked on inherited styles and unsupported typography/layout, and `pilotApproved` remains false.


## Style-chain diagnosis and rendered paragraph guard (2026-10-19)

- Rendered HTML text outside recognized paragraph containers now blocks the rich-content inspection rather than receiving an invented paragraph index.
- CI diagnostic resolves the pilot’s referenced style chain: style `7` (“List Paragraph”) inherits from style `1` (“Normal”). The chain includes paragraph indentation, font family, kerning, font sizes (including complex-script size), language, widow control and alignment. Document defaults also contribute font metadata.
- CI run [39203373115](https://github.com/shifter888ai/awakenology/actions/runs/39203373115) passed **128/128 tests**.
- This evidence clarifies the next implementation slice: implement an explicit OOXML style/default resolver and compare its effective formatting to rendered HTML, or continue to block. Do not simply ignore inherited properties. The real pilot remains unapproved.


## Word table fail-closed gate (2026-10-19)

All Word tables now block DOCX conversion until row/cell order, nested paragraphs, empty cells, and merge semantics are represented and compared. This replaces the narrower merged-cell-only guard. Regression CI [39203460322](https://github.com/shifter888ai/awakenology/actions/runs/39203460322) passed **129/129 tests**. No unsupported table is flattened into HTML.


## Rendered CSS and semantic layout guard (2026-10-19)

The rendered rich-content inspector now blocks embedded CSS, external stylesheets and unverified structural/semantic tags whose browser-default styling is not yet compared. It also rejects text outside recognized paragraph containers. CI [39203529462](https://github.com/shifter888ai/awakenology/actions/runs/39203529462) passed **131/131 tests**. Support for these structures must be implemented and compared explicitly before the gate can permit them.


## Image/text interleaving fidelity (2026-10-19)

- Original DOCX paragraph content now includes image anchors in source XML order alongside text and line breaks.
- Source and rendered image inventories record a character offset within the paragraph; the comparator checks it, preventing an image from moving relative to surrounding text while the separate text/image counts still pass.
- CI [39203712577](https://github.com/shifter888ai/awakenology/actions/runs/39203712577) passed **134/134 tests**.
- Floating drawing conversion remains blocked because exact page-relative coordinates and wrapping are not represented by the rendered comparison.


## Shared image/line-break marker order (2026-10-19)

- Image and line-break records now share a per-paragraph marker-order index as well as text offsets, so swapping two markers at the same offset fails comparison.
- Image occurrences are paired with asset records by source order, preserving different alt text when one relationship is reused.
- CI [39203905399](https://github.com/shifter888ai/awakenology/actions/runs/39203905399) passed **136/136 tests**.
- Floating-image coordinate/wrapping conversion and inherited formatting remain unsupported; the pilot is not approved.


## Total paragraph count in fidelity comparison (2026-10-19)

Source and rendered rich-content inventories now include total paragraph counts, and comparison requires both. This detects lost empty paragraphs even when text runs remain unchanged. Missing count metadata blocks comparison. CI [39204047613](https://github.com/shifter888ai/awakenology/actions/runs/39204047613) passed **138/138 tests**.


## Expanded OOXML layout guards (2026-10-19)

Conversion now blocks unhandled run effects/hidden text and paragraph pagination, direction and section-layout properties. The independent rich-content inspector also blocks paragraph indentation/alignment, page-flow controls and tables. This aligns the conversion and rich-content gates so unsupported layout cannot pass one stage merely because another stage catches it. CI [39204159713](https://github.com/shifter888ai/awakenology/actions/runs/39204159713) passed **141/141 tests**.


## Raw HTML preflight and parser-repair guard (2026-10-19)

The paste adapter now checks every raw HTML tag against the reviewed vocabulary before parsing, then inspects head CSS and linked stylesheets as well as the parsed body. This blocks scripts or document wrappers that parser repair could otherwise hide from body-only inventory. CI [39204366041](https://github.com/shifter888ai/awakenology/actions/runs/39204366041) passed **143/143 tests**. This reduces one blind spot but does not replace a full sanitizer or a trusted rendering boundary.
