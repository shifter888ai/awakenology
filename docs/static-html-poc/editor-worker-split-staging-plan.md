# Editor Worker split — isolated staging plan

**Status: design-only. No code, deployment, domain, route, DNS, OAuth application, or secret change is authorized by this plan.**

## 1. Objective

Prove that the private Editor can run on a dedicated Worker while the public site serves generated static assets without invoking the public Worker for ordinary page and asset requests.

The staging proof must use only `workers.dev` preview names. It must not bind `editor.awakenology.space` or any public Awakenology hostname.

## 2. Confirmed Editor asset inventory

The current `main` branch contains these files in `editor/`:

- `editor/index.html`
- `editor/generator.html`
- `editor/html-generator.html`
- `editor/shared-editing-core.js`

The three HTML files reference the other Editor pages and shared script through `/editor/...` paths. The generator also references the pinned Mammoth 1.9.0 and JSZip 3.10.1 browser builds on unpkg.

The separate `github-editor/` directory is a GitHub Pages pilot and is not part of this Cloudflare Editor split.

Before creating the asset bundle, scan the complete HTML and JavaScript dependency graph, including dynamic imports, CSS URLs, images, and fetch targets. The four-file list above is the confirmed top-level inventory, not a claim that no transitive dependencies exist.

## 3. Cloudflare asset mapping

Cloudflare Workers Static Assets now support `assets.base_path`. With an asset directory such as `./dist-editor/` and `base_path: "/editor"`, the root of that directory is exposed under `/editor/`.

This allows the staging Editor bundle to contain only approved Editor assets while preserving the current browser-visible `/editor/...` URLs. The Editor Worker must use `run_worker_first: true` so session authorization executes before any private Editor asset is served.

Illustrative configuration only — do not deploy this snippet as-is:

```jsonc
{
  "name": "awakenology-editor-staging",
  "main": "./editor-worker.js",
  "workers_dev": true,
  "assets": {
    "directory": "./dist-editor/",
    "binding": "ASSETS",
    "base_path": "/editor",
    "run_worker_first": true,
    "not_found_handling": "none"
  }
}
```

The public Worker should have a separate public-only asset directory and should run its script first only for the API and legacy/security paths that still need server logic. All ordinary public HTML, CSS, images, fonts, and other approved files should be asset-first.

The exact `base_path`, trailing-slash, index-file, and missing-file behavior must be verified against the deployed staging Worker before accepting this design.

## 4. Runtime separation requirements

The Editor Worker must own all requests on its eventual hostname, including:

- `/` — authenticated redirect to `/editor/`
- `/robots.txt` — private `Disallow: /` response
- `/auth/github` and `/auth/github/callback` — OAuth only
- `/auth/logout` — session clearing
- `/editor` and `/editor/*` — authenticated assets with `X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: private, no-store`
- `/api/editor/create-draft-pr` and `/api/editor/publish-page` — authenticated APIs

The Editor Worker must return deliberate 404 responses for unrelated public-site endpoints and unknown paths. It must never fall through to a public-site asset bundle.

The public Worker must continue to deny `/editor`, `/editor/*`, and both `/api/editor/*` endpoints on every public hostname. Those denials must be Worker-handled, not dependent on whether a similarly named static file exists.

The public Worker must preserve the existing Contact endpoint and legacy `/ai-search` redirect behavior.

## 5. Authentication and staging safety

Do not copy production OAuth client secrets, GitHub App private keys, session secrets, Turnstile secrets, or other production secrets into a staging configuration.

A staging deployment with no OAuth credentials can verify:
- unauthenticated root redirect behavior;
- unauthenticated Editor asset protection;
- unauthenticated Editor API 401 responses;
- private robots response;
- no-store/noindex headers on protected responses where applicable;
- explicit 404 behavior for unrelated paths;
- asset mapping and absence of public-site files.

It cannot prove a successful GitHub OAuth round trip or authenticated publish operation. Those require a separately registered staging OAuth application and isolated staging credentials, or a separately approved test arrangement. Never test the staging callback against the production OAuth application unless its callback registration and impact have been explicitly reviewed and approved.

## 6. Required staging acceptance tests

### Editor Worker

- `GET /` without a session redirects to the staging login path, not the production Editor hostname.
- `GET /robots.txt` returns `Disallow: /`.
- `GET /editor/`, `/editor/generator.html`, `/editor/html-generator.html`, and `/editor/shared-editing-core.js` are not publicly readable without a valid session.
- `GET /api/editor/create-draft-pr` and `/api/editor/publish-page` without a session return 401.
- `GET /api/contact`, `/ai-search`, and unrelated public routes return deliberate 404 responses.
- Authenticated asset responses carry `X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: private, no-store`.
- Asset bundle manifest contains only approved Editor files and their required static dependencies; no public pages, Worker source, internal docs, tests, or repository tooling.

### Public Worker

- Ordinary homepage, language pages, article pages, CSS, images, and fonts are served from static assets.
- `/api/contact` remains Worker-handled and retains method, origin, Turnstile, validation, and response behavior.
- `/ai-search` and `/ai-search/` retain 301 redirects and preserve query strings.
- `/editor`, `/editor/*`, and both Editor APIs return 404 on all public hosts.
- Missing ordinary public paths preserve the expected 404 status, body, content type, and relevant headers.
- Search and Ask client-side behavior is checked independently; static delivery alone does not prove their backend services work.

### Isolation and rollback

- Both staging Workers use unique `workers.dev` names and have no custom-domain or route entries.
- Inspect the deployed Worker settings and Wrangler configuration to confirm no production hostname is attached.
- Record the exact staging asset manifests and hashes.
- Exercise rollback by redeploying the previous staging versions and repeat the smoke tests.
- Measure public Worker invocations before and after the staging design using comparable request sets. Do not extrapolate production savings from cache-hit rate alone.

## 7. Stop conditions

Stop and do not proceed if:
- a staging configuration references a production hostname, route, or custom domain;
- a private Editor file or secret appears in the public asset bundle;
- an unauthenticated request can retrieve an Editor asset or API result;
- the staging OAuth flow would redirect to or depend on production credentials without approval;
- rollback cannot restore the previous staging behavior;
- any required public Contact, SEO, redirect, or 404 behavior changes unexpectedly.

## 8. Decision gate

The staging proof is accepted only after the above tests and rollback rehearsal pass and the evidence is reviewed. Production domain assignment, DNS, secrets, OAuth registration, deployment, and cutover remain separate decisions requiring explicit approval.
