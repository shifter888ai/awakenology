# Phase 8 — staging deployment safety preflight (no deployment)

The staging plan is metadata, not a Wrangler config. CI verifies a distinct Worker name, disabled deployment, zero routes/custom domains, no production secrets, no private Editor, non-indexability requirement, and an explicit future approval gate. It does not create a Worker or upload assets. The existing production `wrangler.jsonc`, `worker.js` and deployment workflow are unchanged.

Before any staging deployment, separately review the staging Worker entry, public HTML/assets bundle, isolation of OAuth/session/API endpoints, noindex enforcement, Cloudflare account/request budget, explicit deploy action and rollback commands. A successful preflight alone is not staging equivalence or rollback evidence.
