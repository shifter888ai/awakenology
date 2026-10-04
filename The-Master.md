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

### Original-to-Rebuilt Content Inventory Gate

Before any rebuilt page is sent for live testing, create an explicit **Original-to-Rebuilt Content Inventory** from the original source and compare it against the rebuilt page.

The inventory must account for every content-bearing element, including:
- text/content blocks
- headings and paragraph titles
- TOCs
- metadata
- links
- **every content image individually, wherever it appears in the original document body**
- image source/path and actual asset
- image position/order relative to all other content-bearing elements
- image/container dimensions and CSS constraints
- content-bearing elements that are siblings of the main text block or appear before/after the main text block
- bold, underline, italic, color, alignment, and other intentional formatting
- intentional whitespace/spacers
- other content-bearing elements embedded inside legacy WebsiteBuilder wrappers

For images specifically:
- Original content-image count must equal rebuilt content-image count.
- Every original content image must have a verified 1:1 rebuilt counterpart.
- Verify the actual asset file/path, position, and applicable original HTML/CSS sizing rules for each image.
- An image must never be classified as a "legacy artifact" merely because its element is inside an old WebsiteBuilder wrapper if it is part of the page's original content.
- **Content scope is the entire original document body, not merely the main text/article container.** Inspect all original body-level and wrapper-contained content-bearing elements before the footer/global components are separated out.
- **A content-bearing image outside the main text block is still a content image.** This includes images placed in a separate WebsiteBuilder picture wrapper before or after the main text block, provided the image is part of the original page content rather than a standardized global header/footer asset.
- Distinguish global template assets from page-specific content assets by inspecting their role, wrapper/context, source, position, and original page structure; do not classify by location alone.
- Any inventory mismatch is a hard failure and must be resolved before user testing.

The inventory is the **page-specific evidence of what was there**; the Audit checklist is the **global verification that it was preserved**.

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


28. **Image Scale / Rendering Preservation Check**
    - For every content image, compare the original HTML **and CSS**, including the image element and its containing element.
    - Preserve intentional per-image and per-container width, height, min-width, max-width, fixed-height, auto-width, alignment, margins, object-fit/object-position, and responsive behavior.
    - If the original uses explicit image-specific or container-specific rules, reproduce those rules explicitly; do not replace them with a generic intrinsic-size or `max-width:100%;height:auto` assumption.
    - Map and verify each content image individually when original images use different sizing rules.
    - Inspect original responsive/breakpoint overrides and preserve their intended behavior.
    - Image-scale verification is mandatory before a page is sent for live testing; visual discovery by the user must not be the first image-scale check.

29. **All Internal Links Validation**
    - Validate every internal link on every rebuilt page against the actual repository path and deployed route.
    - Confirm the target exists and the link points to the correct intended page.
    - This includes header navigation, TOC links, article links, footer links, language links, and other internal links.
    - URL-encoded Japanese/Chinese paths must be decoded and checked against actual repository paths as well as deployed routes.
    - Do not rely on visual inspection alone.

30. **Chinese Default Variant**
    - Traditional Chinese (繁體中文) is the unconditional global default for Chinese pages.
    - Simplified Chinese remains available through the Worker-provided 简/繁 toggle.
    - A saved explicit user preference may be respected after the global Traditional default is established.
    - This rule applies site-wide, not only to the Chinese TOC or Disclaimer page.

31. **Live Rendering Verification**
    - Source/CSS/DOM verification must be completed before user testing.
    - Where rendered-page inspection is available, inspect the rendered page before reporting the page ready for testing.
    - User live testing remains the final rendered check after automated/source verification.
    - Do not report a page as complete based only on text/content comparison.

27. **Asset Path / Image Integrity Check**
    - Every preserved image, download, and other content-bearing asset must retain its intended target and resolve correctly from the rebuilt page.
    - Relative legacy asset paths must be converted appropriately for the new route structure; never assume a legacy relative path will work unchanged.
    - Automatically inspect every `<img src>` and other asset-bearing URL.
    - Verify that each referenced asset resolves to an existing intended asset; image-tag count alone is not sufficient.
    - A page is not complete if an asset exists in the HTML but is broken because its URL resolves incorrectly.
    - This check is independent of Content Match, Standard Component Match, HTML Structure Sanity, Formatting Isolation, and Language Navigation Isolation.


