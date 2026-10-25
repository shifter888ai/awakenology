# Static HTML build-parity PoC (non-deployed)

This draft branch is isolated from production. It explores moving deterministic HTMLRewriter output to build time. It is **not Worker-equivalent and must not be merged or deployed** as a routing change without explicit approval.

## Current verified scope

Nine pinned source fixtures: homepage, English/Japanese/Chinese language indexes, AI Search, two Chinese articles, one English article, and one Japanese article (including Unicode routes). Git blob fingerprints are computed from raw repository bytes, preserving legacy line endings. The source-content/markup/image and idempotence checks passed. Live Worker **signature** parity is required (not optional) and passed on the nine fixtures at commit `7e78d0f`; subsequent regression and metadata checks passed at `15828ce` and `3e0a5d8`.

The PoC also tests deliberate content and signature mutations, duplicate canonical and robots metadata, unexpected noindex, and static public crawl-inventory exclusions for Editor/Generator/AI Search routes. The static inventory test passed at `c2f7899`; the Live SEO runtime audit was still pending when this document was updated. No private host authentication was exercised.

These are limited tests: a matching signature does **not** establish full HTML, JavaScript, browser, accessibility, visual, or Worker-route equivalence.

## Remaining release blockers

1. Expand route coverage beyond nine fixtures, including more nested and Unicode articles, redirects, missing paths, and edge cases. Compare against the current Worker behavior.
2. Compare complete rendered DOM/head/body semantics and run browser-level tests for theme, return-to-top, Chinese conversion, language/navigation links, image URLs, accessibility, and responsive layouts. The required signature check alone is insufficient.
3. Validate article subtree preservation (inline colors, bold text, images, order and content) on a much broader sample. BeautifulSoup serialization is not literal source-byte comparison.
4. Separately verify Private Editor, Word Generator and HTML Generator authentication and live HTTP noindex/cache headers where appropriate, plus exclusion from public crawl/sitemap. The static inventory test is not a live security audit. Preserve AI Search's noindex/no-canonical behavior.
5. Demonstrate build reproducibility, idempotence, fail-closed behavior, rollback and measurable performance benefit before any production routing proposal.
6. Re-run every check against the then-current `main` after unrelated content merges. Pinned fixture hashes must only be refreshed after verifying the corresponding source change.
7. Obtain explicit human approval before any merge or deployment.

## Current PoC gates

- Unit tests: `python -m unittest discover -s scripts/static_html_poc -p 'test_*.py' -v`
- Pinned source fixtures: `python scripts/static_html_poc/check_real_pages.py`
- **Required** nine-page live Worker signature comparison: `python scripts/static_html_poc/check_live_parity.py`
- Existing repository Content Integrity, Sitemap route parity, SEO metadata inventory, and Live SEO runtime audit workflows.

No Worker routing or production deployment change is authorized by this PoC.


## Phase 2 and Phase 3 status (2026-10-25)

Phase 2: nine pinned routes × desktop/iPhone Chromium passed rendered DOM, theme round-trip, return-to-top and Chinese conversion checks. Screenshots are compared with equal dimensions and a strict 0.05% changed-pixel tolerance (per-pixel channel difference >12); exact matches are also reported. This is scoped to pinned fixtures, not every route.

Phase 3: the new `check_full_inventory.py` discovers tracked public `index.html` routes directly from Git and excludes private Editor/Word Generator/HTML Generator assets. It records SHA-256 fingerprints and validates source content, markup, image preservation, metadata, reproducibility and idempotence without deployment. Initial run: **120 of 122 public routes passed; two blocked**:

- `SoC-AssessPoints-3-Spiritual-Connection-Area/index.html`: text and markup integrity failure; images passed.
- `SoC-AssessPoints-4-Thought-Expansion-Area/index.html`: text and markup integrity failure; images passed.

Do not suppress either failure or modify article source merely to pass. Investigate the parser/transformer against the original and live Worker DOM, preserve original content 100%, and rerun the complete gate. Full live Worker comparison for every route, private-host HTTP/auth checks, performance, redirects/404 behavior, and rollback rehearsal remain pending. This branch is not deployable or merge-approved.

### Investigation of the two blockers

Both affected English SoC assessment source files contain malformed head markup: the `hreflang="en"` alternate `<link>` has no closing `>` before the next `<link>`, and the next tag has an extra `>`. This can change parser recovery and cause source-to-build article subtree differences. The diagnostic `python scripts/static_html_poc/diagnose_malformed_head.py` asserts these exact source defects. **No article text, formatting or source metadata was edited in this investigation.** Preferred remedy: separately review a narrowly scoped metadata-only correction, then re-run the 122-route inventory and nine-route live/browser gates. Do not bypass content integrity checks.
