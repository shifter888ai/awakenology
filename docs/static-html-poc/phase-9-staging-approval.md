# Phase 9 — simple reversible integration plan (no cutover)

**Status: planning only. No staging Worker, no feature activation, no production cutover.** Supersedes the separate staging deployment proposal.

## Architecture

Keep the existing production Worker as the sole router and security boundary. Editor, Generator, OAuth/session, APIs, Search and Ask AI continue on their current paths. Only eligible public HTML responses may eventually use generated static output. Do not modify DNS, custom domains, private routes or the production deployment workflow as part of this planning PR.

## Fail-closed switch design (future implementation, not enabled)

- Explicit default: `runtime` (existing HTMLRewriter output). Never infer static mode from a missing environment variable or asset presence.
- `static` may be enabled only after all required parity checks and separate explicit approval. Limit to an audited allowlist of public HTML routes; no blanket host/path matching.
- Reject invalid mode values and mismatched/missing static manifest or content hashes. Preserve runtime behavior without exposing private content.
- Define and test rollback: set the mode back to `runtime` using the prior known-good Worker release/config, then verify homepage, representative multilingual articles, 404, Search/Ask and private Editor/Generator boundaries. A code flag alone is not proof of an operational rollback.
- Ensure a generated static asset does not accidentally bypass Worker response headers, canonical/noindex rules, routing, auth or API handlers. Check Cloudflare asset binding behavior and request limits.

## Gates before any activation

1. Source and generated digests, all-route inventory, content integrity, metadata and sitemap parity.
2. Actual response/DOM/header parity for eligible public routes; Unicode/query/404/redirect tests; assets and responsive behavior.
3. Physical iOS Safari check, including TC/ST followed by Dark/Light.
4. Explicitly test private Editor/Generator and Search/Ask boundaries. Do not claim that offline HTML checks establish their runtime parity.
5. Document measured performance benefit, known-good Worker revision and exact rollback rehearsal evidence.
6. Request separate approval for production activation; merging this documentation does not grant it.

No separate staging Worker is required by this plan. Offline tests may continue, but any live production experiment or feature activation requires explicit approval.
