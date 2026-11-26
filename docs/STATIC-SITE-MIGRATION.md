# Static-Site Migration: Build-Time Shared Chrome

## Objective

Move Awakenology's shared header and footer, plus other safe page-wide HTML transformations, from request-time Worker rewriting into a dependency-free build step. Serve completed HTML and other public static assets directly through Cloudflare whenever possible.

The migration must preserve the current public URLs, page content, visual design, accessibility, multilingual navigation, theme controls, SEO metadata, Search/Ask, Contact submission, and the private editor's authentication.

## Current implementation findings

- `wrangler.jsonc` currently sets `assets.directory` to `.`, binds the assets as `ASSETS`, and sets `run_worker_first: true`.
- Consequently, requests are routed through `worker.js` before static asset handling.
- For public HTML responses, `worker.js` currently uses `HTMLRewriter` to replace the shared `header.site-header` and footer, add shared theme and language controls, add page/body classes, normalize metadata/canonical/OG tags, and make a few legacy navigation adjustments.
- The Worker also contains genuinely dynamic routes, including `POST /api/contact`, editor OAuth/session routes, and authenticated editor publishing APIs.
- The editor is hosted on `editor.awakenology.space`; its routes and assets must remain protected by the Worker. A broad assets-first change without explicit exceptions could bypass authentication.
- Awakenology pages are distributed across many nested language and article directories. Unlike ScienceOfOrigin's current builder, the migration must discover public HTML recursively and preserve each file's existing relative path.
- Some pages have special or minimal source header/footer markup (for example Contact and generated article pages). The builder must handle these deliberately rather than assume every page has identical source markup.

## Target architecture

1. Keep existing source HTML files in their current directories and retain their public URL paths.
2. Add authoritative shared source components under `src/components/`.
3. Add a dependency-free Node.js build script under `scripts/` that generates a complete publishable site into `dist/`.
4. Copy required public assets and static data into `dist/`, while excluding private/editor-only content, build output, tests, and internal drafting areas as appropriate.
5. Point Wrangler's static asset directory at `dist/`.
6. Use Cloudflare Workers static-assets routing so ordinary public files are served without Worker execution, while explicitly keeping dynamic API and private-editor routes on the Worker.
7. Retain only request-dependent behavior in `worker.js`. Do not leave public page chrome or metadata rewriting there once the build output fully replaces those responsibilities.

## Required preservation

- Header: Awakenology circled-A brand mark, language links, active-language indication, Search, Ask and Links actions.
- Footer: Contact, Reddit links, Disclaimer, copyright year and active-page indication.
- Theme: current dark-by-default behavior, light/dark toggle and persistence.
- Chinese language variant control where currently applicable.
- Return-to-top control.
- Existing typography and page-specific styles/content.
- Existing SEO descriptions, canonical URLs, robots directives, Open Graph metadata and homepage structured data.
- Search and Ask pages and their supporting assets/data.
- Contact form submission through `POST /api/contact` and Turnstile/email handling.
- Private editor OAuth, session validation, noindex headers, draft PR/publish APIs and protected static files.
- All current public paths, including encoded multilingual paths.

## Migration phases

### Phase 1 — Audit and migration specification

- Inspect representative root, language TOC, article, Search, Ask, Contact and editor pages.
- Inventory every request-time HTML transformation and dynamic Worker route.
- Confirm the current Wrangler static asset behavior and asset exclusions.
- Define the recursive build scope and explicit protected/dynamic route exceptions.

### Phase 2 — Build-time implementation

- Add shared header/footer templates and a deterministic, dependency-free recursive builder.
- Port page-wide HTML transformations to build time, with explicit handling for exceptional page structures.
- Generate into `dist/` without changing source pages.
- Add build validation for page counts, required chrome, links, metadata and protected paths.

### Phase 3 — Local validation

- Build the complete site and compare representative generated pages with current production output.
- Verify relative links, multilingual paths, assets, Search/Ask, theme behavior and SEO.
- Verify Contact and editor routes remain Worker-handled and protected.
- Run existing relevant audits and add migration-specific checks.

### Phase 4 — Cloudflare preview integration

- Configure Wrangler to publish `dist/`.
- Change static-assets routing only after the route exceptions are verified.
- Confirm deployment settings and test a preview deployment.
- Confirm ordinary HTML/CSS/JS/image requests bypass Worker execution, while API/editor routes still reach the Worker.

### Phase 5 — Production approval

- Review the preview and request behavior.
- Merge/deploy only after explicit approval.
- Keep the previous deployment configuration and source files available for straightforward rollback.

## Safety constraints

- No redesign, article edits, URL changes, or broad content relocation.
- No paid service, framework, or third-party build dependency.
- Do not remove Worker code for Contact, OAuth, editor authorization, or publishing.
- Do not expose editor assets or APIs through static asset routing.
- Do not change production deployment settings until preview validation and explicit approval.
- Prefer small, reviewable commits and preserve a rollback path.

## Phase 1 audit notes

The ScienceOfOrigin implementation is a useful reference for the build mechanics: root-level source pages, shared `src/components/header.html` and `footer.html`, a Node built-ins-only script, and generated output isolated in `dist/`.

Awakenology should adopt that principle, not copy its simpler page-discovery assumptions. Awakenology needs recursive path preservation and a broader port of the current Worker transformations before its static HTML can safely bypass the Worker.
