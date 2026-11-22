# Static HTML migration — review-only gate

Status: PROPOSAL ONLY. This work does not authorize merging, staging activation, production cutover, or deployment.

## Current repository baseline (2026-11-09)

- Current `main`: `73cc5eac0b6185c1f273c89fcd6ddbc74192f80b` (Japanese article title shortened to 「破壊は一瞬」).
- Current offline-first PoC review: [PR #462](https://github.com/shifter888ai/awakenology/pull/462), branch `chore/static-html-offline-first-current-main-2026-11-09`, head `fadf268b832423b97e95acbb7c9bf92ce6bb80cb`.
- PR #462 is based on current `main`; its scope is workflow, documentation, and isolated PoC tooling. It does not change the production Worker, Wrangler configuration, DNS, public routes, sitemap, or article bodies.
- Latest automatic offline validation: **26/26 PoC unit tests**, **10/10 pinned source fixtures**, **136/136 public HTML source routes**, and **136/136 temporary staging HTML outputs** passed. Route-set, source integrity, metadata, deterministic/idempotent output, and local asset-reference checks passed. Content Integrity Gate and SEO metadata inventory passed.
- Automatic PR checks intentionally skip live Worker signature, HTTP runtime-contract, and desktop/mobile browser-parity jobs. The latest PoC run made no production requests. Sitemap parity was not triggered because PR #462 does not change a sitemap or public route.
- These results establish offline source/build checks only. They do **not** establish current live Worker equivalence, browser/visual parity, private Editor/Generator behavior, or iOS Safari compatibility.

## Current related PRs and dependencies

- [PR #461](https://github.com/shifter888ai/awakenology/pull/461) proposes the one-entry sitemap correction for `/破壊は一瞬/`. Its sitemap parity check passes. Its bounded Live SEO audit fails because the new PR-only source route does not contain Open Graph defaults injected by the production Worker. PR #462 adds source-only classification for PR-only routes while retaining live metadata checks for deployed routes.
- [PR #460](https://github.com/shifter888ai/awakenology/pull/460) proposes the Contact page and Cloudflare-native submission endpoint. It adds `worker.js` and `wrangler.jsonc` changes on its review branch; none are deployed. Its Live SEO audit likewise flags Worker-injected Open Graph defaults missing from the PR-only `/Contact/` source. The source-only audit classification in PR #462 addresses this class of false positive.
- PR #460 cannot be activated until Cloudflare Email Service sender/destination verification, the Email Service binding, Turnstile site key and Worker secret are configured. Desktop/mobile visual confirmation is also a user-only gate. The `/api/contact` endpoint must remain behind the Cloudflare Worker; static HTML output must never bypass that dynamic boundary.
- Historical PRs #392, #400, and #401 are stale/superseded by the current-main work in PR #462. Do not merge those older branches as-is.
- [PR #255](https://github.com/shifter888ai/awakenology/pull/255) remains the original isolated experiment: frozen, draft, unmerged, and undeployed. Do not modify or merge it.

## What the current PoC proves

- Ten pinned source fixtures are checked against raw Git blob fingerprints, including homepage, language indexes, Search, Ask, and representative English, Japanese, and Traditional Chinese articles.
- Source preservation, metadata rules, deliberate mutation detection, deterministic transformation, idempotence, and local asset references are tested.
- `/New-Article/` is explicitly treated as a noindex experimental route without a canonical URL and remains outside the sitemap.
- The full tracked public HTML inventory is validated and transformed into a temporary staging tree; the route set and generated output are checked without publishing the tree.
- Pull-request runtime-contract validation is source-only and has a regression test proving it makes zero HTTP requests.

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

Automatic PoC PR validation is offline: unit tests, pinned source fixtures, full source inventory, and isolated temporary staging output. Live Worker signature, HTTP runtime-contract, and browser-parity checks are manual and require explicit approval. The Live SEO workflow remains bounded for ordinary site changes; PoC/audit/test/sitemap-only changes are excluded from unnecessary production request paths, while main-branch and scheduled audits remain intact. These exclusions reduce traffic; they do not waive required checks for route-changing or production-behavior changes.

**Current decision:** the static HTML PoC remains review-only. Keep the existing production Cloudflare Worker and all original article content unchanged. No merge, staging activation, production cutover, or deployment is authorized.
