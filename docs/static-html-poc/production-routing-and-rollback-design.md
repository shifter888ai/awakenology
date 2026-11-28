# Production routing and rollback design

**Status: review-only proposal. No production cutover is authorized.**

This document records the host/path boundary, candidate routing architecture, acceptance tests, and rollback procedure for the build-time HTML migration. It changes no production Worker, Wrangler configuration, route, DNS record, secret, or deployment.

## 1. Current production behavior

The production Worker is both the public HTML transformation layer and the runtime security/API boundary.

- Public requests generally reach `env.ASSETS.fetch(request)`; HTML responses are then transformed by `HTMLRewriter`.
- The public Contact endpoint performs origin/host validation, Turnstile verification, form/file validation, and email submission.
- `/ai-search` and `/ai-search/` redirect to `/search/` while preserving the query string.
- Public `/editor*`, `/api/editor/*`, and publishing API paths are explicitly denied.
- `editor.awakenology.space` has separate host-specific behavior: private robots response, GitHub OAuth, logout, session checks, protected Editor assets, draft/publish APIs, and an authenticated root redirect.
- Editor asset responses receive `X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: private, no-store`.
- The current `wrangler.jsonc` uses the repository root as the asset directory and `run_worker_first: true`. Therefore all requests invoke the Worker before static assets are served.

The static preview is not a substitute for these dynamic responsibilities. It is a content/visual artifact only.

## 2. Host-and-path routing matrix

### Public website hosts

The public website hostnames currently include:

- `awakenology.space`
- `www.awakenology.space`
- `awakenology.org`
- `www.awakenology.org`
- `strengthofconsciousness.org`

| Request | Current behavior | Candidate behavior |
| --- | --- | --- |
| `/`, language TOCs, article routes | Worker fetches assets and transforms HTML | Serve generated HTML directly from the public static asset directory |
| Ordinary CSS, JS, fonts, images, documents | Worker fetches assets | Serve static assets directly |
| `POST /api/contact` | Worker validates origin, Turnstile, payload and sends email | Keep Worker-first; preserve current method/status/error behavior |
| `/ai-search` and `/ai-search/` | 301 to `/search/`, preserving query | Keep Worker-first; verify exact Location and status |
| `/editor` and `/editor/*` | Explicit public-host 404 | Keep explicit Worker denial; never put private Editor files in public assets |
| `/api/editor/*` and publishing API paths | Explicit public-host 404 | Keep explicit Worker denial |
| `/search/` and `/ask/` | Static application pages with noindex metadata; client-side services | Serve static pages directly; separately test their browser-side functionality |
| `/robots.txt`, `/sitemap.xml` | Public SEO resources | Serve static resources; verify host/canonical expectations |
| Missing ordinary public path | Asset fallback/custom 404 behavior | Preserve 404 status, body, content type and headers |
| Unknown API/auth paths | Generally fall through to assets unless explicitly intercepted | Compare current behavior; do not silently broaden or change it |

The current Contact origin allowlist is exact: `awakenology.space`, `www.awakenology.space`, `awakenology.org`, `www.awakenology.org`, and `strengthofconsciousness.org`. Do not add or remove hosts as part of this migration without a separate decision.

### Editor hostname

| Request | Current behavior | Required behavior |
| --- | --- | --- |
| `/robots.txt` | Worker returns `User-agent: * / Disallow: /` | Preserve the host-specific private robots response |
| `/auth/github` (GET) | Starts GitHub OAuth | Worker-only |
| `/auth/github/callback` (GET) | Completes GitHub OAuth | Worker-only |
| `/auth/logout` (POST) | Clears session cookie and redirects to login | Worker-only |
| `/` | Requires a valid session; redirects to `/editor/` | Worker-only |
| `/editor` and `/editor/*` | Requires session; serves private assets with noindex/no-store headers | Worker-only |
| `/api/editor/create-draft-pr` | Requires session; creates reviewed draft PR | Worker-only |
| `/api/editor/publish-page` | Requires session; validates path/content/version and publishes | Worker-only |
| Other paths | Existing host-specific fallthrough behavior | Record and preserve deliberately; do not expose public-site assets by accident |

## 3. Recommended architecture for testing

### Separate public static delivery and Editor runtime boundaries

The preferred candidate is:

1. A public-site Worker/assets deployment whose asset directory contains only the approved generated public site. Public pages and ordinary assets are served directly by the assets layer.
2. A separate Editor Worker deployment bound only to `editor.awakenology.space`. It retains OAuth/session/API logic and serves only the required Editor assets.
3. The public-site Worker retains Worker-first handling for the Contact endpoint, legacy AI Search redirects, and explicit public-host denial paths for Editor/publishing URLs.

