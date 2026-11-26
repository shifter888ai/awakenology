# Worker HTML Transformation Inventory

This document records the request-time HTML transformations in `worker.js` that must be accounted for before public HTML can bypass the Worker.

## 1. Request routing and dynamic responsibilities

The Worker currently handles:

- Editor host `editor.awakenology.space`:
  - `GET /auth/github` — GitHub OAuth initiation.
  - `GET /auth/github/callback` — OAuth callback and authorized-user check.
  - `POST /auth/logout` — session-cookie clearing.
  - `/editor` and `/editor/*` — session-protected static editor assets.
  - `POST /api/editor/create-draft-pr` — authenticated draft PR creation.
  - `POST /api/editor/publish-page` — authenticated page publishing.
  - `/robots.txt` — editor disallow policy.
- Public host:
  - `POST /api/contact` — Turnstile-verified contact submission and email handling.
  - `/ai-search` and `/ai-search/` — redirect to `/search/`.
  - Explicit denial of editor and editor publishing endpoints.
  - Public asset lookup through `env.ASSETS.fetch()`.

These request-dependent behaviours remain in the Worker. The editor host must continue to require session validation before its static assets are returned.

## 2. HTML-only transformations currently performed after asset lookup

The Worker returns non-HTML responses unchanged. For HTML responses, it currently performs the following operations.

### Shared page chrome

- Replaces `footer` content with the canonical Awakenology footer.
- Adds active-page state for Contact and Disclaimer.
- Includes three Reddit links and the Contact/Disclaimer icon links.
- Inserts the current UTC copyright year.
- Replaces `header.site-header` with the canonical shared header.
- Adds English, Japanese and Chinese navigation with active-language state.
- Adds Search, Ask and Links icon actions with active-route state.
- Adds the monochrome circled-A brand mark, rotated 5 degrees.
- Repairs a legacy `.search-link a[href="/ai-search/"]` navigation block.

### Page classification

The Worker adds body classes based on the decoded request pathname and language/content heuristics:

- `awakenology-toc-page` for the English, Japanese and Chinese TOC pages.
- `awakenology-lang-en`, `awakenology-lang-ja`, or `awakenology-lang-zh` for those TOC pages.
- `awakenology-legacy-dark-page` for a fixed list of legacy pages.
- `awakenology-chinese-page` for Chinese paths, including Chinese-only path detection.

The Chinese-page detection currently examines decoded URL paths and excludes Japanese kana paths. This classification must be computed from each source page's public path during the build.

### Shared theme and utility controls

The Worker injects:

- Shared typography rules for English (Arial), Chinese (Microsoft YaHei), and Japanese (MS PGothic).
- Extensive dark-mode rules for legacy pages and TOC pages.
- Canonical header/footer geometry and responsive styling.
- The floating light/dark theme toggle, defaulting to dark and persisting the choice in localStorage.
- The floating Return-to-Top control.
- Chinese Traditional/Simplified switch styling and a module script that dynamically imports OpenCC when a page is identified as Chinese.
- A script that sets Reddit link titles.

The theme script currently checks for pre-existing theme controls before adding its own. Preserve that compatibility behaviour when moving the script to a shared static asset.

### SEO and document head

The Worker currently:

- Adds route-specific descriptions for a set of English, Japanese and Chinese pages.
- Adds a default description where one is absent only when a route-specific description is configured.
- Preserves a non-empty existing description and fills an empty one from the route map.
- Adds `noindex,follow` to Search, Ask and the legacy AI Search route.
- Normalizes canonical URLs to `https://awakenology.space` plus the encoded decoded path, adding a trailing slash where appropriate.
- Keeps only one canonical link on indexable pages.
- Normalizes Open Graph title, description, image, URL, type and site name; removes duplicate or empty title/description values.
- Adds the default Cosmic Eye Open Graph image when needed.
- Adds the Awakenology WebSite JSON-LD object to the homepage.
- Removes existing icon/apple-touch-icon link elements and inserts the canonical favicon.
- Injects the shared theme styles and scripts into the document head.

The build must use the source file's intended public path, not the local filesystem path, when deriving canonical URLs and route metadata. Percent-encoding must be tested against non-ASCII Japanese and Chinese paths.

## 3. Build-time migration requirements

The builder must:

1. Discover HTML files recursively while preserving their exact relative paths.
2. Exclude internal, test, draft, and editor-only material deliberately; do not publish `Internal/`, `New-Article/`, or `tests/` merely because they contain HTML.
3. Copy public assets, fonts, CSS, JavaScript, gallery files, search data, robots and sitemap resources without losing referenced paths.
4. Produce deterministic output and fail on ambiguous or malformed page structures rather than silently deleting content.
5. Apply path-aware page classification and SEO rules.
6. Avoid duplicating styles, scripts, icons, header/footer or controls when a source page already contains compatible elements.
7. Preserve page-specific content and styles exactly unless a transformation is explicitly listed above.
8. Keep source files untouched; generated output belongs only in `dist/`.

## 4. Important source-page exceptions found during the initial audit

- Root homepage, English TOC and many article pages have their own existing header/footer markup and page-specific styles.
- The Contact page has a minimal header and an empty footer.
- Search and Ask are standalone application-like pages with their own scripts and page layouts.
- Legacy exported pages may have different markup and deeply nested content.
- Article pages may contain nested semantic `header` elements inside articles. The migration must target the global `header.site-header`, not replace every `header` element indiscriminately.
- The site has many nested directories and non-ASCII path names; the ScienceOfOrigin builder's root-only page discovery is insufficient.

## 5. Routing migration safety

The current Wrangler configuration sets:

```json
"assets": {
  "directory": ".",
  "not_found_handling": "404-page",
  "binding": "ASSETS",
  "run_worker_first": true
}
```

Do not change `run_worker_first` until:

- the generated static output has been validated;
- the assets directory and exclusions are correct;
- editor-host authentication and editor asset access have been tested;
- `/api/contact`, editor APIs, OAuth, logout, and `/ai-search` routing have explicit verified handling;
- a preview deployment confirms that public static files are served without invoking the Worker.

The eventual routing configuration should use explicit Worker-first exceptions for dynamic paths and editor protection, with public static assets eligible for assets-first handling. Confirm Cloudflare's current static-assets routing semantics against the deployed configuration before selecting the exact syntax.

## 6. Implementation decision

Do not attempt to port the Worker transformations with broad regular expressions. The current logic relies on element-aware operations and contains nested/legacy HTML. Select a deterministic build-time HTML transformation approach that supports element selection, attribute updates, inner content replacement, and head insertion. Keep any parser dependency build-only; it must not be bundled into the deployed Worker or browser assets.

The migration is not complete until generated pages can be compared against representative current production responses and the differences are understood and approved.
