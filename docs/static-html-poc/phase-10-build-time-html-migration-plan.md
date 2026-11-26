# Phase 10 — Build-time HTML migration plan

**Status: planning and current-main revalidation only. No production cutover, Worker routing change, Wrangler change, or deployment.**

## Objective

Move Awakenology's public-page presentation layer from request-time `HTMLRewriter` processing to complete static HTML generated at build time, following the dependency-free template principle used by ScienceOfOrigin. Preserve the existing site design, page content, metadata, navigation, accessibility, language controls, and dynamic services.

The migration is deliberately separate from the private Editor and dynamic API architecture.

## Current implementation findings

Inspection of the current `main` branch found:

- `worker.js` does more than insert the global header and footer. It also applies SEO metadata and canonical/robots rules, Open Graph defaults, homepage structured data, body classes, language/action navigation, favicon normalization, theme controls, Chinese conversion controls, and selected legacy-link handling.
- The same Worker handles Contact submissions and Turnstile verification, private Editor authentication/session checks, OAuth callbacks, and reviewed publishing APIs.
- `wrangler.jsonc` currently sets `assets.run_worker_first: true`, so the Worker is invoked before static assets are served. A build-time HTML conversion alone will not reduce Worker invocations.
- The repository already contains a static HTML PoC transformer, route inventory, content-integrity checks, browser-parity checks, and an isolated temporary staging builder. The static route allowlist remains empty and report-only.
- Existing PoC documentation explicitly prohibits treating the prototype as production-ready or merging it as a routing change. PR #255 is an older draft PoC and is not a production migration PR.

## Migration sequence

### 1. Revalidate the current source

- Run the existing PoC unit tests and pinned source fixtures against the current `main`.
- Rebuild and audit the complete current public HTML inventory.
- Recheck current live Worker signature parity and browser behavior where the workflow permits.
- Review every failure against current source changes; do not refresh pinned hashes merely to make a test pass.
- Record current route counts, excluded/private paths, and unresolved differences.

### 2. Produce a real build artifact without changing production

- Add a deterministic build command that writes generated pages and required public assets into a disposable `dist/` directory.
- Keep editable source HTML in its existing locations.
- Reuse the existing fail-closed transformer and content-preservation checks; do not introduce a second independent implementation of Worker presentation rules.
- Ensure private Editor/Generator material, internal documents, source scripts, tests, and repository-only files are not exposed as public assets.
- Validate output route parity, local asset references, metadata, canonical URLs, robots directives, Unicode paths, and deterministic rebuilds.
- Keep the current Wrangler asset directory and production Worker behavior unchanged during this phase.

### 3. Separate static delivery from dynamic Worker routes

Only after the generated artifact passes review, prepare a separate routing change.

The intended model is:

- Public pages and ordinary assets are served directly from Cloudflare static assets, without invoking Worker code when an asset matches.
- Worker-first handling remains for the private Editor entry points and protected paths, OAuth/session routes, Contact and Editor APIs, legacy AI Search redirects, and any other path proven to require runtime handling.
- Missing assets continue to reach the Worker so existing 404 and redirect behavior can be preserved.
- Editor-host root and robots behavior must remain protected; do not let a matching static asset bypass authentication or the editor-host robots response.
- The route-pattern list must be derived from a complete Worker route inventory and tested against both public and editor hostnames. Do not assume that a broad wildcard is safe.

Cloudflare's selective `assets.run_worker_first` pattern support can make this separation possible, but the exact patterns and host-specific security behavior must be verified before use.

### 4. Release and rollback gates

Before production activation, require:

1. Current-main source, all-route, content, metadata, and asset checks pass.
2. Generated-versus-live HTTP behavior is compared for representative and edge-case routes, including Unicode, query strings, redirects, missing paths, status codes, cache/security headers, and 404 behavior.
3. Browser checks cover desktop/mobile layouts, theme persistence, Chinese conversion, navigation, return-to-top, images, and accessibility.
4. Private Editor access remains denied when unauthenticated; authenticated Editor, OAuth, publishing APIs, and noindex/cache behavior remain intact.
5. Search, Ask, Contact, Turnstile, and all legacy routes retain their existing behavior.
6. The expected Worker invocation reduction is measured rather than assumed.
7. A known-good production Worker/configuration revision and an executable rollback procedure are recorded and tested.
8. Production activation receives separate explicit approval after the evidence is reviewed.

## Scope of this planning change

This document records the current implementation findings and safe sequence only. It does not modify `worker.js`, `wrangler.jsonc`, public HTML, deployment workflows, DNS, routes, secrets, or production behavior. No merge or deployment is authorized by this document.
