# Editor Worker dependency inventory and implementation boundary

**Status:** design and inventory only  
**Branch:** `plan/awakenology-build-time-html-migration`  
**Production impact:** none  
**Deployment authorization:** isolated `workers.dev` staging only, after a separate explicit go-ahead; no production hostname, route, DNS, OAuth, or secret changes.

## 1. Confirmed Editor surface

The Editor currently consists of four top-level files:

- `editor/index.html` — visual HTML editor; loads `/editor/shared-editing-core.js`.
- `editor/generator.html` — Word/DOCX conversion workflow; loads Mammoth 1.9.0 and JSZip 3.10.1 from unpkg, plus `/editor/shared-editing-core.js`.
- `editor/html-generator.html` — HTML-to-site-template and conservative HTML cleanup workflow; self-contained client script.
- `editor/shared-editing-core.js` — shared selection/font-size helper.

The three HTML pages link to one another with absolute `/editor/...` paths. Those paths should remain unchanged in the split. The Editor pages also use inline CSS and JavaScript; the initial scan found no separate local stylesheet or image dependency. This is a first-pass inventory, not a claim that every runtime-generated URL has been exhaustively proven.

## 2. Client-side network dependencies

| Caller | Destination | Purpose |
|---|---|---|
| Visual Editor | `raw.githubusercontent.com/shifter888ai/awakenology/main/<path>` | Read current article baseline |
| Word Generator | `unpkg.com/mammoth@1.9.0` | DOCX-to-HTML conversion |
| Word Generator | `unpkg.com/jszip@3.10.1` | Read DOCX formatting metadata |
| Word Generator | `raw.githubusercontent.com/shifter888ai/awakenology/main/<path>` | Read target page and language templates |
| HTML Generator | `raw.githubusercontent.com/shifter888ai/awakenology/main/<path>` | Read existing target and language templates |
| Visual Editor, Word Generator, HTML Generator | `/api/editor/create-draft-pr` | Submit reviewed page for draft PR creation |

The browser-side raw GitHub reads are public, read-only requests. The publish endpoint is same-origin and must remain protected by the Editor Worker session check. Mammoth and JSZip are third-party CDN dependencies; the split should preserve the current pinned versions rather than silently upgrade or bundle them.

## 3. Worker-side responsibilities

The current `worker.js` has a hard-coded `EDITOR_HOST = "editor.awakenology.space"`. Its Editor route block currently handles:

- `/robots.txt`
- `/auth/github`
- `/auth/github/callback`
- `/auth/logout`
- authenticated `/` redirect to `/editor/`
- authenticated `/editor` and `/editor/*` asset delivery
- authenticated `/api/editor/create-draft-pr`
- authenticated `/api/editor/publish-page`

The Worker uses session signing/verification, GitHub OAuth, GitHub App installation tokens, repository-content reads, branch/commit/tree creation, and pull-request creation. The separate publish-page handler also exists in the Worker and must not be accidentally dropped during extraction, even though the three currently inspected HTML pages submit to create-draft-pr.

The public-host guard currently returns 404 for `/editor`, `/editor/*`, `/api/editor/create-draft-pr`, and `/api/editor/publish-page`. Preserve this deny-by-default behavior on every public hostname.

## 4. Safest implementation shape

Avoid maintaining two independently copied versions of authentication and GitHub publishing logic.

Recommended shape:

1. Extract the Editor-only authentication, GitHub API, draft-PR, publish-page, and route-handler code into a shared module (for example `src/editor-runtime.js`). Keep the implementation behavior unchanged during extraction.
2. Have the existing public `worker.js` import and call that shared module for the existing Editor hostname. The public Worker continues to deny Editor paths on all non-Editor hostnames.
3. Add a dedicated `editor-worker.js` that imports the same shared module and serves only the Editor hostname / isolated staging hostname. It must return deliberate 404s for unrelated paths and must never fall through to public site assets or Contact/AI routes.
4. Replace the hard-coded host constant inside the extracted runtime with a validated environment value (for example `EDITOR_HOST`), with the current production hostname retained as the production default. Callback URLs, redirects, and same-origin checks must all use the same resolved host.
5. Give the dedicated Editor Worker its own Wrangler config and an Editor-only asset directory mounted at `/editor` using `assets.base_path`. Keep the existing browser paths unchanged.
6. Use a unique `workers.dev` name for staging, with no `routes`, `custom_domain`, production secrets, production OAuth credentials, or production GitHub App private key.

This is a shared-code extraction plus a new deployment entry point, not a redesign of the Editor workflows. Keep the first implementation narrow: no UI redesign, dependency upgrades, new publishing features, or production routing changes.

## 5. Staging boundary and what can be tested

Without staging OAuth/session/GitHub App secrets, staging can safely test:

- `/` redirects to the staging OAuth start path (or returns a deliberate configuration response, depending on the selected no-secret behavior).
- `/robots.txt` disallows crawling.
- `/editor` and each known Editor asset path are not publicly readable without a valid session.
- `/api/editor/create-draft-pr` and `/api/editor/publish-page` return 401 when unauthenticated.
- Auth, API, and Editor asset responses carry appropriate noindex/no-store headers where applicable.
- Unrelated paths return 404 and never serve the public Awakenology site.
- The Editor asset bundle contains only the four intended Editor files and no public-site asset tree.
- Public preview hosts continue to return 404 for all Editor and Editor API paths.

A successful OAuth round-trip and a real draft-PR/publish operation cannot be proven without a separately registered staging OAuth application and isolated GitHub App credentials. Do not point staging at the production OAuth callback or copy production secrets into staging.

## 6. Implementation gates

Before any isolated deployment:

- Complete a transitive reference scan, including CSS `url(...)`, dynamically constructed paths, form actions, event-handler fetches, and every Worker route/helper dependency.
- Add unit tests for host resolution, route isolation, authentication gates, noindex/no-store headers, and 404 behavior.
- Add static checks that the Editor Wrangler config has `workers_dev: true` and contains no `routes` or `custom_domain`.
- Verify the deployment workflow names only the dedicated Editor staging Worker and cannot invoke the production Wrangler config.
- Confirm the existing public static preview workflow remains separate and unchanged.

Production hostname assignment, custom-domain attachment, DNS, OAuth registration, production secrets, production deployment, merge, and cutover all remain separate approval gates.