This avoids the path-only `run_worker_first` conflict at `/` and `/robots.txt`: the public homepage can be static while the Editor hostname root and robots response remain Worker-controlled.

The Editor deployment must have a deliberate asset directory containing the required Editor pages and supporting files, not an accidental copy of the whole repository. The public deployment must not contain Editor/Generator HTML, source code, credentials, internal documents, or tooling.

### Alternative not preferred

Keeping one Worker attached to both public and Editor hosts while trying to distinguish the same path (especially `/` and `/robots.txt`) through path-only `run_worker_first` patterns does not provide a clean host-specific bypass. A broad Worker-first rule would continue invoking the Worker for the public root; a broad static bypass risks changing Editor host behavior.

Do not adopt this alternative without a separately demonstrated host-aware solution.

### Candidate public Worker-first paths

The initial positive allowlist to validate in an isolated environment should cover:

- `/api/contact`
- `/ai-search` and `/ai-search/*` (including the slash variant)
- `/editor` and `/editor/*`
- `/api/editor/*`

Exact Cloudflare glob syntax, precedence, trailing-slash matching, method handling and custom-domain behavior must be tested against current documentation and a disposable staging deployment before configuration is written. Do not copy these illustrative patterns into production as-is.

For the Editor hostname, the separate Editor Worker should receive all requests for that hostname, preserving the current root, robots, OAuth, logout, asset and API behavior.

## 4. Public asset inventory and isolation

The current repository-root asset directory is not safe to reuse for public asset-first delivery without an explicit audit. The isolated preview builder already excludes private/editor/tooling content, but the production candidate needs an independently verified manifest.

Required checks:

- No `editor/`, `github-editor/`, private Generator pages, `Internal/`, `New-Article/`, `tests/`, `scripts/`, `.github/`, or repository configuration/Worker source enters the public artifact.
- No GitHub App credentials, OAuth secrets, session secrets, Turnstile secrets, or other environment values enter generated files, logs or artifacts.
- Public local asset references resolve.
- Search/Ask application pages and all required data/scripts/assets remain present.
- Public Contact frontend assets remain present, while the submission endpoint remains Worker-only.
- The Editor artifact contains only the required Editor UI files and safe static dependencies.
- The public artifact and Editor artifact have separate file manifests and content hashes.

A static 404 fallback must not accidentally publish a private file or route. Explicitly test requests to `/editor/`, `/editor/generator.html`, `/github-editor/`, `/api/editor/create-draft-pr`, and `/api/editor/publish-page` on every public hostname.

## 5. HTTP and browser acceptance matrix

Capture old-production and candidate responses for:

- Homepage, one English article, one Japanese article, one Traditional Chinese article, and one nested Unicode route.
- Root and trailing-slash variants; percent-encoded and decoded paths.
- Query strings on ordinary pages and on both legacy redirect paths.
- CSS, JS, fonts, images, PDF and other representative static assets.
- Contact endpoint with GET, invalid origin, missing Turnstile token, invalid submission, and a controlled successful test where safe.
- Public Editor/publishing denial paths.
- Editor root, robots, OAuth initiation/callback, logout, unauthenticated Editor page, authenticated Editor page, draft API and publish API.
- Missing page, missing asset, missing nested path and missing API path.

For each, compare:

- HTTP status and status text.
- Exact redirect Location, including query string.
- Content-Type and relevant Content-Length/ETag/Last-Modified behavior.
- Cache-Control, X-Robots-Tag, X-Content-Type-Options, Referrer-Policy and other security headers.
- Response body or stable body fingerprint.
- Canonical URL, robots meta, Open Graph metadata and sitemap consistency.
- Browser console/network errors, image/font loading, navigation, theme persistence, Traditional/Simplified Chinese toggle, Search, Ask and Contact frontend behavior.

Run desktop and mobile browser checks. Test real iOS Safari separately; Chromium mobile emulation is not a substitute.

## 6. Worker invocation measurement

Do not assume the static build reduces Worker invocations. Measure before and after using equivalent windows and comparable traffic.

Record:

- Total requests and Worker invocations.
- Static asset requests served without Worker execution.
- Requests still routed to each Worker-first path.
- Error/429 rates and Contact/Editor service health.
- Cache behavior and response latency where available.

The desired result is a measured reduction in public-site Worker invocations without any increase in route failures, security exposure or dynamic-service regressions.

## 7. Rollback plan