### Title Line Preservation
- When an original page title contains multiple lines with different font sizes, weights, decorations, fonts, spacing, or line heights, each line must be inventoried and preserved individually.
- Promoting the title to the standardized H1/header must not normalize, collapse, or otherwise alter those line-specific properties unless the user explicitly requests that visual change.
- A multi-line original title is one content-bearing title with independently auditable line-level formatting; do not treat it as a single uniform H1 style by assumption.


### Heading / Paragraph Title Alignment Preservation
- Every original content heading/paragraph title must be inventoried individually for horizontal alignment: left, center, right, or justified.
- Preserve the original alignment when rebuilding, even if the element is promoted to a standardized H1/H2/H3 or otherwise restyled.
- Original alignment must be derived from the original HTML/CSS/container behavior, not assumed from the new template.
- Any intentional alignment change must be explicitly requested and audited as a targeted visual change.

### Per-Image Rendering Inventory
- Every page-specific content image must have an individual rendering record in the page inventory.
- The record must include: source asset/path, original source position/order, containing element, container width, image width, min/max-width, height/auto behavior, min/max-height, margins, alignment, object-fit/object-position, and responsive overrides where present.
- Verify the rebuilt image against that individual record before user testing.

### Container vs. Image Rendering
- Audit container alignment and image rendered size as separate properties.
- A centered image does not pass the image-scale audit unless its rendered dimensions also match the original rules.
- Conversely, a correctly sized image does not pass if its container alignment or margins are wrong.

### Generic Image CSS Restriction
- Generic rules such as `width:100%; max-width:100%; height:auto` must not override an original page-specific image rule.
- Page-specific image and container rules take precedence over generic article-image CSS whenever the original source contains explicit sizing or alignment rules.
- Do not introduce a generic image rule that silently changes the rendered scale of an individually audited image.

### Intentional Post-Rebuild Visual Changes
- After a page passes the original-content and rendering audit, a user-requested visual modification may be applied only to the explicitly identified element or property.
- All other audited content, image mappings, title-line properties, layout relationships, and rendering properties must remain unchanged unless separately requested and re-audited.
- Rebuilding or reformatting unrelated parts of the page is not an acceptable side effect of a targeted visual change.


### Heading / Paragraph Title Formatting Preservation
- Every original content heading/paragraph title must be inventoried individually for line breaks, font size, font weight, font family, text decoration (including underline), horizontal alignment, line height, and spacing/margins.
- Preserve these properties when rebuilding, even if the element is promoted to a standardized H1/H2/H3 or otherwise restyled.
- Do not collapse multiple original title lines into a uniform H1 by assumption.
- Original text decoration must be derived from the original HTML/CSS/container behavior, not assumed from the new template.
- Any intentional formatting change must be explicitly requested and audited as a targeted visual change.

### Global Component Content Exclusion
- Standardized global components are not page-specific article content and must not be counted as preserved article content when they are intentionally replaced by the approved global component.
- This includes the global Disclaimer, footer copyright, Contact, global navigation, and other standardized site-wide components.
- If the original page contains legacy copies of these components, they must be explicitly classified during inventory and removed when the approved global component replaces them.
- The rebuilt page must contain exactly one active/visible standardized instance of each approved global component.

### Content Duplication / 1:1 Element Matching
- Every content-bearing element extracted from the original page must be mapped to exactly one rebuilt element unless it is explicitly classified as an obsolete global component being replaced by an approved standardized global component.
- Do not manually add a rebuilt element when an equivalent original content element has already been preserved through extraction or reconstruction.
- The original-to-rebuilt inventory must explicitly check for both missing elements and duplicated elements.
- For small but content-bearing elements such as source credits, attribution lines, author names, dates, separators, and copyright/source blocks, verify the original count and rebuilt count individually.
- A rebuilt page fails the inventory gate if any original content-bearing element appears zero times or more than once without an explicit approved reason.

### Source / Credit Block Audit
- Original source-credit and attribution elements such as `----`, `YWS`, author names, dates, and similar bottom-of-article elements must be inventoried individually and preserved exactly once when they are page-specific content.
- Do not recreate source-credit elements separately after extracting the original article content unless the original inventory shows that they were omitted and need restoration.
- Distinguish page-specific source/credit content from standardized global footer copyright and other global components before reconstruction.

