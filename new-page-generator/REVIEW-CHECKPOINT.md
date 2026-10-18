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
