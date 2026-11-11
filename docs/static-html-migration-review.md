# Static HTML migration — review-only gate

Status: PROPOSAL ONLY. This work does not authorize merging, staging activation, production cutover, or deployment.

## Current repository baseline (2026-11-11)

- Current `main`: `1b395d543d91f4df2227a17fdf54251fe6a386ca`, including merged PR #491 and the new Japanese article `/本源全視点vs個我単一視点/`.
- The repository tree contains 140 tracked public `index.html` routes plus one standalone public HTML file, `Roswell/Roswell.html`.
- This refresh ports PR #474's offline-first checks and Worker-aligned Contact/Disclaimer footer. It refreshes the Japanese TOC fixture and adds the new Japanese article as a twelfth pinned source fixture.
- The Roswell sources are explicitly classified rather than silently dropped: `/Roswell/` is a known public route whose legacy LibreOffice HTML has no `<article>` or `<main>` content scope; `Roswell/Roswell.html` is a standalone PDF-derived HTML resource, not an index route or sitemap entry. Both raw Git blob fingerprints are pinned. Neither source file is changed or passed through the transformer.
- The offline inventory distinguishes supported transformations from blockers: 139 supported routes are expected to be transformed, one public route is reported as blocked and preserved in source, and one standalone HTML resource is classified separately. CI reports these counts and keeps `migration_ready=false`; a green diagnostic is not a claim that every route is Worker-equivalent.
- Twelve pinned fixtures cover the homepage, language indexes, Search, Ask, Contact, representative English/Chinese/Japanese articles, and the newly merged Japanese all-perspectives article. The Japanese index hash is refreshed to the current source bytes.
- Contact runtime contracts remain source-only in PR mode: Search/Ask behavior, the legacy redirect, Contact forms, Turnstile, the Worker `/api/contact` handler, and the current Worker footer are checked locally. A regression test asserts that PR mode makes zero HTTP requests.
- Latest current-main push checks at this baseline completed successfully: Deploy Awakenology, Content Integrity Gate, Sitemap route parity, SEO metadata inventory, and Live SEO runtime audit. The existing main-branch Deploy workflow was triggered by the preceding main push; this run did not initiate a deployment.
- Live Worker signature, HTTP runtime-contract, and desktop/mobile browser-parity checks remain separate manual approval gates. Skipped checks are not represented as passes. Private Editor/Generator verification, Cloudflare secrets, staging activation, and physical iOS Safari confirmation remain outside this source-only task.

## Current related PRs and dependencies

- PR #460 is merged. Its Contact page and Worker endpoint are part of current `main`; this refresh only mirrors the current Worker footer and adds source-only regression coverage. The production Worker remains the handler for `/api/contact`.
- PR #461 remains open but its sitemap-only correction is already present on current `main` (the canonical `/破壊は一瞬/` URL is percent-encoded in `sitemap.xml`). Treat the old branch as redundant; do not merge it as-is.
- Historical PRs #392, #400, and #401 are stale/superseded. PR #462 contains the previous offline-first implementation, but its base is stale; review this current-main refresh instead.
- PR #255 remains the original isolated experiment: frozen, draft, unmerged, and undeployed. Do not modify or merge it.

## What the current PoC proves

- Twelve pinned source fixtures are checked against raw Git blob fingerprints, including homepage, language indexes, Search, Ask, and representative English, Japanese, and Traditional Chinese articles.
- Source preservation, metadata rules, deliberate mutation detection, deterministic transformation, idempotence, and local asset references are tested.
- `/New-Article/` is explicitly treated as a noindex experimental route without a canonical URL and remains outside the sitemap.
- The tracked public index routes are classified before transformation: supported routes are built into temporary staging; the known Roswell route blocker and standalone Roswell HTML resource are reported separately and are not transformed.
- Pull-request runtime-contract validation is source-only and has six local contracts plus a regression test proving it makes zero HTTP requests.

A matching fixture or footer signature is not proof of full HTML, JavaScript, accessibility, HTTP, browser, visual, or Worker-route equivalence. A skipped job is not a pass. Historical live/browser results from earlier commits are not fresh evidence for the current head.

## Architecture and content-preservation constraints

1. Keep the existing Cloudflare Worker as the production request-routing, authentication, and dynamic API boundary. The PoC may explore build-time replacement of the public HTMLRewriter transformation only; it does not authorize removing or bypassing the Worker.
2. Keep private Editor, Word Generator, and HTML Generator routes and APIs private, authenticated, and excluded from public crawl/sitemap inventories.
3. Preserve original article text, markup, image references, order, inline formatting, and styling. Original HTML remains authoritative; no Markdown round-trip or content cleanup is authorized by this PoC.
4. Preserve current shared header/footer behavior, Search/Ask endpoints and noindex rules, legacy `/ai-search/` redirect, language navigation, theme toggle, Chinese conversion, return-to-top, and static assets.
5. Keep dynamic endpoints such as `/api/contact` on the Worker. Static output is not permitted to turn a Worker-only API into a public asset or remove its security checks.
6. Keep the Content Integrity Gate, SEO metadata inventory, sitemap parity for route/sitemap changes, and bounded Live SEO audit meaningful. Investigate failures; never weaken thresholds merely to obtain a green check.

## Required before any migration approval

1. Re-run offline source fixtures, full inventory, temporary staging build, content integrity, metadata inventory, and sitemap parity against the then-current `main`.
2. Obtain explicit approval before triggering the manual `workflow_dispatch` with `run_live_checks=true`. That workflow performs bounded read-only production Worker signature, HTTP-contract, and desktop/mobile Chromium requests. Do not substitute a broad production crawl.
3. Review all live and browser artifacts. Investigate every unexplained difference; a signature match alone is insufficient.
4. Verify desktop/mobile behavior and obtain separate visual confirmation in real iOS Safari, including TC/ST followed by Dark/Light. Chromium emulation is not physical iOS Safari.
5. Separately verify private Editor/Generator authentication and noindex/cache behavior. This requires the appropriate access and must not expose secrets or authenticated private-host requests in public CI.
6. Demonstrate a reproducible staging-only deployment, asset/cache behavior, rollback to a recorded known-good Worker revision, and post-rollback smoke checks. Staging activation requires approval; no production switch is part of this PoC.
7. Present measured performance evidence and all remaining differences, then obtain explicit final approval before any merge that changes production behavior or any deployment.

## Stop conditions

Any lost or changed article content, broken route, unexpected canonical/noindex change, Editor/Generator regression, dynamic API/security regression, missing artifact, failed parity gate, unreviewed secret requirement, or unexplained runtime difference blocks migration. Do not proceed to cutover by relaxing tests.

## Cloudflare request-budget safeguard

Automatic PoC PR validation is offline: unit tests, eleven pinned source fixtures, full source inventory, and isolated temporary staging output. Live Worker signature, HTTP runtime-contract, and browser-parity checks are manual and require explicit approval. The Live SEO workflow remains bounded for ordinary site changes; PoC/audit/test/sitemap-only changes are excluded from unnecessary production request paths, while main-branch and scheduled audits remain intact. These exclusions reduce traffic; they do not waive required checks for route-changing or production-behavior changes.

**Current decision:** the static HTML PoC remains review-only. Keep the existing production Cloudflare Worker and all original article content unchanged. No merge, staging activation, production cutover, or deployment is authorized.