### Content Duplication / 1:1 Element Matching
- Every content-bearing element extracted from the original page must be mapped to exactly one rebuilt element unless it is explicitly classified as an obsolete global component being replaced by an approved standardized global component.
- Do not manually add a rebuilt element when an equivalent original content element has already been preserved through extraction or reconstruction.
- The original-to-rebuilt inventory must explicitly check for both missing elements and duplicated elements.
- For small but content-bearing elements such as source credits, attribution lines, author names, dates, separators, and copyright/source blocks, verify the original count and rebuilt count individually.
- A rebuilt page fails the inventory gate if any original content-bearing element appears zero times or more than once without an explicit approved reason.

### Source / Credit Block Audit
- Original source-credit and attribution elements such as `----`, `YWS`, author names, dates, and similar bottom-of-article elements must be inventoried individually and preserved exactly once when they are page-specific content.
- Do not recreate source-credit elements separately after extracting the original article content unless the original inventory shows that they were omitted and need restoration.
- Distinguish page-specific source/credit content from standardized global footer copyright and other global components before reconstruction.

### Context-Specific Original Style Preservation / Duplicate-Text Context Isolation
- Every content-bearing element must be matched to its original DOM context, structural region, position/order, and role, not by text content alone.
- Identical text appearing in different contexts—such as a TOC, article body, caption, source-credit block, navigation, or footer—must be treated as separate original elements with separate formatting requirements.
- Preserve the original style of each occurrence independently, including bold/strong, italic/emphasis, underline, font size, font family, color, alignment, line height, spacing/margins, and other intentional formatting.
- Never use a global text search/replace or first-match operation to modify formatting when the same text can occur in multiple DOM contexts.
- When patching a duplicate-text element, target the exact DOM context/region and occurrence; verify that the intended occurrence changed and all other occurrences retained their original formatting.
- Any duplicate-text context mismatch is a hard failure before user testing.

### Governing Reconstruction Principle
> **Do not rebuild from assumptions when the original has explicit HTML or CSS. Extract, inventory, map, and reproduce the original content-bearing rendering rules first; only then apply the approved new design or an explicitly requested visual change.**

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

### Duplication Check — Global Component Duplication

- Standardized global components that are already provided by the site (for example Disclaimer, Contact, navigation, or footer content) must not be unnecessarily duplicated inside the article/body.
- Any intentional repetition must be explicitly documented and approved.
- If the site has a dedicated `/Disclaimer/` page and a global footer Disclaimer link, an obsolete in-body Disclaimer block must not remain.

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

### Cross-Page Standard Component Consistency
- Standardized components must be compared against the approved design baseline and already-approved pages in the same language/section before live testing.
- Compare title/H1 sizing, font family, font weight, line height, alignment, spacing, header, footer, navigation, article container, image behavior, and other shared components.
- A page-specific original CSS value must not unintentionally override an approved standardized component.
- Any intentional exception must be explicitly classified and documented; never infer an exception merely because the original page used a different value.
- Cross-page consistency is a separate hard gate from page-specific content preservation.
- On the final committed CSS/DOM, flag every unexplained difference from the approved baseline or representative approved pages as a hard failure.


## Paragraph-Title Formatting Preservation

- Every original paragraph title or title-like content line must be inventoried individually, including titles that remain ordinary paragraph elements rather than being promoted to H1/H2/H3.
- Preserve each original title's formatting state: bold/strong, italic/emphasis, underline, font size, font family, text color, line breaks, alignment, line height, spacing/margins, and other intentional inline or CSS formatting.
- Do not treat preservation of the title text alone as sufficient. A title passes only when its original formatting is also mapped to the rebuilt element.
- If an original paragraph title is bold/strong, the rebuilt title must remain explicitly bold/strong unless an intentional design change is separately requested and audited.
- The formatting inventory must compare the original DOM/CSS against the final rebuilt DOM/CSS for every paragraph title before live testing.
- Any formatting mismatch is a hard failure, even when the text content matches exactly.

## Semantic Element Conversion / Formatting Preservation

When an original content element is converted to a different HTML element, its original visual formatting must be inventoried and reproduced independently. The new semantic element's default or standardized CSS must not override the original font weight, size, decoration, alignment, line height, spacing, or other intentional formatting unless an intentional design change is explicitly approved. Any mismatch introduced by semantic conversion is a hard failure before live testing.
