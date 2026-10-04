# Awakenology Website Redesign - The Master

## Governing Principles

1. **Fresh rebuild, not a patch** — Build the new website from scratch. The old WebsiteBuilder design is a content source only, never the design foundation.
2. **Simple is best** — Lightweight, fast, minimal HTML/CSS/JS; no unnecessary frameworks or technology.
3. **Content first** — Content is the primary purpose of every page; avoid unnecessary decoration.
4. **One consistent design system** — Homepage, language TOCs, articles, Search/Ask, Disclaimer, and future pages share one system.
5. **Dark mode is the default** — Dark first; light mode remains available; no light flash; every component works in both modes.
6. **Black / white / gray foundation** — Restrained neutral palette with limited functional color.
7. **System fonts only** — No external fonts. Serif may be used selectively for major headings.
8. **Responsive by default** — Desktop and mobile must work properly.
9. **Consistent navigation** — English / 日本語 / 中文 / Search / Ask, with the active language clear.
10. **Consistent footer** — Contact email icon → Reddit 1 → Reddit 2 → Reddit 3 → Disclaimer, then © 2024 Awakenology.org. The Contact icon links to `mailto:contact@awakenology.org` and is a standardized global footer component, not article content.
11. **Common lightweight article template** — All articles use the approved global structure.
12. **Preserve intentional wording** — Never silently correct unusual English or intentional formatting.
13. **Accessibility and readability** — Maintain readable typography, spacing, contrast, links, and responsive behavior.
14. **Performance first** — Minimal JavaScript and unnecessary assets/dependencies.
15. **Existing functionality survives** — Cloudflare hosting, routes, AI Search/RAG, language navigation, theme switching, Chinese switching, external links, sitemap/robots, and 404 must continue to work.
16. **Do not rebuild the backend / RAG** — Preserve AI Search and related backend functionality; redesign presentation/UI only.
17. **Maintainability** — Prefer simple structures that are easy to understand, update, and reuse.
18. **One controlled change at a time** — Build → commit → deploy → test → approve → next.
19. **Approved components become the baseline** — Once tested and approved, do not alter them without deliberate approval.
20. **Production isolation** — `awakenology.org` remains untouched; `awakenology.space` is the test site.
21. **100% Original Content Match**
    - **Never remove any original content.**
    - Compare every rebuilt page against the original source.
    - Preserve all text, headings, TOCs, metadata, links, images, unusual wording, intentional formatting, spaces, NBSPs, and content-bearing elements.
    - Only design, layout, HTML structure, CSS, and necessary presentation code may change.
    - A page is not complete until the comparison passes 100%.
22. **100% Standard Component Match**
    - Every rebuilt page must contain all required standard site components.
    - They must match the approved global template exactly unless deliberately approved otherwise.
    - This includes header/navigation, theme controls, **↑ Return to top**, footer, Reddit icons, Contact, Disclaimer, copyright, and other approved global components.
    - Content preservation can never substitute for this check.
    - If an approved component is missing, altered, or inconsistent, the page is not complete.
23. **HTML Structure Sanity Check**
    - A rebuilt page must have valid, clean HTML, not merely matching text.
    - Never allow legacy WebsiteBuilder document structures to be accidentally inserted into the new template.
    - Automatically verify:
      - exactly one `<html>`, `<head>`, and `<body>`
      - no `<html>`, `<head>`, or `<body>` nested inside `<main>` or `<article>`
      - no legacy WebsiteBuilder layout wrappers accidentally carried into the redesigned page
      - required opening/closing structure is intact
      - the new page contains only the approved new design structure plus preserved content
    - **Content Match, Standard Component Match, and HTML Structure Sanity are three independent checks.**
    - Passing one check can never substitute for another.
    - **Never trust a successful text comparison alone.**
24. **Formatting Isolation Check**
    - Formatting intended for one content region must never leak into another region.
    - Especially verify italic, bold, underline, link, font, and color inheritance.
    - TOC-specific formatting must remain confined to the TOC.
    - Main article text must retain intended normal formatting unless the original content explicitly specifies otherwise.
    - Automated validation must check DOM structure and formatting boundaries, not merely extracted text.
    - A page is not complete if content is correct but formatting has leaked across structural boundaries.


25. **Language Navigation Isolation Check**
    - The global English / 日本語 / 中文 navigation belongs only in the global header.
    - Never copy or extract legacy WebsiteBuilder language navigation into article or TOC content.
    - Automatically inspect article and TOC regions for the global language-menu labels/links and fail the build if they appear there.
    - This check is independent of Standard Component Match and Formatting Isolation.

26. **Post-Commit Verification**
    - After every page change, do not assume the intended edit reached GitHub.
    - The required sequence is: fetch current file → modify → commit → fetch the committed file again → verify the exact changed markup/content in the committed version.
    - Only after post-commit verification passes may the page be reported as fixed and sent for user visual testing.
    - If the committed file does not contain the intended change, correct it before reporting completion.


27. **Asset Path / Image Integrity Check**
    - Every preserved image, download, and other content-bearing asset must retain its intended target and resolve correctly from the rebuilt page.
    - Relative legacy asset paths must be converted appropriately for the new route structure; never assume a legacy relative path will work unchanged.
    - Automatically inspect every `<img src>` and other asset-bearing URL.
    - Verify that each referenced asset resolves to an existing intended asset; image-tag count alone is not sufficient.
    - A page is not complete if an asset exists in the HTML but is broken because its URL resolves incorrectly.
    - This check is independent of Content Match, Standard Component Match, HTML Structure Sanity, Formatting Isolation, and Language Navigation Isolation.

