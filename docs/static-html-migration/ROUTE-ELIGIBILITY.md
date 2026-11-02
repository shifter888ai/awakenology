# Offline static-route eligibility (no activation)

This diagnostic complements the single-Worker planning in Phase 9. It is not a Worker route table, a deployable manifest, or an authorization to switch any response to static HTML. The JSON config is deliberately locked to `mode: report-only` and has an empty proposed route list. The production Worker, Wrangler configuration, article files and frozen PR #255 are untouched.

The report derives potential candidates from tracked `index.html` sources intersected with the canonical sitemap. It excludes draft `New-Article`, private Editor/Generator, Search/Ask (`ai-search`), API/auth/OAuth, 404 and unclassified routes. It rejects ambiguous, encoded, duplicated or traversal-style proposed routes, missing sitemap sources, noncanonical sitemap entries and missing/symlinked candidate sources. A sitemap entry is **necessary, not sufficient**, for eventual static activation.

The separate, future implementation must use a reviewed explicit allowlist and preserve Worker-first routing, headers, auth, SEO/noindex, content hashes and rollback behavior. Real browser/HTTP parity, physical iOS Safari and separate production approval remain mandatory. Passing this report never activates a route and performs no live production requests.
