# Phase 6 — isolated staging comparison gate and rollback preparation

This batch adds an **offline** comparison tool. Supply two reports with the same `http_baseline_matrix` structure: the production baseline captured by the existing read-only probe, and a separately collected staging report. It compares route coverage, HTTP status, redirect target path/query, content type, cache and security headers, and robots metadata. Hostname differences are permitted for redirects; unexpected path/query differences fail. Volatile ETag and response-byte samples are deliberately not treated as equivalent. Any missing route or transport error blocks. Do not fabricate a staging report or claim staging equivalence until a real isolated staging endpoint exists.

Example: `python scripts/static_html_poc/compare_http_reports.py production-report.json staging-report.json`

## Rollback rehearsal prerequisites (not yet executed)

1. Record exact production Worker deployment version and repository SHA, Wrangler configuration hash, asset inventory, environment binding names, and known-good live audit results. Never store secret values.
2. Create a separate staging Worker with distinct name and no production custom domain/route. Preserve dynamic Editor/API boundary; avoid any production DNS or traffic change.
3. Capture the staging HTTP report and run the comparison; separately verify real browser interactions, assets, Search/Ask, private Editor/Generator and physical Safari.
4. Rehearse staging rollback to its prior version; record before/after version identifiers and repeat staging probes. A written command alone is not rollback proof.
5. If any gate fails, stop. Production cutover requires a new explicit approval after evidence review. Merging this test-only PR must not deploy static output or alter Worker routing.

Current status: comparator/unit tests only; no staging Worker, deployment, rollback rehearsal or production cutover.
