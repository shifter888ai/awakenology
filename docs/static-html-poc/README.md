# Static HTML build-parity PoC (non-deployed)

This draft branch is isolated from production. It explores moving deterministic HTMLRewriter output to build time. It is **not Worker-equivalent and must not be merged or deployed** as a routing change without explicit approval.

## Current verification baseline (2026-11-10)

This refresh is based on current `main` at `bad720f8903353262f8e06b8b48cbb50fdb5707e`. The ten previously reviewed source fixtures remain pinned to their approved source bytes; an eleventh fixture now covers the merged `/Contact/` page. The Contact page and Worker `/api/contact` handler are already on `main` following PR #460. The transformer mirrors the current Worker footer Contact/Disclaimer links and active-page states. The current public-route and staging counts are recomputed by CI; the historical 136/136 result belongs to the 2026-11-09 baseline and is not reused as current evidence. This PR changes validation, tests, workflows, and documentation only—not article bodies, `worker.js`, or `wrangler.jsonc`.

## Current verified scope

Eleven pinned source fixtures: homepage, English/Japanese/Chinese language indexes, dedicated Search and Ask pages, two Chinese articles, one English article, and one Japanese article (including Unicode routes), plus the Contact page with its Worker-backed submission endpoint. Git blob fingerprints are computed from raw repository bytes, preserving legacy line endings. The source-content/markup/image and idempotence checks passed. Historical live Worker **signature** parity passed on the earlier nine-fixture set at commit `7e78d0f`; subsequent regression and metadata checks passed at `15828ce` and `3e0a5d8`. This is historical evidence, not a fresh check of the current ten-fixture set.

The PoC also tests deliberate content and signature mutations, duplicate canonical and robots metadata, unexpected noindex, and static public crawl-inventory exclusions for Editor/Generator. It explicitly treats `/New-Article/` as a noindex experimental route outside the sitemap, alongside the noindex Search/Ask utility routes. The static inventory test passed at `c2f7899`; the Live SEO runtime audit was still pending when this document was updated. No private host authentication was exercised.

These are limited tests: a matching signature does **not** establish full HTML, JavaScript, browser, accessibility, visual, or Worker-route equivalence.

## Remaining release blockers

1. Expand route coverage beyond the ten pinned fixtures, including more nested and Unicode articles, redirects, missing paths, and edge cases. Compare against the current Worker behavior.
2. Compare complete rendered DOM/head/body semantics and run browser-level tests for theme, return-to-top, Chinese conversion, language/navigation links, image URLs, accessibility, and responsive layouts. A matching signature alone is insufficient.
3. Validate article subtree preservation (inline colors, bold text, images, order and content) on a much broader sample. BeautifulSoup serialization is not literal source-byte comparison.
4. Separately verify Private Editor, Word Generator and HTML Generator authentication and live HTTP noindex/cache headers where appropriate, plus exclusion from public crawl/sitemap. The static inventory test is not a live security audit. Preserve noindex behavior for `/search/` and `/ask/`; keep both out of the sitemap, and preserve the legacy `/ai-search/` redirect to `/search/`.
5. Demonstrate build reproducibility, idempotence, fail-closed behavior, rollback and measurable performance benefit before any production routing proposal.
6. Re-run every check against the then-current `main` after unrelated content merges. Pinned fixture hashes must only be refreshed after verifying the corresponding source change.
7. Obtain explicit human approval before any merge or deployment.

## Current PoC gates

- Unit tests: `python -m unittest discover -s scripts/static_html_poc -p 'test_*.py' -v`
- Pinned source fixtures: `python scripts/static_html_poc/check_real_pages.py` (11 current-main routes, including Search, Ask, and Contact).
- Full public route inventory and isolated temporary staging build (automatic pull-request checks).
- Optional production checks — live Worker signature comparison, read-only HTTP runtime contract, and desktop/mobile Chromium parity — only through manual `workflow_dispatch` with `run_live_checks=true`. Skipped checks are not a pass.
- Existing repository Content Integrity Gate, Sitemap route parity, and SEO metadata inventory. The Live SEO runtime audit remains bounded for ordinary site PRs. PoC-only, audit-only, test-only, and sitemap-only PRs are excluded from its production request path; main-branch and scheduled audits remain unchanged. Sitemap route parity runs only when a sitemap, public `index.html` route, `robots.txt`, or the sitemap audit script changes; main pushes and manual runs remain covered. PR-only source routes are labeled source-only in the report: Worker-injected Open Graph defaults are not required in raw source, and no live runtime pass is claimed.

No Worker routing or production deployment change is authorized by this PoC.


## Phase 2 and Phase 3 status (2026-10-25)

Phase 2: nine pinned routes × desktop/iPhone Chromium passed rendered DOM, theme round-trip, return-to-top and Chinese conversion checks. Screenshots are compared with equal dimensions and a strict 0.05% changed-pixel tolerance (per-pixel channel difference >12); exact matches are also reported. This is scoped to pinned fixtures, not every route.

Phase 3: complete. At commit `81b353f`, both full-inventory CI runs passed **122/122** tracked public routes; both browser-parity runs passed; nine pinned fixture and live signature checks, sitemap parity, content-integrity, metadata inventory, Worker build, and live SEO audit all passed. The two SoC legacy article blocks are preserved verbatim through an opaque, fail-closed transform guard; no content-validation exemptions were added. Chinese TOC and Revelation (2) fixture source blobs were synchronized to approved `main` versions. This is build/source parity, **not** full Worker replacement approval.

## Phase 4: Worker equivalence and rollback (pending; observation-only)

