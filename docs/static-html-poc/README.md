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

Phase 3: complete. At commit `81b353f`, both full-inventory CI runs passed **122/122** tracked public routes; both browser-parity runs passed; nine pinned fixture and live signature checks, sitemap parity, content-integrity, metadata inventory, Worker build, and live SEO audit all passed. The two SoC legacy article blocks are preserved verbatim through an opaque, fail-closed transform guard; no content-validation exemptions were added. Chinese TOC and Revelation (2) fixture source blobs were synchronized to approved `main` versions. This is build/source parity, **not** full Worker replacement approval.

## Phase 4: Worker equivalence and rollback (pending; observation-only)

- Inventory Worker-specific request handling from `worker.js` and `wrangler.jsonc`, including `run_worker_first`, asset fallback, redirects, status codes, headers, APIs, and editor-host routing. Static output must not replace dynamic endpoints.
- Compare live and generated behavior for every public route, not only the nine signature/browser fixtures. Record redirects, 404/missing paths, query strings, Unicode and encoded routes, and HTTP headers. Fail on unexplained differences.
- Audit private Editor, Word Generator and HTML Generator on their intended host: unauthenticated access denial, auth/session behavior, noindex and cache controls. Do not log secrets or authenticate in public CI. Confirm public sitemap/crawl exclusions. Preserve AI Search's noindex/no-canonical behavior.
- Demonstrate a reproducible build and a measured performance improvement with comparable sampling; document exact deployment and rollback commands, prior known-good Worker revision, DNS/routing implications, and a rehearsal in an isolated environment. No production switch as part of the rehearsal.
- Refresh this document with observed evidence and unresolved differences before seeking explicit human approval. Keep PR #255 draft, unmerged and undeployed.


### Phase 4 Worker routing inventory (source inspection)

`wrangler.jsonc` sets `assets.run_worker_first=true`, `assets.not_found_handling=404-page`, and `main=./worker.js`. The Worker intercepts requests before assets, separates `editor.awakenology.space` by hostname, and performs authenticated editor and publishing actions. The public host returns 404 for editor paths and publishing APIs. On the editor host, the OAuth start/callback/logout routes and signed session gate remain dynamic; authenticated editor assets receive `X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: private, no-store`. Public HTML alone is transformed by HTMLRewriter; non-HTML assets pass through unchanged. AI Search receives noindex treatment. These are source-observed contracts, not a live private-host audit.

**Architecture constraint:** build-time HTML may replace only the public HTML rewriting layer. Keep the Worker as the request router and authentication/API boundary, or establish independently tested equivalent handling before proposing removal. Never put editor credentials or authenticated private-host requests into public CI artifacts. Missing-path, redirect, query-string, Unicode and HTTP-header observations remain pending.