Rollback is three separate operations. Do not confuse restoring a Worker version with restoring hostname assignments, and do not confuse deleting an isolated staging Worker with rolling back production.

### 7.1 Before any activation: create a recovery snapshot

Record and retain in the release record (never record secret values):

- Known-good production Git commit and production Worker version ID.
- Output of the production Worker's version/deployment listing, captured immediately before activation.
- Current production Wrangler configuration, asset directory, asset binding settings, compatibility date, and relevant non-secret variable names.
- Exact custom-domain and route assignments for every public hostname and the Editor hostname, including which Worker owns each hostname.
- Required Worker secret/binding names and the service/resource identifiers they reference. Never copy secret values into Git, issue comments, logs, or this document.
- Previous public and Editor asset manifests, content hashes, and a retained copy of the known-good build artifacts.
- Current behavior evidence for the acceptance matrix in Section 5.
- Exact pinned Wrangler version and the tested commands for the affected Worker names.

A version ID, Git commit, or Wrangler configuration by itself is not a complete recovery snapshot. The hostname-to-Worker mapping and external bindings must also be recorded.

### 7.2 Isolated Editor staging Worker: rollback or remove

The current isolated Editor Worker is:

- Worker name: `awakenology-editor-staging`
- Config: `wrangler.editor.jsonc`
- Workers.dev hostname: `awakenology-editor-staging.shifter888.workers.dev`
- Last known deployed version ID: `f7b80049-a820-4517-a5f7-fa5e67a11c20`

This staging Worker has no production custom domain or route. Its current OAuth configuration is intentionally absent. The version ID above is a recorded deployment checkpoint; confirm it in the live version list before using it as a rollback target.

**Inspect versions (read-only):**

```powershell
npx.cmd --yes wrangler@4.159.0 versions list --name awakenology-editor-staging
```

**Rollback to a previously recorded staging version (changes the staging deployment):**

```powershell
npx.cmd --yes wrangler@4.159.0 rollback <KNOWN_GOOD_VERSION_ID> --name awakenology-editor-staging
```

Only use a version ID confirmed in the version list. After rollback, repeat the Editor staging checks: root/login behavior, private robots response, protected Editor assets, both unauthenticated API responses, unrelated-path 404s, and production-host isolation.

**If the staging Worker is no longer needed, inspect the deletion target first:**

```powershell
npx.cmd --yes wrangler@4.159.0 delete --dry-run --config wrangler.editor.jsonc
```

The dry run must identify only `awakenology-editor-staging`. If it identifies another Worker or the name is unclear, stop. Actual deletion is a separate, explicit action:

```powershell
npx.cmd --yes wrangler@4.159.0 delete --config wrangler.editor.jsonc
```

After deletion, verify that the staging Worker is absent and that all production hostnames still resolve to their pre-existing services. Deletion is cleanup, not a rollback rehearsal, and is not required to keep the staging proof available.

### 7.3 Isolated static preview Worker: restore or remove

The existing static preview uses:

- Worker name: `awakenology-static-preview-521`
- Config: `wrangler.preview.jsonc`
- Workers.dev hostname: `awakenology-static-preview-521.shifter888.workers.dev`
- Static-only asset directory: `dist/`

Inspect its recent versions:

```powershell
npx.cmd --yes wrangler@4.159.0 versions list --name awakenology-static-preview-521
```

If a preview deployment needs to be reverted, select the previously recorded known-good preview version and restore it explicitly:

```powershell
npx.cmd --yes wrangler@4.159.0 rollback <KNOWN_GOOD_PREVIEW_VERSION_ID> --name awakenology-static-preview-521
```

Then repeat the preview smoke tests for the homepage, language route, Unicode article route, CSS, favicon, 404 response and noindex headers. Check the rendered desktop and mobile layouts again.

Cloudflare notes that rollback can take time to propagate, and pages already loaded in a browser may continue requesting assets from the newer version. Keep the required assets compatible across the rollback window and retest after propagation.

Removing this preview Worker, if it is no longer needed, is a separate cleanup decision. Use a dry-run deletion first and confirm that only the preview Worker is targeted. Never use the production `wrangler.jsonc` for staging cleanup.

### 7.4 Staging rollback rehearsal: required sequence

A real rehearsal needs at least two known versions for each staging Worker being tested: a recorded baseline and a later candidate. The current Editor staging deployment is the first recorded checkpoint; it has not yet demonstrated a rollback to an earlier version.

For each isolated staging Worker:

1. Record its currently active version ID and verify the Worker name and Workers.dev hostname.
2. Deploy a new, harmless candidate version to that same staging Worker only, after confirming the configuration has no custom domains or routes.
3. Verify the candidate with the relevant staging smoke tests.
4. Roll back explicitly to the recorded baseline version ID.
5. Wait for propagation, then rerun the same smoke tests and compare results with the baseline evidence.
6. Record both version IDs, command output, timestamps, and test results in the PR.
7. Stop if the baseline cannot be restored or any smoke test regresses.

Do not rehearse by changing production routes, domains, DNS, secrets, or OAuth settings. A staging rollback rehearsal does not authorize a production cutover.

### 7.5 If a future production cutover is separately approved and fails

First identify which production Worker and hostname assignments were actually changed. Stop further rollout and use the recovery snapshot from Section 7.1.

**A. Restore the previous code/asset version for each affected Worker**

For the existing public Worker, use its recorded known-good version ID:

```powershell
npx.cmd --yes wrangler@4.159.0 rollback <KNOWN_GOOD_PUBLIC_WORKER_VERSION_ID> --name awakenology
```

If the Editor Worker or another production Worker was separately changed, restore that Worker to its own recorded known-good version. Never substitute one Worker's version ID for another.

A Wrangler version rollback creates a new deployment using the selected Worker version. It does not restore local Git files. Confirm that the selected version still has compatible bindings and required assets before relying on it.

**B. Restore the original hostname assignments**

If any custom domain or route was reassigned to a new Worker, restore the exact pre-cutover assignment from the recovery snapshot in the Cloudflare dashboard. Verify all public hostnames and the Editor hostname individually. A Worker version rollback alone does not move a hostname back from a different Worker.

Do not change DNS unless the approved cutover actually changed DNS and the recovery snapshot shows the previous value. Prefer restoring the exact previous configuration over making speculative DNS edits.

**C. Verify external resources and configuration**

Confirm that required bindings, secrets, variables, email configuration, and other external resources still exist and are attached to the correct Worker. A code-version rollback does not recreate deleted resources or restore changed external data. Never print or copy secret values during verification.

**D. Verify service recovery**

After Cloudflare propagation, smoke-test:

- Every public hostname: homepage, English/Japanese/Traditional Chinese routes, CSS, JavaScript, images, fonts and representative documents.
- Search and Ask pages and their client-side behavior.
- Contact form validation, Turnstile and a controlled successful submission where safe.
- Both legacy AI Search redirects, including query-string preservation.
- Public-host Editor and publishing denial paths.
- Missing-page and missing-asset 404 behavior.
- Editor robots response, OAuth, logout, authenticated assets, draft PR and publishing workflow.
- Worker errors, 429s, Contact delivery and Editor authentication.

Keep the migration candidate isolated until the incident is understood. Do not retry the cutover by weakening acceptance gates.

### 7.6 Rollback limitations and stop conditions

- Cloudflare Worker rollback changes the active deployment for that Worker; it does not automatically restore a hostname that was reassigned to a different Worker.
- Bindings and connected resources are not generally rewound by a code rollback. Do not delete or mutate resources needed by the known-good version.
- Cloudflare documents that rollback can take time to propagate and that older pages may still request newer assets. Asset compatibility must be considered.
- Only the most recent 100 published Worker versions are available for rollback; preserve the release snapshot and do not assume an old version remains available indefinitely.
- Deleting a staging Worker is irreversible cleanup of that Worker and its associated resources; it is not equivalent to restoring an earlier version.
- If the target Worker, version ID, hostname mapping, or resource state cannot be positively identified, stop and do not execute a rollback or deletion.

Rollback must restore the complete host-to-Worker/asset mapping, not merely revert a source-code commit. A code rollback alone may not restore changed custom-domain assignments or static asset bindings.


## 8. Stop conditions

Any of the following blocks cutover:

- Private Editor/Generator content or secrets appear in public assets.
- Article content, image, route, metadata, canonical or robots behavior changes unexpectedly.
- Search, Ask, Contact, Turnstile, OAuth, session, draft or publishing behavior regresses.
- 404 status/body or redirect/query behavior changes without an approved decision.
- Cache/security headers change unexpectedly.
- Any required artifact or report is missing.
- Real iOS Safari verification is incomplete.
- Worker invocation reduction is not measured.
- Rollback has not been rehearsed successfully.

## 9. Current decision

This is a design proposal for review and isolated testing only. PR #521 remains Draft. No production Worker code, production Wrangler configuration, custom domains, routes, DNS, secrets or production deployment are changed or authorized by this document. A separate explicit approval is required before production cutover.