- Inventory Worker-specific request handling from `worker.js` and `wrangler.jsonc`, including `run_worker_first`, asset fallback, redirects, status codes, headers, APIs, and editor-host routing. Static output must not replace dynamic endpoints.
- Compare live and generated behavior for every public route, not only the ten current source fixtures. Record redirects, 404/missing paths, query strings, Unicode and encoded routes, and HTTP headers. Fail on unexplained differences.
- Audit private Editor, Word Generator and HTML Generator on their intended host: unauthenticated access denial, auth/session behavior, noindex and cache controls. Do not log secrets or authenticate in public CI. Confirm public sitemap/crawl exclusions. Preserve noindex behavior for `/search/` and `/ask/`; keep both out of the sitemap, and preserve the legacy `/ai-search/` redirect to `/search/`.
- Demonstrate a reproducible build and a measured performance improvement with comparable sampling; document exact deployment and rollback commands, prior known-good Worker revision, DNS/routing implications, and a rehearsal in an isolated environment. No production switch as part of the rehearsal.
- Refresh this document with observed evidence and unresolved differences before seeking explicit human approval. Keep PR #255 draft, unmerged and undeployed.


### Phase 4 Worker routing inventory (source inspection)

`wrangler.jsonc` sets `assets.run_worker_first=true`, `assets.not_found_handling=404-page`, and `main=./worker.js`. The Worker intercepts requests before assets, separates `editor.awakenology.space` by hostname, and performs authenticated editor and publishing actions. The public host returns 404 for editor paths and publishing APIs. On the editor host, the OAuth start/callback/logout routes and signed session gate remain dynamic; authenticated editor assets receive `X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: private, no-store`. Public HTML alone is transformed by HTMLRewriter; non-HTML assets pass through unchanged. The dedicated `/search/` and `/ask/` pages are noindex; legacy `/ai-search/` redirects to `/search/`. These are source-observed contracts, not a live private-host audit.

**Architecture constraint:** build-time HTML may replace only the public HTML rewriting layer. Keep the Worker as the request router and authentication/API boundary, or establish independently tested equivalent handling before proposing removal. Never put editor credentials or authenticated private-host requests into public CI artifacts. Missing-path, redirect, query-string, Unicode and HTTP-header observations remain pending.

### Cloudflare request budget safeguard (2026-10-25)

Earlier PoC push and pull-request events could duplicate live checks. Automatic PoC PR checks now run offline: unit tests, pinned source fixtures, full public-route inventory, and isolated temporary staging build. Live Worker signature, read-only HTTP runtime-contract, and desktop/mobile Chromium checks are skipped on PRs and require manual `workflow_dispatch` with `run_live_checks=true`. The shared Live SEO workflow excludes PRs changing only `scripts/static_html_poc/**`; scheduled and main-branch audits remain unchanged. Previous live validation evidence remains historical, not a fresh pass for the current fixture set. Do not interpret skipped live checks as a pass. This reduces avoidable Cloudflare requests without suppressing ordinary site audits.


## Batch 2: isolated staging output prototype

The batch workflow builds all tracked public HTML routes into a temporary directory, reads each generated file back, checks deterministic/idempotent transformation and metadata, confirms the staged route set exactly matches the public inventory, and checks local image/script/stylesheet/icon/preload references against tracked files. The temporary output is deleted automatically after the run. The report records that this is an HTML-only build: non-HTML assets continue to be served by the existing Worker/ASSETS layer, and the build does not test or replace HTTP status codes, redirects, cache headers, 404 behavior, or authenticated Editor/Generator behavior.

Automatic pull-request validation runs unit tests, the eleven pinned source fixtures, full public-route inventory, and the temporary staging build. The live Worker signature, read-only HTTP contract, and desktop/mobile Chromium parity jobs are separate manual checks enabled only by `workflow_dispatch` with `run_live_checks=true`. Passing offline checks is evidence for the isolated build prototype only; it does not establish runtime/visual equivalence or authorize production deployment or Worker routing changes.


## Phase 4A: read-only live HTTP contract batch

The optional manual HTTP-contract job probes a small set of production contracts without credentials or writes: homepage response, missing-route 404, public-host denial of private Editor/API paths, the legacy `/ai-search/` redirect, noindex on `/search/` and `/ask/`, and unauthenticated Editor-host redirects/denials. It records a JSON report and fails closed when a contract does not match the documented expectation. This is observation-only and does not deploy or compare against a staging hostname. It is not part of automatic PR validation and does not replace a real isolated staging environment, authenticated Editor/Generator smoke tests, full route/header sampling, or rollback rehearsal.


## Phase 4B: expanded HTTP contract batch

The read-only probe now extracts robots meta tags from the complete sampled HTML response rather than assuming they occur in the first 2,000 characters. Additional unauthenticated checks cover query-string homepages, encoded Unicode article routes (with and without a query), public/editor robots resources, and rejection of an OAuth callback without state. No secrets, authenticated actions, writes, staging deployment or production routing changes are involved. These checks observe production behavior; staging equivalence and rollback remain separate blockers.


## Phase 5: HTTP baseline matrix (review-only)

The optional manual runtime-contract report also records 15 unauthenticated public/private URL observations, including index aliases, query strings, encoded Unicode, robots, sitemap, the legacy Search route, dedicated Search/Ask pages, missing routes and Editor access. It captures status, Location, Content-Type, Cache-Control, Vary, CSP, HSTS, ETag and extracted robots tags. The matrix fails only on transport errors; existing explicit security/routing contracts remain hard gates. A staging host must later be compared to this baseline and discrepancies reviewed before any cutover. No staging Worker, DNS, custom domain or production routing is created by this PR.