29. **Global Components / Single Source of Truth / Duplication Check**
    - Before adding, rebuilding, or modifying any global site component, inspect `worker.js` first.
    - The approved global components are:
      1. **Dark/Light floating button** — Worker-owned
      2. **↑ Return-to-top floating button** — Worker-owned
      3. **Chinese 简/繁 floating toggle** — Worker-owned
      4. **Global navigation menu:** English / 日本語 / 中文 / Search / Ask — page-template-owned
      5. **Global footer:** Contact → Reddit 1 → Reddit 2 → Reddit 3 → Disclaimer → © 2024 Awakenology.org — page-template-owned
    - Global component ownership is explicit:
      - **Cloudflare Worker:** global floating/behavioral components: Dark/Light, ↑ Return-to-top, and Chinese 简/繁 switching.
      - **Rebuilt page template:** global structural components: English / 日本語 / 中文 / Search / Ask navigation and the standard footer.
    - A Worker-injected component is considered present and compliant even though it is not physically present in the committed page HTML.
    - Determine whether each component is already injected or controlled globally by the Cloudflare Worker before adding any page-local implementation.
    - Every global component must have **one source of truth**. Never create a second page-local implementation of a component already provided by `worker.js`.
    - Duplication Check must be performed on every rebuilt page before commit, not only when a global component is being modified.
    - The Worker-provided **Dark/Light floating button** is the global theme control and single source of truth. Rebuilt pages must not recreate it with their own button, CSS, JavaScript, or local theme system.
    - The global **↑ Return-to-top floating button** must likewise have one site-wide implementation. Rebuilt pages must not recreate it locally once it is provided by `worker.js`.
    - The Worker-owned **Chinese 简/繁 floating toggle** likewise has one site-wide implementation. Rebuilt pages must not recreate its button, CSS, JavaScript, or local conversion system.
    - The page-template-owned global navigation menu and footer must likewise have one approved implementation and must not be duplicated inside article or TOC content.
    - **Duplication must be explicitly checked.** Validation must verify that each global component has exactly one active/visible instance and that no page-local implementation conflicts with the Worker-provided implementation.
    - Validation must inspect both the rebuilt page source and `worker.js`, because duplicate or conflicting components may not be visible from the page source alone.
    - If a component is intentionally moved between Worker control and page-template control, make that an explicit site-wide design decision rather than an accidental duplicate implementation.
    - This check is independent of Standard Component Match, HTML Structure Sanity, and Content Match.

28. **Reddit Footer Component Structural Integrity Check**
    - The approved footer must contain exactly three Reddit icon anchors, in this order:
      1. `https://www.reddit.com/r/EscapeReincarnation/`
      2. `https://www.reddit.com/r/EscapePrisonPlanet/`
      3. `https://www.reddit.com/user/Lower-Lingonberry-40/`
    - Each Reddit anchor must contain exactly one `<img>`.
    - All three Reddit icon image files must be stored **internally in the Awakenology repository**. New or rebuilt pages must reference internal assets, not external Wikimedia or other third-party image URLs.
    - Each icon must retain its approved color treatment: Reddit 1 orange, Reddit 2 blue, Reddit 3 purple/blue, including visibility in dark mode.
    - Each icon must have the correct `aria-label`.
    - No malformed or nested closing tags are allowed.
    - Validation must inspect actual DOM structure, destinations, image nesting, image sources, and attributes. String-presence checks such as `reddit-three` or `Snoo_black.svg` are not sufficient.
    - A page is not complete if any Reddit footer component is structurally malformed or uses an external image asset.

## Global Article Baseline

### Title
```css
.article-header h1{
  margin:0 0 12px;
  font-family:Georgia,"Times New Roman",serif;
  font-size:clamp(22px,2.5vw,25px);
  font-weight:600;
  line-height:1.15
}
.article strong{font-weight:650}
```

Article title/author/date block is centered.

### Spacing
```css
.article p{margin:0 0 10px;font-size:16px}
.article p.aw-spacer{height:10px;margin:0;padding:0;font-size:0;line-height:0}
```

Whitespace-only original paragraphs must be preserved and handled consistently.

### Return to top
Use a small **floating ↑ button** fixed at the bottom-right corner.

- Same simple visual style as the Dark/Light mode control.
- Appears after the user scrolls down; hidden near the top.
- Clicking it smoothly returns to the top of the page.
- Works in both dark and light modes.
- No text label is displayed.
- This floating button is the approved global replacement for the previous **↑ Return to top** text link.

### Footer
Order:

**Contact → Reddit 1 → Reddit 2 → Reddit 3 → Disclaimer**

Reddit icons:
- Reddit 1: orange
- Reddit 2: blue
- Reddit 3: purple/blue
- All remain visible in dark mode.
- **All three icon image files are internal repository assets. External third-party image URLs must not be used.**

Copyright:

**© 2024 Awakenology.org**

## Hard Rule

> **Never remove any content.**

## Core Direction

> **We are building a new website, not trying to make the old WebsiteBuilder website look better.**

> **A very fast, very simple, dark-first, content-focused Awakenology website with one consistent design system and almost no unnecessary technology.**

## Completion Gate

Every rebuilt page must pass **all four independent gates** before being reported as complete. Global Worker-injected components are validated at runtime/source-injection level rather than being required to appear literally in the committed page HTML:

1. **100% Original Content Match**
2. **100% Standard Component Match**
3. **HTML Structure Sanity Check**
4. **Reddit Footer Component Structural Integrity Check**

Only then should the page be committed for user visual testing.
