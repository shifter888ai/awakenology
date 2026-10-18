# Phase 3 review checkpoint — not ready for publishing

The current implementation is an isolated proof of pipeline boundaries, not a working page-creation UI.

## Implemented in branch
- Three-language page-set metadata validator
- Browser paste inspection and ordered inventory
- Offline DOCX package inspection and conservative Mammoth HTML extraction
- Source/output inventory comparator
- Async page-set inspection orchestrator
- Static HTML metadata wrapper, requiring reviewed content and shell components
- Node test files (execution and dependency installation **not yet verified**)

## Remaining blockers before a Draft PR can be considered review-ready
1. Install dependencies and execute all tests in a clean environment; fix failures. Do not report passing tests without evidence.
2. Harden DOCX fidelity: styles inherited from styles.xml, numbering/list structure, hyperlink relationships, Word tables, image extraction, and source XML-to-HTML loss accounting. Current parser deliberately blocks several complex features and explicit colors.
3. Harden HTML paste: sanitizer and output construction, CSS value validation, URL policy, parser-repair detection, attribute restrictions per tag, and image asset handling. The inspector is **not** an HTML sanitizer.
4. Normalize both adapters into one common source model with source locations and issue severity.
5. Extract and approve exact header/footer, CSS, circled-A logo and theme controls for *new pages only*; current static shell accepts components but does not supply or verify them.
6. Verify source/rendered content with independent extraction; a caller-supplied `integrityApproved: true` is not a security or review boundary.
7. Preview EN/JP/zh-Hant in light/dark desktop/mobile, validate hreflang reciprocity, canonical routes, links and sitemap changes.
8. Dry-run on representative owner-supplied content, then Draft PR, CI, explicit owner approval. No automatic merge/deploy.

Existing pages and frozen private editor must remain untouched.
