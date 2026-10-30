# Static HTML migration: review-only gate

Status: PROPOSAL ONLY. No production merge or deploy is authorized.

## Validated isolated baseline
- PoC branch: `poc/static-html-build-parity`
- Checked-out commit: `9650521c5c03282a816a5941870c186cb8b9cf12`
- Manual workflow: https://github.com/shifter888ai/awakenology/actions/runs/40989967968
- Results: 10 unit tests; 9 real-page fixtures; 9 live Worker signatures; 122 public source routes; 18 desktop/mobile Chromium comparisons passed.
- Artifacts: `static-html-full-inventory`, `static-html-browser-parity`.
- Screenshot gate is tolerance-based (not pixel-identical). Chromium iPhone-sized viewport is not physical iOS Safari.
- GitHub Actions reports nonblocking Node.js 20 / punycode / url.parse deprecation warnings.

## Required before implementation approval
1. Inspect both JSON reports and screenshot artifact for residual non-gating differences; retain hashes and baseline.
2. Compare existing Worker routing, shared header/footer, runtime search/Ask AI, static assets, language/theme toggles, SEO metadata, and private Editor/Generator behavior with proposed static output. Record each route and feature as retained, replaced, or excluded.
3. Keep original article text, markup, images and styling intact; keep private Editor/Generator out of public crawl inventory. Preserve the agreed HTML Cleaner and default-font behavior.
4. Keep existing Content Integrity Gate, live SEO runtime audit, metadata inventory and sitemap route parity mandatory. Add full source/build inventory and representative live/browser parity. Investigate any failures; never weaken thresholds merely to pass.
5. Verify responsive behavior in real iOS Safari separately, including TC/ST followed by Dark/Light; Chromium emulation alone is insufficient.
6. Document staging-only deployment, asset/cache behavior, rollback to last known-good Worker release, and post-rollback smoke checks. No production cutover in this PR.
7. Obtain explicit final approval after presenting remaining differences and rollback evidence.

## Stop conditions
Any lost/changed article content, broken route, unexpected SEO/canonical/noindex change, Editor/Generator regression, runtime service regression, missing artifact, or failed parity gate blocks migration.

## Scope of this PR
Documentation only. No Worker code, route, configuration, workflow or production deployment changes. The PoC baseline branch remains untouched.
