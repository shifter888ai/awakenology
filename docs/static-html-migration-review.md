# Static HTML migration: review-only gate

Status: PROPOSAL ONLY. No production merge or deploy is authorized.

## Validated isolated baseline

- Frozen PoC branch for PR #255: `poc/static-html-build-parity`, head `9650521c5c03282a816a5941870c186cb8b9cf12`.
- Historical manual validation run: [40989967968](https://github.com/shifter888ai/awakenology/actions/runs/40989967968).
- The run produced `static-html-full-inventory` and `static-html-browser-parity` artifacts. Their detailed review is recorded below.
- The PoC is not Worker-equivalent and is not approved for production routing or deployment.
- Chromium iPhone-sized viewport is not physical iOS Safari.
- GitHub Actions reported nonblocking Node.js 20 / punycode / url.parse deprecation warnings.

## Artifact review (2026-11-06; historical diagnostic evidence only)

The two artifacts from run `40989967968` were downloaded and inspected, including side-by-side desktop and iPhone-sized screenshots.

**Provenance:** GitHub records the workflow-dispatch event on `main` at `8eba6de73270c65dc26ea7854172c0dd63e646d6`, using `.github/workflows/manual-static-html-poc.yml`. That workflow explicitly checks out `poc/static-html-build-parity` in the parity, full-inventory and browser-parity jobs. The logs for all three jobs confirm the checked-out commit was `9650521c5c03282a816a5941870c186cb8b9cf12`, exactly PR #255's frozen head. The artifacts are therefore valid historical evidence for that PoC commit, but **not current-main evidence**: current `main` is `08fd59ddcac86f8a08a152cdd391a83c5c7a7641` (inspected 2026-11-06). Do not refresh or modify PR #255; it remains frozen, draft and unmerged.

### Full source/build inventory

- 122 tracked public `index.html` routes were processed.
- Eight HTML files were explicitly excluded, including `404.html`, the private Editor/Generator pages, and PoC-only toggle fragments.
- The report contains zero route failures. Its checks validate article text, article markup, image attributes, canonical/robots metadata, deterministic output and idempotence.
- `/ai-search/` is intentionally included as a route but retains its noindex/no-canonical treatment; it is not an indexable route.
- Per-route source and generated SHA-256 fingerprints are retained in the JSON artifact. The differing whole-file hashes are expected because the build adds/replaces shared page chrome and metadata; the separate article-integrity checks are the relevant content-preservation evidence.

### Browser and screenshot parity

- Nine pinned fixtures were checked at desktop (1440 px) and iPhone-sized (390 px) Chromium viewports: 18 comparisons.
- The report has zero DOM, interaction or screenshot-tolerance failures. Theme round-trip, return-to-top, Chinese conversion on the Chinese index, article subtree, images, footer and navigation are included in the browser assertions.
- Sixteen screenshots are pixel-exact. The two non-exact screenshots are the Chinese index at desktop and iPhone-sized viewports. Both have identical dimensions; each has 344 pixels with any channel difference, maximum channel delta 7, and zero pixels exceeding the 12-per-channel threshold. The report's thresholded changed-pixel fraction is 0.0 for both.
- Visual inspection of both Chinese-index side-by-side screenshots found no substantive layout or content difference. Record these as tiny sub-threshold raster differences, not as a pixel-exact pass.
- These results are pinned-fixture Chromium evidence only. They do not establish physical iOS Safari parity or coverage of all 122 routes in a browser.

### Markdown round-trip diagnostic — PR #368

A separate, isolated diagnostic in PR #368 converted a temporary Markdown derivative of `New-Article/index.html` back to HTML. Its latest report found 41 text-difference segments, all single ASCII-space deletions; no words, numbers, punctuation, or images were missing. The image inventory matched exactly (1/1). However, the generated HTML lost 279 blue-text spans, 393 font-size spans, 79 underlined elements, 38 aligned paragraphs, and 37 intentional blank paragraphs. PR #368's five applicable checks passed, but this is a one-article diagnostic, not a production migration test. It confirms that Markdown round-tripping is not an acceptable replacement for the current HTML source where article-specific formatting matters. The existing HTML remains authoritative.

No new production crawl or live request was initiated during this artifact review.

## Worker feature boundary — source inspection

The current source configuration and `worker.js` establish the following boundary:

- `wrangler.jsonc` uses `./worker.js`, the repository-root `ASSETS` binding, `run_worker_first: true`, and `404-page` fallback behavior.
- On the public host, `/editor`, `/editor/*`, `/api/editor/create-draft-pr`, and `/api/editor/publish-page` return 404. Public requests are fetched from `ASSETS`; non-HTML responses pass through unchanged; public HTML is transformed by `HTMLRewriter`.
- On `editor.awakenology.space`, the Worker owns robots exclusion, GitHub OAuth start/callback/logout, signed-session authorization, editor asset access, draft-PR creation and the separate publish API. Authenticated editor assets receive `X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: private, no-store`.
- Legacy `/ai-search` and `/ai-search/` requests now receive a 301 redirect to `/search/`, preserving the query string. Dedicated `/search/` and `/ask/` pages exist in the current source; the Worker applies noindex treatment to the legacy and dedicated utility paths.
- A future build-time transform can only be considered as a replacement for the public HTML rewriting layer. The Worker must remain the request-routing, 404/fallback, private authentication and API boundary unless independently tested equivalent behavior is approved.

This is source inspection, not a live private-host security or HTTP-equivalence audit. The Search/Ask page files and legacy redirect logic are verified from current source, but live AI endpoint responses, missing-path and encoded-Unicode behavior, status/header/cache parity, asset behavior, and private Editor/Generator authentication remain unverified by this documentation-only review.

## Required before implementation approval

1. Create a new isolated branch from current `main` for any refreshed PoC work; leave PR #255 and its branch untouched. Re-run the offline source/unit/full-inventory checks against current content and retain the exact commit SHA and artifact hashes.
2. Compare public route resolution, redirects, missing paths, query strings, encoded Unicode paths, status codes, response headers and cache behavior with the current Worker. Keep production traffic bounded and representative; do not start a broad production crawl.
3. Compare existing shared header/footer, Search/Ask AI, static assets, language/theme/return-to-top controls and SEO metadata with the proposed output. Record each feature as retained, replaced or excluded.
4. Keep original article text, markup, images and styling intact; keep private Editor/Generator out of the public build inventory. Preserve the agreed HTML Cleaner and default-font behavior.
5. Keep Content Integrity Gate, live SEO runtime audit, SEO metadata inventory and sitemap route parity mandatory. Add full source/build inventory and representative live/browser parity. Investigate failures; never weaken thresholds merely to pass.
6. Verify responsive behavior in real iOS Safari separately, including TC/ST followed by Dark/Light. Chromium emulation alone is insufficient.
7. Document staging-only deployment, asset/cache behavior, rollback to the last known-good Worker release, and post-rollback smoke checks. No production cutover in this PR.
8. Obtain explicit final approval after presenting remaining differences and rollback evidence.

## Stop conditions

Any lost/changed article content, broken route, unexpected SEO/canonical/noindex change, Editor/Generator regression, runtime service regression, missing artifact, failed parity gate, or uncertain rollback blocks migration.

## Scope of this review

Documentation and offline artifact inspection only. No Worker code, article content, route, configuration, workflow, production binding, DNS, or deployment changes. PR #255 remains frozen, draft and unmerged.


## Earlier source/build revalidation (2026-11-07; historical)

An earlier isolated validation recorded in this review used main commit `40b039df190588ab0724b75baeeb54a917b04551`. It is retained as historical evidence and is not presented as validation of today's main.

- **Unit tests:** 22/22 passed.
- **Pinned real-page fixtures:** 9/9 passed after refreshing six source fingerprints. The changed English, Japanese and Chinese TOCs contained approved navigation/content updates; three article fixtures changed only in SEO metadata, and their complete `<body>` regions were byte-identical to the prior source.
- **Full public source inventory:** 133/133 routes passed source, metadata and deterministic-build checks.
- **Temporary staging build:** 133/133 HTML routes generated; source preservation, metadata, determinism, idempotence and local asset-reference checks passed with zero local asset failures.
- **Live Worker signature, HTTP runtime-contract and browser-parity checks:** deliberately skipped. This established source/build confidence only, not runtime or visual equivalence.

## Offline-first PoC validation — PR #400 (2026-11-07; historical head)

PR #400's latest recorded head is `744af162cb62653d793b32b26638cfef9153556e`. Its validation was based on main commit `bacf7017a700fd64376016d093e822324e192c05`, not today's main.

- **Offline unit tests:** 25/25 passed.
- **Pinned real-page source fixtures:** 10/10 passed.
- **Public source inventory:** 135/135 routes passed.
- **Temporary staging build:** 135/135 HTML routes generated; route-set, source-integrity, metadata, deterministic-output and local-asset-reference checks passed.
- **Content Integrity Gate, sitemap route parity, SEO metadata inventory, Live SEO runtime audit and Static HTML PoC workflow:** all five PR-triggered workflows completed successfully on that head.
- Within the Static HTML PoC workflow, the offline parity and full-inventory jobs passed. Browser parity, live Worker signature and HTTP runtime-contract jobs were skipped by design; they are not represented as current live/browser passes.
- The bounded Live SEO audit checked 100 resources (99 successful and one redirect), 12 production metadata routes, and 2,317 local references with zero broken/read errors.

PR #400 is still a draft. Its branch is now 25 commits behind current main commit `96acfee692dfcd8a3478081bd16b05dbdc2cbbaa` (the 2026-11-08 JST repository head). Therefore the successful results above are historical evidence for the PR's tested base/head only. Rebase and rerun offline validation against current main before treating PR #400 as current-main evidence. Do not run its optional live/browser checks automatically.

## Current-main source architecture (2026-11-08)

Current main is `96acfee692dfcd8a3478081bd16b05dbdc2cbbaa` (`Add subtle dividers between disclaimer languages`, committed 2026-11-07 15:04 UTC).

Source inspection confirms:

- `search/index.html` and `ask/index.html` are present as dedicated Search and Ask pages.
- The Worker redirects legacy `/ai-search` and `/ai-search/` requests to `/search/` with the original query string.
- The Worker applies noindex treatment to `/ai-search/`, `/search/` and `/ask/`; these utility pages are not ordinary indexable article routes.
- `wrangler.jsonc` still points to `./worker.js`, serves the repository-root asset directory through the `ASSETS` binding, retains `run_worker_first: true`, and uses `404-page` fallback handling.
- The Worker remains responsible for request routing, public HTML rewriting, the legacy redirect, private Editor host authentication and editor APIs. No static-serving mode or production routing switch is introduced by this review.

The current source state does not establish private-host security, live AI service behavior, complete HTTP/header/cache equivalence, physical-device visual parity, or rollback readiness.

## Current runtime and release blockers (2026-11-08)

- Dedicated Search and Ask pages are already present in current main. The older open PR #398 is not the source of truth for the current implementation; do not describe these pages as awaiting deployment.
- Private Editor/Generator authentication, authorization boundaries, response headers and no-store behavior still require a separately authorized private-host verification. This review does not access credentials or secrets.
- Real iOS Safari visual/interaction confirmation remains a user-only gate, including the TC/ST followed by Dark/Light sequence. Chromium emulation is not a substitute.
- Staging-only deployment and rollback rehearsal require explicit approval and a confirmed isolated environment. No staging or production deployment is authorized.
- Broad production crawling is not authorized; use offline validation and bounded representative checks only.
- PR #255 remains frozen, draft, unmerged and untouched.

This review is documentation and source-inspection evidence only. It does not authorize replacing the production Worker, merging the PoC, accessing private secrets, staging deployment, or production deployment.
