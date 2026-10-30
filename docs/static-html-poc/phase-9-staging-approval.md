# Phase 9 — isolated staging deployment approval gate

**Status: NOT APPROVED; NO DEPLOYMENT.** This document is a release checklist, not an executable deploy workflow. The static build has passed offline audits; it has not demonstrated real staging HTTP equivalence, authenticated Editor/Generator parity, physical iOS Safari parity, or rollback.

## Proposed scope for a separately approved deployment

- Create only a distinct Worker named `awakenology-static-stage-isolated` on its own workers.dev endpoint, with no custom domains, production routes, DNS modifications, or production traffic.
- Stage only public generated HTML and required public assets. Do not copy production secrets or enable Editor OAuth, sessions, publishing APIs, Word/HTML Generator or any authenticated endpoints.
- Force `X-Robots-Tag: noindex, nofollow, noarchive` on **all** staging responses (including errors and assets where applicable); robots.txt disallows all. Verify this with HTTP probes rather than assuming configuration suffices.
- Review whether public Search/Ask AI can be safely exercised without paid dependencies or secret copying; otherwise mark these as untested blockers, not passes.
- Keep production `worker.js`, `wrangler.jsonc`, deploy workflow and custom domains unchanged.
- Confirm Cloudflare request budget, exact Git commit, package manifest SHA-256, and asset count before staging upload.

## Required evidence after approval, before any cutover

1. Record the stage deployment ID, configuration and commit (no secret values).
2. Compare actual staging responses to the production 13-route baseline with `compare_http_reports.py`; the current baseline includes private Editor routes that staging deliberately must not serve, so classify and document those as intentional isolation differences rather than weakening security checks or claiming blanket equivalence.
3. Verify public route inventory, 404s, Unicode, query strings, canonical URLs, assets, headers, robots/noindex, browser interaction and Search/Ask behavior.
4. Check TC/ST followed by Dark/Light on physical iOS Safari. Chromium viewport checks do not substitute.
5. Rehearse **staging-only** rollback to a recorded previous staging version, then rerun smoke tests and record evidence. Never rehearse rollback against production without separate authorization.
6. Any content, SEO, security, routing, performance or rollback regression blocks production cutover.

## Explicit approval required

Approval of this document or merge of its PR does **not** approve deployment. Ask separately: “Approve deploying the isolated `awakenology-static-stage-isolated` Worker to its workers.dev address, with no production routes/domains or secrets?” Do not execute until answered affirmatively. Production cutover requires another explicit approval after evidence review.
