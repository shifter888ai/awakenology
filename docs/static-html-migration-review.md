# Static HTML migration — review-only gate

Status: PROPOSAL ONLY. This work does not authorize merging, staging activation, production cutover, or deployment.

## Current repository baseline (2026-11-12)

- Current `main`: `a21f339ff5f4cba8f09ddab8dcf8a1e149a23005`, including merged PR #482 and the latest Japanese content changes through PR #491.
- The offline inventory validates **139 supported public `index.html` routes**. The `/Roswell/` index route is included: current `main` added a semantic `<main>` content scope and SEO metadata, so it is no longer a route blocker.
- `Roswell/Roswell.html` is one separate standalone PDF-derived HTML resource, not an index route or sitemap entry. Its raw Git blob fingerprint is pinned. The source file remains unchanged and is not passed through the transformer.
- The inventory reports 139 supported routes, **zero known public index-route blockers**, and the one standalone HTML resource separately. The standalone resource remains outside the index-route staging build, so `migration_ready=false`; a green diagnostic is not a claim that every route is Worker-equivalent.
- This refresh ports PR #474's offline-first checks and Worker-aligned Contact/Disclaimer footer. It refreshes the Japanese TOC fixture and adds the new Japanese all-perspectives article as a twelfth pinned source fixture.
- Twelve pinned fixtures cover the homepage, language indexes, Search, Ask, Contact, representative English/Chinese/Japanese articles, and the newly merged Japanese all-perspectives article. The Japanese index hash is refreshed to the current source bytes.
- Contact runtime contracts remain source-only in PR mode: Search/Ask behavior, the legacy redirect, Contact forms, Turnstile, the Worker `/api/contact` handler, and the current Worker footer are checked locally. A regression test asserts that PR mode makes zero HTTP requests.
- Worker-only routes under `/api/` are excluded from HTML source classification and temporary staging. The public HTML manifest validator explicitly rejects `/api/contact`, `/api/contact/`, and other `/api/` routes.
- Latest PR-head validation — `d3cac276b26f8861a3e27a8319dbd66457527e67` (2026-11-12): Static HTML PoC unit tests **34/34 passed**; pinned source fixtures **12/12 passed**; supported-route inventory **139/139 passed**; temporary staging **139/139 routes built**; Content Integrity Gate passed; SEO metadata inventory passed. The Static HTML PoC run is [#270](https://github.com/shifter888ai/awakenology/actions/runs/43197514849), Content Integrity run [#1366](https://github.com/shifter888ai/awakenology/actions/runs/43197514713), and SEO inventory run [#1263](https://github.com/shifter888ai/awakenology/actions/runs/43197515018).
- Live Worker signature, HTTP runtime-contract, and desktop/mobile browser-parity jobs were **skipped by design**, not passed. No production crawl or live parity claim is made. Private Editor/Generator verification, Cloudflare secrets, staging activation, and physical iOS Safari confirmation remain outside this source-only task.

## Current related PRs and dependencies

- PR #460 is merged. Its Contact page and Worker endpoint are part of current `main`; this refresh only mirrors the current Worker footer and adds source-only regression coverage. The production Worker remains the handler for `/api/contact`.
- PR #461 remains open but its sitemap-only correction is already present on current `main` (the canonical `/破壊は一瞬/` URL is percent-encoded in `sitemap.xml`). Treat the old branch as redundant; do not merge it as-is.
- Historical PRs #392, #400, and #401 are stale/superseded. PR #462 is an earlier offline-first implementation with a stale base; PR #474 is the previous current-main refresh. Review this newer current-main refresh in PR #492 instead.
- PR #255 remains the original isolated experiment: frozen, draft, unmerged, and undeployed. Do not modify or merge it.

## What the current PoC proves

- Twelve pinned source fixtures are checked against raw Git blob fingerprints, including homepage, language indexes, Search, Ask, and representative English, Japanese, and Traditional Chinese articles.
- Source preservation, metadata rules, deliberate mutation detection, deterministic transformation, idempotence, and local asset references are tested.
- The supported public index routes, including `/Roswell/`, are classified before transformation and built into temporary staging. The standalone `Roswell/Roswell.html` resource is reported separately and is not transformed.
- `/New-Article/` is explicitly treated as a noindex experimental route without a canonical URL and remains outside the sitemap. Repository-only `Internal/` and legacy `New-Article/` generator fixtures are excluded from the public route inventory and staging.
- Pull-request runtime-contract validation is source-only and has six local contracts plus a regression test proving it makes zero HTTP requests. A separate manifest guard rejects Worker-only `/api/` routes, including `/api/contact`, from static HTML output.

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

Automatic PoC PR validation is offline: unit tests, twelve pinned source fixtures, full source inventory, and isolated temporary staging output. Live Worker signature, HTTP runtime-contract, and browser-parity checks are manual and require explicit approval. The Live SEO workflow remains bounded for ordinary site changes; PoC/audit/test/sitemap-only changes are excluded from unnecessary production request paths, while main-branch and scheduled audits remain intact. These exclusions reduce traffic; they do not waive required checks for route-changing or production-behavior changes.

**Current decision:** the static HTML PoC remains review-only. Keep the existing production Cloudflare Worker and all original article content unchanged. No merge, staging activation, production cutover, or deployment is authorized.
