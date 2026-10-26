# Static HTML migration — Phase 4 release gate (planning only)

Status: **not approved for deployment**. Reference: draft PR #255, validated by manual workflow run [40274257340](https://github.com/shifter888ai/awakenology/actions/runs/40274257340): parity, full inventory and browser parity passed. This validates the PoC's scoped checks, not full Worker replacement.

## Architecture boundary

Retain `worker.js` as request router and dynamic authentication/API boundary. Only public HTML rewriting is a candidate for prebuilding. Preserve `assets.run_worker_first`, asset fallback/404 behavior, editor-host separation, OAuth/session/publishing actions, non-HTML passthrough, redirects, statuses, query and Unicode handling. No change to DNS, Worker deployment, custom domains, private Editor, Word/HTML Generators or AI Search behavior in this planning PR.

## Ordered implementation

1. Create an isolated build artifact from current `main`, without modifying tracked source HTML or replacing the deployed Worker. Refresh pinned source hashes only after reviewing source changes.
2. Produce a route-by-route equivalence report for all public HTML: source-content integrity, DOM/head semantics, metadata, images, status, redirects, missing paths, headers, encoded/Unicode paths, and query-string behavior. Distinguish source-only tests from live observations.
3. Preserve private-host access control and noindex/no-store semantics. Test authentication only in a separately authorized private environment; never put secrets or authenticated responses into public CI artifacts.
4. Measure reproducibility, idempotence, fail-closed behavior and performance with comparable samples. Avoid automatic production crawls; require explicit manual authorization for live parity runs.
5. Rehearse an isolated rollback with a known-good Worker revision and documented exact steps. No production routing switch during rehearsal.

## Release decision

Require Content Integrity Gate, Sitemap route parity, SEO metadata inventory, Worker build, full-inventory parity, browser parity, and separately authorized live parity against the then-current `main`. Review all exceptions and record evidence before seeking human merge/deploy approval. Any unexplained difference blocks release. No automatic merge or deployment. Keep PR #255 draft and unmerged.

## Production request safeguard

Do not add push/PR-triggered live crawling. Reuse recorded evidence where valid, and run a new bounded live check only after source synchronization and explicit approval. This planning PR performs no production requests.
