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

Existing pages and frozen private editor must remain untouched.
