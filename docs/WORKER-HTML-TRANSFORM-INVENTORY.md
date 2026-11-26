# Worker HTML Transformation Inventory

This inventory supplements the Phase 10 migration plan in PR #521. It records the request-time HTML transformations that must be represented in the generated static pages before public HTML can bypass the Worker.

## Dynamic request responsibilities to retain

The Worker must continue to handle:

- Editor host `editor.awakenology.space`: GitHub OAuth initiation/callback, logout, session validation, protected `/editor/*` assets, and authenticated draft/publish APIs.
- Public `POST /api/contact`: Turnstile verification and Contact email submission.
- Public legacy `/ai-search` and `/ai-search/` redirects to `/search/`.
- Explicit denial of editor and publishing endpoints on public hosts.
- Any missing-path behavior or response handling proven to require the Worker.

No static-assets routing change may bypass editor authentication or expose editor assets.

## HTML-only transformations currently performed after asset lookup

The Worker returns non-HTML responses unchanged. For HTML responses, it currently performs:

### Shared page chrome

- Replaces the global footer with the canonical Awakenology footer.
- Adds active-page state for Contact and Disclaimer.
- Includes three Reddit links, Contact and Disclaimer icon links, and the current UTC copyright year.
- Replaces `header.site-header` with the canonical shared header.
- Adds English, Japanese and Chinese navigation with active-language state.
- Adds Search, Ask and Links icon actions with active-route state.
- Adds the monochrome circled-A brand mark, rotated 5 degrees.
- Repairs the legacy `.search-link a[href="/ai-search/"]` navigation block.

### Page classification

The Worker adds body classes based on the decoded request pathname and language/content heuristics:

- `awakenology-toc-page` for English, Japanese and Chinese TOC pages.
- `awakenology-lang-en`, `awakenology-lang-ja`, or `awakenology-lang-zh` for those TOC pages.
- `awakenology-legacy-dark-page` for a fixed list of legacy pages.
- `awakenology-chinese-page` for Chinese paths, including Chinese-only path detection that excludes Japanese kana paths.

The build must compute these classes from each source page's intended public route.

### Shared theme and utility controls

The Worker injects:

- Shared typography rules for English (Arial), Chinese (Microsoft YaHei), and Japanese (MS PGothic).
- Dark-mode rules for legacy pages and TOC pages.
- Canonical header/footer geometry and responsive styling.
- A floating light/dark toggle, dark by default, with localStorage persistence.
- A floating Return-to-Top control.
- Chinese Traditional/Simplified switch styling and a module script that dynamically imports OpenCC for eligible Chinese pages.
- A script that sets Reddit link titles.

The theme script checks for pre-existing theme controls before adding its own. Preserve this compatibility behaviour.

### SEO and document head

The Worker currently:

- Adds route-specific descriptions for a set of English, Japanese and Chinese pages.
- Fills an empty description from the route map while preserving an existing non-empty description.
- Adds `noindex,follow` to Search, Ask and legacy AI Search routes.
- Normalizes canonical URLs to `https://awakenology.space` plus the encoded decoded path, adding a trailing slash where appropriate.
- Keeps one canonical link on indexable pages.
- Normalizes Open Graph title, description, image, URL, type and site name; removes duplicate or empty title/description values.
- Adds the default Cosmic Eye Open Graph image when needed.
- Adds homepage WebSite JSON-LD.
- Removes existing icon/apple-touch-icon link elements and inserts the canonical favicon.
- Injects shared styles and scripts into the document head.

The builder must derive metadata from the public route, not the filesystem path. Test percent-encoding for Japanese and Chinese routes.

## Source and output requirements

1. Discover HTML recursively and preserve exact relative paths.
2. Exclude private/internal/draft/tooling material deliberately; in particular do not publish `Internal/`, `New-Article/`, `tests/`, `scripts/`, or editor-only files as public pages.
3. Copy public assets, fonts, CSS, JavaScript, gallery files, search data, robots and sitemap resources without losing referenced paths.
4. Fail on ambiguous or malformed page structures rather than silently deleting content.
5. Apply route-aware classification and SEO rules.
6. Avoid duplicate chrome, scripts, styles, controls or icons if compatible elements already exist.
7. Preserve page-specific content and styles exactly unless a transformation is explicitly listed above.
8. Keep source files untouched; generated output belongs only in `dist/`.

## Special page structures

- Root homepage, language TOCs and article pages have varied source header/footer markup and page-specific styles.
- Contact has a minimal header and empty footer.
- Search and Ask are standalone application-like pages with their own scripts and layouts.
- Article pages may contain nested semantic `header` elements; target only the global `header.site-header`.
- The site has many nested directories and non-ASCII path names; root-only page discovery is insufficient.

## Routing safety

Current Wrangler assets configuration has `directory: "."` and `run_worker_first: true`. Do not change it until generated output is validated and the route allowlist is verified.

The eventual routing configuration should use explicit Worker-first exceptions for dynamic and protected paths while allowing public static assets to be served without Worker execution. Confirm current Cloudflare pattern semantics before choosing exact configuration syntax.

## Implementation decision

Do not port the Worker transformations with broad regular expressions. Reuse and revalidate the existing isolated static HTML PoC in `scripts/static_html_poc/` rather than creating a second independent implementation. Its current parser-based transformation and parity checks are experimental; they are not production-ready until revalidated against current main and the complete route inventory.

Any parser dependency must be build-only and must not be bundled into the deployed Worker or browser assets.
