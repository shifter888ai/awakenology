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
10. **Consistent footer** — Contact → Reddit 1 → Reddit 2 → Reddit 3 → Disclaimer, then © 2024 Awakenology.org.
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


## Global Article Baseline

### Title
```css
.article-header h1{
  margin:0 0 12px;
  font-family:Georgia,"Times New Roman",serif;
  font-size:clamp(24px,3vw,28px);
  font-weight:400;
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
Exact approved wording:

**↑ Return to top**

Do not replace it with “Return to top” or another variation unless explicitly approved.

### Footer
Order:

**Contact → Reddit 1 → Reddit 2 → Reddit 3 → Disclaimer**

Reddit icons:
- Reddit 1: orange
- Reddit 2: blue
- Reddit 3: purple/blue
- All remain visible in dark mode.

Copyright:

**© 2024 Awakenology.org**

## Hard Rule

> **Never remove any content.**

## Core Direction

> **We are building a new website, not trying to make the old WebsiteBuilder website look better.**

> **A very fast, very simple, dark-first, content-focused Awakenology website with one consistent design system and almost no unnecessary technology.**

## Completion Gate

Every rebuilt page must pass **all three independent gates** before being reported as complete:

1. **100% Original Content Match**
2. **100% Standard Component Match**
3. **HTML Structure Sanity Check**

Only then should the page be committed for user visual testing.
