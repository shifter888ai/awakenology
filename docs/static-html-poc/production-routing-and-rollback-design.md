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

### Before activation

Record and retain:

- Known-good production Git commit and Worker version identifier.
- Current production Wrangler configuration and asset binding settings.
- Existing custom-domain/route assignments for every public hostname and the Editor hostname.
- Required Worker secret/binding names (never secret values in logs or documentation).
- Previous public and Editor asset manifests, if any.
- Exact deployment and rollback commands, verified in staging.

### Staged activation

1. Build the public and Editor artifacts independently and deterministically.
2. Deploy both only to isolated Workers.dev staging names with no production custom domains/routes.
3. Run all acceptance tests in Sections 4–6.
4. Exercise rollback in staging and prove that the old Worker/configuration restores the previous behavior.
5. Present test evidence, measured invocation change, and the rollback rehearsal for review.
6. Obtain explicit approval before any production domain/route reassignment or production deployment.

### If production cutover is later approved and fails

1. Stop further rollout immediately.
2. Restore the previous known-good public Worker version/configuration and original domain/route assignments.
3. Restore the previous Editor Worker/domain assignment if it was changed.
4. Confirm all public hostnames resolve to the known-good service.
5. Smoke-test homepage, English/Japanese/Chinese routes, CSS/images, Search, Ask, Contact, legacy redirect/query preservation, public Editor denial, 404, Editor robots, OAuth, logout and authenticated Editor access.
6. Check Worker errors, 429s, Contact submissions and Editor authentication.
7. Keep the migration candidate isolated until the cause is understood; do not retry cutover by weakening gates.

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
