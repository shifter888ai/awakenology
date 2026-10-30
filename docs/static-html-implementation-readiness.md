# Static HTML implementation readiness — no cutover

This document extends `docs/static-html-migration-review.md`. It authorizes no merge of the PoC into production, route switch, or deployment.

## Current implementation inspected
- `wrangler.jsonc`: Worker entry `./worker.js`, `ASSETS` binding with repository-root asset directory, `run_worker_first: true`, and `404-page` fallback.
- `worker.js`: dedicated `editor.awakenology.space` host with GitHub OAuth/session and authenticated Editor API routes; public responses are fetched from `env.ASSETS` and then processed by `HTMLRewriter`.
- `docs/static-html-migration-review.md`: approved review requirements.
- Isolated PoC commit `9650521c5c03282a816a5941870c186cb8b9cf12`; passing run https://github.com/shifter888ai/awakenology/actions/runs/40989967968.

## Feature disposition / implementation boundaries

| Surface | Current runtime | Proposed disposition | Required proof |
| --- | --- | --- | --- |
| Public article HTML, shared header/footer | ASSETS plus HTMLRewriter | Candidate for prebuilt static HTML only | Content fingerprints, visual/DOM parity, no duplicate shell |
| Public route resolution and 404 | Worker-first ASSETS, 404-page fallback | Preserve semantics | Route inventory, redirects, missing-path behavior |
| SEO canonical, robots, metadata | Runtime HTMLRewriter | Candidate for build-time output | Live SEO audit, metadata inventory, sitemap parity, noindex rules |
| Assets and caching | ASSETS binding | Preserve | Image/link loading and cache behavior on staging |
| Language/theme/return-top controls | Public HTML and injected behavior | Preserve | TC/ST then Dark/Light, desktop/mobile, real Safari |
| Search / Ask AI | Public site/runtime integration | Retain until separately proven equivalent | Search and Ask smoke tests, no paid dependency introduced |
| Private Editor and Generator | Separate editor host, OAuth/session, API routes | Explicitly retain Worker runtime; exclude from public build inventory | Authentication, draft PR and publish smoke tests |
| GitHub App credentials and session secrets | Worker environment | Never copy into static build/artifacts | Configuration and secret exposure review |

## Implementation staging sequence
1. Keep the PoC branch/commit frozen. Compare report JSON and screenshot artifacts and record any non-gating differences.
2. Prepare a new isolated implementation branch. Do not alter `main` or production bindings/domains. Keep `worker.js` as the runtime entry until feature-by-feature replacement is approved.
3. Generate static output in a separate, non-public directory; never overwrite source articles or private Editor/Generator pages.
4. Run existing Content Integrity Gate, live SEO runtime audit, SEO metadata inventory, sitemap route parity, PoC full inventory and browser parity. Check all public routes for source/build parity; keep live/browser coverage explicitly scoped.
5. Test real iOS Safari, particularly TC/ST followed by Dark/Light, plus search, Ask AI, editor OAuth and draft publishing on staging.
6. Stage with separate Worker name/route/bindings and no production custom domains. Check 404, canonical URLs, robots, sitemap, assets and cache behavior. Avoid indexing staging.
7. Record current known-good Worker version and Wrangler configuration; document restore command/procedure and verify rollback on staging. Never include secrets in logs or artifacts.
8. Present measured differences, artifacts and rollback evidence for explicit approval before any production cutover.

## Hard stops
Any article content/markup/image loss; changed SEO/noindex; route, Editor/Generator, Search/Ask regression; absent report; failed check; or rollback uncertainty blocks cutover. Do not relax gates merely to pass.

## Current decision
Documentation and implementation planning only. No production deployment authorized.
