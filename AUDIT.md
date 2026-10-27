# Page Audit

## Content-Integrity Incident Prevention — Mandatory for Every Change

These controls apply to SEO-only edits, footer cleanup, global transformations, and article edits alike. A metadata-only task is not permission to rewrite or normalize article HTML.

- [ ] Before editing HTML, record the target page's current Git revision and extracted article-text length; inspect the exact intended change.
- [ ] Prefer changing only the exact metadata/footer node that is in scope. Never run broad regular-expression replacements across an entire HTML document when the target can be isolated.
- [ ] Review the complete diff, not only the changed line or a character count. Confirm every removed article paragraph is intentional.
- [ ] Run the automated content-integrity gate and all applicable tests before merge.
- [ ] The gate checks both major shrinkage and substantial deleted/replaced text, including partial loss that leaves more than 60% of the old text.
- [ ] Any intentional substantial article-text deletion/rewrite requires explicit human review and the `content-loss-approved` PR label. The label is an exception path, not a routine workaround.
- [ ] After merge/deploy, verify the live page at its canonical route and compare its main article text/sections against the merged source. A successful build is not proof of content preservation.
- [ ] If content loss is detected, stop unrelated SEO/layout work, restore from a verified intact revision, and audit other pages touched by the same transformation before resuming.

The automated gate is a safety net, not a proof of 100% preservation. Human diff review and post-deploy page verification remain mandatory.

This checklist is mandatory for every rebuilt page before it is considered verified.

Use the applicable language-specific section for English, Japanese, or Chinese pages.

## 1. Original Content Match


## Original-to-Rebuilt Content Inventory Gate

Create and complete a page-specific inventory **before user testing**. The inventory must be derived from the original source, original CSS where relevant, and the rebuilt DOM.

### Required inventory categories
- [ ] Text/content blocks
- [ ] Headings and paragraph titles
- [ ] TOCs
- [ ] Metadata
- [ ] Internal and external links
- [ ] **Every content image individually, wherever it appears in the original document body**
- [ ] Image source/path and actual asset
- [ ] Image position/order relative to all other content-bearing elements
- [ ] Image and containing-element dimensions/CSS constraints
- [ ] Content-bearing elements outside the main text/article container, including sibling WebsiteBuilder wrappers before/after the main text block
- [ ] Bold/strong, underline, italic, color, alignment, and other intentional formatting
- [ ] Intentional whitespace/spacers
- [ ] Other content-bearing elements inside legacy WebsiteBuilder wrappers

### Image 1:1 mapping — mandatory
- [ ] Record the original content-image count.
- [ ] Record the rebuilt article/content-image count.
- [ ] Confirm the counts are identical.
- [ ] Map every original content image to exactly one rebuilt image.
- [ ] Verify each mapped image uses the intended asset/path.
- [ ] Verify each mapped image appears in the correct content position/order.
- [ ] Compare each image's original HTML and CSS, including its containing element.
- [ ] Preserve explicit width, height, min/max-width, min/max-height, margins, alignment, object-fit/object-position, and responsive rules where applicable.
- [ ] Do not replace distinct original image rules with a generic max-width:100%;height:auto assumption.
- [ ] Do not classify an image as a legacy artifact merely because it is embedded in an old WebsiteBuilder wrapper if it is content-bearing.
- [ ] **Inventory the entire original document body, not only the main article/text container.**
- [ ] **Content-bearing images outside the main article/text container are included in the inventory and mapped 1:1.**
- [ ] Distinguish page-specific content assets from standardized global header/footer assets by role, wrapper/context, source, and original page structure—not by location alone.
- [ ] Any image inventory mismatch is a hard failure.

### Inventory completion
- [ ] Every original content-bearing element has a rebuilt counterpart or an explicitly documented approved transformation (for example, promotion into the standardized H1/header).
- [ ] No original content-bearing element is unaccounted for.
- [ ] No new article content was invented.
- [ ] Resolve every inventory mismatch before commit/testing.
- [ ] Keep the inventory as the evidence for the page-specific Original Content Match gate; do not rely on visual inspection or text extraction alone.

- [ ] Compare the rebuilt page against the original page.
- [ ] Confirm 100% of original content is preserved.
- [ ] Preserve all text, headings, TOCs, metadata, links, images, unusual wording, intentional formatting, spaces, NBSPs, and content-bearing elements.
- [ ] Paragraph titles that are bold/strong in the original or approved page structure remain bold/strong after rebuilding.
- [ ] Every bold/strong text element in the original content body is preserved in the rebuilt page, except elements intentionally replaced or promoted as standardized global components.
- [ ] Confirm content moved into standardized header metadata has not been accidentally removed from the article body.
- [ ] Confirm no new article content was invented.

## 2. HTML Structure

- [ ] Exactly one `<html>`, `<head>`, and `<body>`.
- [ ] No nested or duplicated document structure.
- [ ] No unapproved or conflicting legacy WebsiteBuilder wrappers or obsolete page-builder markup. Documented, audited wrappers may remain only when explicitly retained, non-conflicting, and not used as a reason to skip content/structure validation.
- [ ] No duplicated header, navigation, article, or footer.
- [ ] Inspect the actual DOM tree to confirm document structure and component nesting, not only extracted text.

## 3. Standard Page Format

- [ ] Header/navigation matches the approved site baseline.
- [ ] Article title uses the approved typography.
- [ ] Metadata placement and styling match the approved baseline.
- [ ] Article typography, headings, lists, margins, and spacing match the approved baseline.
- [ ] Responsive/mobile rules match the approved baseline.
- [ ] Dark/light mode works with the Worker.

## 4. DOM Spacing Audit

Inspect the actual DOM, not only extracted text or CSS.

- [ ] Check title → metadata spacing.
- [ ] Check metadata → first body-content spacing.
- [ ] Check heading → body spacing.
- [ ] Check paragraph/list spacing.
- [ ] Check article → footer spacing.
- [ ] Search for unintended empty or spacer elements:
  - `<p>`
  - `<br>`
  - empty `<div>`
  - legacy spacer elements
- [ ] Confirm no legacy blank paragraphs create unintended visual gaps.
- [ ] Whitespace-only original paragraphs are either preserved intentionally or converted to the approved `.aw-spacer` representation; do not leave arbitrary blank `<p>` elements.
- [ ] Confirm approved `.aw-spacer` elements are used only where they represent original whitespace and do not create unintended gaps.

## 5. Duplication Check

- [ ] Check the page source and `worker.js`.
- [ ] No duplicated title or metadata in the article body.
- [ ] No duplicated navigation/footer inside article content or TOC.
- [ ] No page-local implementation of Worker-owned components.
- [ ] No local Return-to-top implementation.
- [ ] No duplicate theme toggle.
- [ ] No duplicate Chinese Simplified/Traditional toggle.
- [ ] Worker-owned components render exactly once.
- [ ] Perform this duplication check on every rebuilt page before commit, not only when a global component is being modified.

## 6. Global Components

- [ ] Global navigation: English / 日本語 / 中文 / Search / Ask.
- [ ] Global navigation appears only in the header; it is not duplicated inside the article body or TOC.
- [ ] Footer order is exactly:
  Contact email icon → Reddit 1 → Reddit 2 → Reddit 3 → Disclaimer → © 2017–CURRENT_YEAR Awakenology
- [ ] Contact is represented by the standardized email icon, linking to `mailto:contact@awakenology.org`; it is not treated as article content.
- [ ] Exactly three Reddit anchors exist in the footer, in the required order:
  1. https://www.reddit.com/r/EscapeReincarnation/
  2. https://www.reddit.com/r/EscapePrisonPlanet/
  3. https://www.reddit.com/user/Lower-Lingonberry-40/
- [ ] Each Reddit anchor contains exactly one <img>.
- [ ] Each Reddit image uses an internal repository asset; no external Reddit image asset is used.
- [ ] Reddit icon colors match the approved set: orange, blue, and purple/blue.
- [ ] Reddit aria labels match the approved labels.
- [ ] Inspect the actual DOM to verify destinations, anchor/image nesting, image src, and relevant attributes.
- [ ] Disclaimer link is present.
- [ ] Copyright is present.

## Completion Gates

All four gates below are independent and mandatory. Passing one does not compensate for failure of another.

- [ ] Gate A — Original Content Match: all original content and content-bearing elements are preserved.
- [ ] Gate B — Standard Components: all required global/page components are present, correctly owned, and rendered once.
- [ ] Gate C — HTML Structure: document structure and DOM nesting are valid and free of legacy wrappers/duplication.
- [ ] Gate D — Reddit Footer Integrity: the complete Reddit footer structure passes the exact destination, image, asset, color, aria-label, and DOM checks above.

## Formatting Isolation

- [ ] Formatting remains confined to the intended region.
- [ ] Check bold, italic, underline, links, font, color, alignment, spacing, and other inline/block formatting for unintended leakage.
- [ ] Confirm TOC formatting does not leak into the article body.
- [ ] Confirm article formatting does not alter global navigation or footer formatting.
- [ ] Inspect the DOM/classes/styles when visual behavior cannot be explained by extracted text.

## Page Language / Title Consistency Audit

- [ ] Determine the page language from the original source/content and intended route; do not infer it from the filename alone.
- [ ] Verify the original page's language before rebuilding its title/meta block.
- [ ] Confirm `<html lang>`, `<title>`, H1/title block, meta description, and intended page-language navigation are consistent with the page language.
- [ ] For multilingual parallel pages, compare against the correct language source/version rather than assuming a title or metadata block from another language is correct.
- [ ] Confirm the rebuilt title, subtitle, author/date/meta lines use the correct language for the page unless the original explicitly requires a different language.
- [ ] Do not introduce a translated or parallel-language title merely because similar content exists in another language version.
- [ ] Any unexplained mismatch between page language and title/meta language is a hard failure before live testing.

## Language Navigation Isolation

- [ ] Global EN / JP / CN navigation is present only in the global header.
- [ ] Search / Ask controls are not duplicated inside article content or TOC.
- [ ] Language-navigation elements are not accidentally included in article text extraction or TOC content.
- [ ] Page-local language links remain only where they are intentionally part of the original article content.

## 7. Assets and Links

- [ ] Inspect every `<img src>`.
- [ ] Confirm every image resolves.
- [ ] Confirm internal asset paths are correct.
- [ ] Preserve the original display scale/size of every content image, including intentional per-image width, max-width, fixed-height, auto-width, container-size, alignment, and responsive behavior.
- [ ] Compare rebuilt image sizing against the original HTML/CSS, including both the image element and its containing element; do not assume all images use the same scale.
- [ ] If the original uses explicit per-image or per-container sizing (for example fixed height with width:auto, min-width/max-width, or other image-container rules), reproduce that behavior explicitly rather than relying on the image's intrinsic dimensions or a generic `max-width:100%;height:auto` rule.
- [ ] When original CSS contains multiple image-specific rules, map and verify each content image individually; do not collapse distinct original scales into one shared rule.
- [ ] Verify responsive behavior separately where the original CSS changes image/container sizing at mobile or other breakpoints.
- [ ] Confirm article links and external links are preserved.
- [ ] Validate **every internal link** on the rebuilt page against the actual repository/deployed route; confirm the target exists and the link points to the correct intended page.
- [ ] Validate all global/header/footer links, TOC links, article links, language links, and other internal links; do not rely on visual inspection alone.
- [ ] For URL-encoded Japanese/Chinese paths, decode and verify the link against the actual repository path as well as the deployed route.
- [ ] No unintended legacy external assets remain.


## Title Line Preservation Audit
- [ ] If the original title has multiple lines, inventory each line separately.
- [ ] Record each line's original font size, weight, decoration, font, spacing, and line-height where applicable.
- [ ] Confirm promotion to the standardized H1/header did not normalize or alter those line-specific properties unless explicitly requested.
- [ ] Do not treat a multi-line original title as a uniform H1 by assumption.


## Heading / Paragraph Title Alignment Audit
- [ ] For every content heading/paragraph title, compare original vs. rebuilt horizontal alignment: left, center, right, or justified.
- [ ] Verify both the relevant CSS/property and the rendered/container alignment where applicable.
- [ ] Confirm that promotion to a standardized H1/H2/H3 did not silently normalize the original alignment.
- [ ] Any alignment mismatch is a hard failure before user testing unless it is an explicitly requested visual change.

## Per-Image Rendering Inventory Audit
- [ ] Create an individual rendering record for every page-specific content image.
- [ ] Record source asset/path and original source position/order.
- [ ] Record containing element/container and its width, min/max-width, height/auto behavior, min/max-height, margins, and alignment.
- [ ] Record image width, height/auto behavior, object-fit/object-position, and responsive overrides where present.
- [ ] Verify every rebuilt image against its individual rendering record before live testing.

## Container vs. Image Rendering Audit
- [ ] Audit container alignment separately from image rendered dimensions.
- [ ] A centered image does not pass unless its rendered dimensions also match the original rules.
- [ ] A correctly sized image does not pass unless its container alignment and margins also match the original rules.

## Generic Image CSS Restriction
- [ ] Confirm generic rules such as `width:100%; max-width:100%; height:auto` do not override an original page-specific image/container rule.
- [ ] Confirm page-specific image rules take precedence whenever the original source contains explicit sizing or alignment rules.
- [ ] Confirm no generic image rule silently changes the rendered scale of an individually audited image.

## Intentional Post-Rebuild Visual Change Audit
- [ ] If a user requested a targeted visual change after the page passed audit, identify the exact element/property changed.
- [ ] Confirm no unrelated audited content, image mapping, title-line property, layout relationship, or rendering property changed.
- [ ] Re-run the relevant audit after the targeted change and verify the committed file before live testing.


## Heading / Paragraph Title Formatting Preservation Audit
- [ ] For every content heading/paragraph title, inventory original line breaks, font size, weight, font family, text decoration (including underline), alignment, line height, and spacing/margins.
- [ ] Confirm every audited property is preserved after reconstruction or explicit promotion to H1/H2/H3.
- [ ] Confirm no original underlined title has silently become non-underlined.
- [ ] Confirm no multi-line title has been collapsed or normalized into a uniform H1 without an explicit request.
- [ ] Any mismatch is a hard failure before user testing unless explicitly requested.

## Global Component Content Exclusion Audit
- [ ] Classify legacy page-level copies of standardized global components separately from page-specific article content.
- [ ] Confirm obsolete in-body Disclaimer content is removed when replaced by the global Disclaimer link/component.
- [ ] Confirm obsolete page-level copyright is removed when replaced by the standardized global footer copyright.
- [ ] Confirm Contact/navigation/footer content is not duplicated inside article content.
- [ ] Confirm each approved global component has exactly one active/visible instance.

## 8. Worker.js Consistency

- [ ] Inspect `worker.js` before modifying any global component.
- [ ] Confirm Worker injection does not duplicate page components.
- [ ] Confirm page markup does not conflict with Worker behavior.
- [ ] Confirm Worker-owned components remain single-source-of-truth.

## 9. Final Verification

- [ ] Fetch the current file before modification.
- [ ] Make only the controlled change required.
- [ ] Commit the change.
- [ ] Fetch the committed file again.
- [ ] Verify the exact change in the committed file.
- [ ] Re-run this audit after the final change.
- [ ] Only then ask for live-page testing.

## 10. Final Visual Verification

This is a separate final gate after structural/content verification. It checks the rendered design against the approved visual baseline.

- [ ] Overall visual hierarchy and spacing are consistent with the approved design.
- [ ] Header, brand, and navigation have the correct alignment, spacing, typography, and responsive behavior.
- [ ] Article H1/title and metadata are positioned and styled correctly.
- [ ] Article width, line length, font size, line height, and left alignment are readable and consistent.
- [ ] TOC appearance and separation from article content are correct.
- [ ] Heading hierarchy and spacing are visually consistent.
- [ ] Intentional blank-line/spacer formatting renders correctly without accidental large gaps.
- [ ] Images are correctly sized, aligned, and contained within the article layout.
- [ ] Footer structure, spacing, icon sizing, and visual balance match the approved baseline.
- [ ] Dark mode and light mode both render correctly, including text, links, borders, controls, and footer.
- [ ] Mobile/responsive layout is visually correct and does not overflow or collapse unexpectedly.
- [ ] Worker floating controls (theme toggle and Return-to-top) appear once, in the correct position, and remain usable in both themes.
- [ ] No unapproved legacy WebsiteBuilder styling, fonts, wrappers, controls, or visual artifacts remain. Any explicitly retained wrapper exception is documented, audited, and non-conflicting.
- [ ] Where actual rendered-page inspection is available, inspect the rendered page rather than relying only on source/CSS analysis.
- [ ] If rendered-page inspection is not available, complete the code/DOM/CSS visual audit and then require live-page testing as the final rendered check.

## Language-Specific Checks

### English Pages

- [ ] Preserve the original English wording exactly, including intentional unusual wording, spacing, NBSPs, punctuation, links, images, and formatting.
- [ ] English navigation and page-language links are correct.
- [ ] Do not introduce Japanese or Chinese content into the English article body.

### Japanese Pages

- [ ] Preserve the original Japanese wording, punctuation, spacing, line breaks, links, images, and intentional formatting.
- [ ] Japanese navigation and page-language links are correct.
- [ ] Do not introduce English or Chinese content into the Japanese article body.
- [ ] Confirm Japanese characters render correctly on desktop and mobile.

## Global Chinese Default
- [ ] Traditional Chinese (繁體中文) is the global default for Chinese pages.
- [ ] The Worker-provided 简/繁 toggle remains available for switching to Simplified Chinese.
- [ ] A saved explicit user preference may be respected, but the site-wide default is Traditional Chinese.
- [ ] Verify this behavior on Chinese pages, not only the Chinese TOC or Disclaimer.

### Chinese Pages

- [ ] Preserve the original Chinese wording, punctuation, spacing, line breaks, links, images, and intentional formatting.
- [ ] Chinese navigation and page-language links are correct.
- [ ] Confirm the Worker-provided Simplified/Traditional toggle is present and works.
- [ ] Confirm Simplified Chinese displays correctly.
- [ ] Confirm Traditional Chinese conversion displays correctly.
- [ ] Confirm conversion does not alter non-Chinese content, URLs, HTML attributes, or site controls.
- [ ] Confirm the selected Chinese variant persists according to the Worker behavior.
- [ ] Check both Simplified and Traditional views on desktop and mobile.

## Duplication Check — Global Component Duplication
- [ ] Verify that standardized global components already provided by the site (for example Disclaimer, Contact, navigation, or footer content) are not unnecessarily duplicated inside the article/body.
- [ ] Any intentional repetition is explicitly documented and approved.
- [ ] If the site has a dedicated `/Disclaimer/` page and a global footer Disclaimer link, confirm that no obsolete in-body Disclaimer block remains.

## Context-Specific Original Style / Duplicate-Text Context Isolation Audit
- [ ] Identify every repeated content string that occurs in more than one DOM context or structural region.
- [ ] Treat each occurrence as a separate inventory record with its own original formatting requirements.
- [ ] Verify TOC, article, caption, source-credit, navigation, footer, and other regions independently where identical text occurs.
- [ ] Confirm formatting changes target the exact intended DOM occurrence, not merely the first/global text match.
- [ ] Confirm all non-target occurrences retain their original formatting after the change.
- [ ] A duplicate-text occurrence with the wrong formatting in the wrong context is a hard failure before live testing.

## 11. Pre-Test Rendering Gate
- [ ] Complete source, DOM, CSS, asset, link, duplication, and responsive checks before requesting live testing.
- [ ] Where rendered-page inspection is available, inspect the rendered result before reporting the page ready for testing.
- [ ] Do not use user live testing as the first discovery method for structural or image-scale problems.

## 12. Live Test

After deployment:

- [ ] Open the live page.
- [ ] Check desktop appearance.
- [ ] Check mobile appearance.
- [ ] Check dark/light mode.
- [ ] Check Worker floating controls.
- [ ] Check navigation.
- [ ] Check footer.
- [ ] Check images and links.
- [ ] Confirm no visible spacing, duplication, or formatting problems remain.

**Completion standard:** A page is considered verified only when all applicable checks above pass.

## Cross-Page Standard Component Consistency
- [ ] Compare standardized components against the approved design baseline and already-approved pages in the same language/section.
- [ ] Compare title/H1 size, font family, weight, line height, alignment, spacing, and other shared component properties.
- [ ] Confirm no page-specific original CSS value unintentionally overrides a standardized component.
- [ ] Explicit exceptions are documented and re-audited; differences are not treated as intentional by assumption.
- [ ] Treat cross-page consistency as a separate hard gate from page-specific content preservation.
- [ ] Perform this comparison on the final committed CSS/DOM before requesting live testing.


## Paragraph-Title Formatting Gate
- [ ] Inventory every original paragraph title/title-like line individually, including titles that remain ordinary paragraph elements.
- [ ] Record and compare bold/strong, italic/emphasis, underline, font size, font family, color, line breaks, alignment, line height, spacing/margins, and other intentional formatting.
- [ ] Verify each rebuilt paragraph title preserves the original formatting state; text-content matching alone does not pass.
- [ ] Treat any unexplained paragraph-title formatting mismatch as a hard failure before live testing.

## Semantic Element Conversion / Formatting Preservation Audit Gate

For every content element whose HTML element type changes during reconstruction, inventory its original visual formatting and map it to the rebuilt element. Verify the new semantic element's CSS does not override original intentional font weight, size, decoration, alignment, line height, spacing, or other formatting. A formatting mismatch introduced by semantic conversion is a hard failure before live testing.

## Title / Meta Line-Structure Preservation Audit Gate
- [ ] Inventory every original title, subtitle, author/date/meta line, and title-associated block line-by-line.
- [ ] Record explicit <br> elements, paragraph boundaries, blank/whitespace lines, and intentional spacing between lines.
- [ ] Verify the rebuilt DOM preserves the original line boundaries and line order.
- [ ] Do not treat matching extracted text as sufficient when the original contains explicit line breaks or separate line boundaries.
- [ ] Verify merged or collapsed title/meta lines are not introduced by reconstruction unless explicitly approved.
- [ ] Treat any unexplained loss, insertion, merging, or relocation of an original title/meta line break as a hard failure before live testing.


## Heading / Title CSS Property Preservation / Standard CSS Override Prevention Audit Gate
- [ ] For every original content heading/title whose HTML element changes during reconstruction, inventory each original explicit rendering property separately: font size, font weight, font family, line height, horizontal alignment, text decoration, margins/padding/spacing, explicitly specified color, responsive sizing/behavior, and relevant inline/nested formatting.
- [ ] Compare those original properties against the final rebuilt CSS/DOM for each heading/title individually.
- [ ] Check the final CSS cascade/specificity to confirm standardized article/component rules do not silently override or normalize an original explicit heading/title property.
- [ ] Verify responsive rules as well as the default/desktop rules.
- [ ] Confirm every original explicit rendering property is preserved unless its change was explicitly requested and separately audited.
- [ ] Text/content matching or correct semantic-element conversion alone does not pass this gate.
- [ ] Any unexplained loss or override of an original explicit heading/title rendering property is a hard failure before live testing.


## Footer Source Structure / Legacy Footer Isolation Gate
- [ ] Confirm exactly one footer element exists in the committed page source.
- [ ] Confirm the footer uses the approved source structure: .site-footer, .footer-inner, and .footer-links.
- [ ] Check for legacy footer classes or page-specific footer CSS that could override or conflict with the approved structure.
- [ ] If a legacy footer structure can affect rendering, normalize the footer at source level before live testing.
- [ ] Verify the approved Email, three Reddit, and Disclaimer links/icons and © 2017–CURRENT_YEAR Awakenology.
- [ ] Verify explicit text-decoration:none behavior for Email and Disclaimer icons, including hover.
- [ ] Do not treat Worker runtime footer replacement as sufficient when the page source contains a conflicting legacy footer structure or CSS.
- [ ] Re-fetch the committed file and repeat these checks after the update.


## Full Automated Migration & Redesign Pipeline v2 — Verification Gates

The migration system is agent-independent. These gates verify the **result**, regardless of which AI agent performed the work.

### A. Baseline / Inventory Gate
- Complete page and asset inventory exists before transformation.
- Baseline commit/snapshot is recorded.
- Original content is protected and traceable.
- Inventory mismatches are blocking errors.

### B. Full-Run Transformation Gate
- The approved inventory is processed as one automated batch wherever practical.
- No page-by-page confirmation is required for deterministic transformations.
- Any exception is recorded in the migration manifest.

### C. Complete Automated Audit Gate
Run all applicable audits in this file before commit, including content preservation, standard components, HTML structure, formatting isolation, language isolation, image integrity/scale, internal links, and deployment configuration.

### D. Commit Safety Gate
- **PASS** — all blocking checks pass.
- **WARNING** — non-blocking anomaly recorded.
- **ERROR** — blocking failure; stop before commit/deploy.
- **SKIPPED** — only when formally not applicable and the reason is recorded.

### E. Post-Deployment Verification Gate
- Confirm deployment completes successfully.
- Confirm representative routes return correctly.
- Confirm critical global behavior remains functional.
- Confirm canonical domain remains `https://awakenology.space`.

### F. Human Smoke-Test Gate
After automated verification, perform a small final live test covering representative desktop/mobile pages and critical interactions. This is the final safety check, not a substitute for automation.

### G. Minimum Migration Manifest Fields
The machine-readable manifest should record at minimum:
- pipeline version and manifest schema version
- repository and branch
- approved `baseline_commit` and audited source `current_commit`
- generation timestamp
- canonical domain and excluded domains
- page count and asset count
- route inventory and per-route state
- audit results, including pending findings
- warnings/errors/exceptions
- deployment verification
- final migration state

Commit-field semantics:
- `baseline_commit` identifies the approved migration baseline and remains fixed unless a new baseline is deliberately approved.
- `current_commit` identifies the exact repository source commit described by the audit results; it does not need to equal a later manifest-only bookkeeping commit.
- Update `current_commit` only when the recorded source checks have actually been run against that commit. Do not mark unresolved checks as passed.


## SEO Verification

- [ ] Sitemap contains only live canonical routes; no deleted/orphan route remains.
- [ ] Every indexable HTML page has exactly one meaningful `<title>`.
- [ ] Every indexable HTML page has a meaningful meta description unless explicitly classified as non-indexable.
- [ ] Every indexable HTML page has exactly one **absolute** canonical URL on `https://awakenology.space` that matches its actual canonical route; relative canonicals fail.
- [ ] `html lang` is present and matches the page language.
- [ ] `/ai-search/` is explicitly `noindex, follow`.
- [ ] Existing page metadata is not duplicated by Worker injection, and malformed or empty metadata is not counted as valid merely because the tag exists.
- [ ] On indexable pages, `og:title`, `og:description`, and `og:url` are accurate and non-empty; `og:url` is an absolute canonical URL.
- [ ] Any supplied `og:image` is a valid, non-empty absolute image URL. The homepage specifically must have a valid social-sharing image.
- [ ] Homepage Open Graph type and structured data, if present, accurately describe the homepage and are semantically consistent with one another.
- [ ] Open Graph and structured data remain controlled global enhancements; do not rewrite preserved page content or require unnecessary per-page markup.
- [ ] Hreflang is used only for genuine equivalent language URLs; dynamic Simplified Chinese conversion is not treated as a separate hreflang URL.
- [ ] SEO changes do not alter preserved article wording or content.
- [ ] H1/H2 anomalies are reviewed separately from metadata-only SEO changes; no automatic heading normalization is permitted without content/rendering audit.

## Approved Visual Design Baseline Audit

Use this section to verify consistency with the approved design baseline. These checks are separate from original-content preservation and do not authorize unrequested redesign.

### Brand and logo
- [ ] The circled-A mark is monochrome only: near-black in light mode and white in dark mode.
- [ ] The circled-A mark remains approximately 5 degrees clockwise from vertical.
- [ ] The approved logo geometry, proportions, and stroke treatment have not been changed without explicit approval.
- [ ] The existing “Awakenology” wordmark font is unchanged.
- [ ] The mark appears to the left of the wordmark in the homepage and shared article header.
- [ ] The shared brand treatment is consistent across pages and does not create duplicate marks or wordmarks.

### Color and theme
- [ ] Dark background uses the approved near-black baseline (`#0D0F12`) where the global theme applies.
- [ ] Dark-mode violet accents use `#818CF8`; light-mode violet accents use `#6366C9`.
- [ ] The logo remains monochrome and is never violet.
- [ ] Primary and muted text remain readable in both themes; contrast is checked rather than assumed.
- [ ] Links, borders, active states, and hover/focus treatments are consistent across the homepage, TOCs, articles, and shared components.
- [ ] Theme switching does not cause a light flash, unreadable text, invisible controls, or inconsistent component colors.

### Mobile-first layout
- [ ] Inspect the page at an iPhone-sized viewport as well as desktop.
- [ ] No horizontal overflow, clipped content, overlapping controls, or broken navigation is present.
- [ ] Cards remain compact; no unapproved oversized card treatment has been introduced.
- [ ] Spacing, line length, wrapping, tap targets, and floating controls remain usable on mobile.
- [ ] Header, TOC, article, footer, and controls remain visually consistent at supported breakpoints.

### Homepage and shared components
- [ ] The approved “How To Free Your Soul” hero composition is preserved.
- [ ] The CosmicEye-1000-jpg full-width background treatment retains its approved placement and spacing.
- [ ] The shared header and footer match the approved baseline.
- [ ] The homepage Coach lion image is inverted in dark mode and displayed normally in light mode.
- [ ] Theme, return-to-top, and Chinese 简/繁 controls each appear once and remain usable.
- [ ] Footer order and `© 2017–CURRENT_YEAR Awakenology` remain correct.
- [ ] No duplicate separators, duplicated global disclaimer, duplicate brand mark, or page-local copy of a globally owned component has been introduced.

### Change isolation and final rendering
- [ ] A proposed visual change addresses a documented mismatch or an explicit user request.
- [ ] Only the approved component/property changed; unrelated content, images, layout, logo geometry, and behavior remain unchanged.
- [ ] Both dark and light themes were checked after any shared CSS/Worker change.
- [ ] Desktop and iPhone-sized rendering were checked after any shared CSS/Worker change.
- [ ] Source/DOM checks and rendered visual checks are recorded separately; passing one does not substitute for the other.
- [ ] No visual change is marked complete until the committed version has been re-fetched and verified.


## Automated Content-Integrity Gate

The `.github/workflows/content-integrity.yml` workflow compares changed HTML pages in each pull request against the base revision.

- [ ] The workflow passes for changes that preserve existing article content.
- [ ] Any changed page with an existing `<article>` container keeps that container unless its removal is intentional and explicitly reviewed.
- [ ] If a page had at least 500 extracted content characters, the new version must retain at least 60% of that content and at least 250 characters.
- [ ] Content-loss failures are investigated against Git history before editing or reconstructing the page.
- [ ] An intentional large content reduction may bypass the check only with the PR label `content-loss-approved`, applied after human review.
- [ ] A passing automated check is a regression guard, not proof that all original content is present; compare against the original source when migrating or rebuilding a page.
- [ ] Record source-level checks separately from live deployment verification.

The gate is designed to catch accidental body deletion/truncation during global changes (for example, footer normalization). It does not block intentional page additions or deletions, and it skips changed HTML files that do not exist in both revisions.


## Live SEO Runtime Audit (PR #79 onward)

- The GitHub Actions workflow `.github/workflows/live-seo-runtime-audit.yml` must run after pushes to `main`, on its daily schedule, and on manual dispatch.
- Run syntax compilation and parser unit tests before any production requests.
- The live audit checks every sitemap URL plus `/ai-search/` against the deployed site. It validates delivered title/description, canonical, language, robots directives, and core Open Graph tags; it also verifies that `robots.txt` advertises the canonical sitemap and does not block crawling of the noindex utility page.
- Keep `/ai-search/` out of the sitemap while verifying its delivered `noindex,follow` directive separately.
- Store the source metadata inventory and runtime report as workflow artifacts. A source-only warning that is repaired by the Worker is not a live defect; report the two layers separately.
- A green workflow is evidence for the checks it runs, not proof of visual correctness, complete content preservation, image rendering, or every internal/external link. Keep those audit dimensions independently pending until verified.


## Local Link and Asset Integrity Audit

- `scripts/audit_site_integrity.py` inventories internal page links and local asset references across source HTML and CSS, including image `src`/`srcset`, stylesheet and script references, inline styles, and CSS `url(...)`/imports.
- The report `site-integrity-report.csv` records the source file, reference type, original reference, resolved target, and result. External links and non-navigation schemes are intentionally excluded from this local existence check.
- The workflow uploads the report as an artifact. Initially this report is informational rather than merge-blocking so existing legacy issues can be triaged without blocking unrelated changes. After baseline findings are reviewed and repaired, consider enabling strict mode in CI.
- A source file existing does not prove an image or route works in production; live status and browser visual rendering remain separate verification steps.


## Live Link and Asset Availability Audit

- `scripts/audit_live_links_assets.py` probes the unique internal page and asset URLs collected by the local integrity inventory against the production domain.
- The report `live-link-asset-report.csv` records HTTP status, content type, final URL, result, and the source files that reference each resource. Duplicate references are collapsed into one request to reduce load.
- Asset probes use HEAD first and retry with GET where the server disallows HEAD. Page links use GET. Redirects are reported separately from HTTP/request failures.
- The live probe runs as an informational audit and does not change files or block unrelated merges by default. Review failures before enabling strict mode; some legacy routes may intentionally redirect.
- A successful HTTP response does not prove that a browser renders an image correctly, that an anchor fragment exists, or that an external destination works. Those remain separate checks.


## Anchor, Duplicate-ID, and Basic Accessible-Name Audit

- `scripts/audit_anchor_accessibility.py` scans source HTML for internal links whose fragment target is missing, duplicate IDs/named anchors, images with no `alt` attribute, and links/buttons with no detectable accessible name.
- The generated `anchor-accessibility-report.csv` includes source file, finding type, severity, reference, target, and details. Findings are informational at first; legacy markup and false positives must be triaged before strict mode is enabled.
- An explicit empty image `alt=""` is treated as intentional decorative-image markup, not as a missing-alt finding.
- This source audit cannot fully evaluate names created by JavaScript, accessible-name computation, keyboard behavior, or the Worker-transformed live DOM. Browser accessibility checks remain necessary.


## Unified Audit Issue Register

- `scripts/consolidate_audit_reports.py` combines the source SEO, production SEO, local-reference, live-reference, and anchor/accessibility CSVs into `audit-issue-register.csv` and `audit-summary.md`.
- The register normalizes issue categories, assigns provisional severity, groups identical findings, and records a fingerprint plus recommended next action. It explicitly distinguishes source-only metadata warnings from production failures.
- Severity is a triage hint, not an automatic repair instruction. Confirm the live/source behavior and intended route before making edits.
- Missing input reports are listed as coverage gaps. The initial workflow remains informational and must not silently convert heuristic findings into merge-blocking failures.


## Browser-Level Production Smoke Audit

- `scripts/audit_browser_smoke.py` reads the published sitemap and uses Chromium via Playwright to inspect every sitemap route at a desktop viewport plus a bounded representative mobile pass.
- Checks include main-document HTTP errors, missing rendered title/lang, horizontal overflow, failed same-host requests, broken rendered images, JavaScript exceptions, and the global theme toggle on mobile.
- The report `browser-smoke-report.csv` is informational. Console errors may be caused by optional third-party scripts and are retained as low-priority context rather than treated as confirmed defects.
- Representative screenshots are artifacts for visual review, not proof of a full visual regression test. Review screenshot samples on mobile and desktop; dynamic content and browser differences still require human verification.
- The unified audit register must run after all reports have been generated, even if the browser scan fails, so report coverage gaps remain visible.


## Browser Smoke Audit Coverage Improvements

- The mobile sample is selected deterministically across the homepage and detected English, Japanese, and Chinese route groups instead of taking the first alphabetically sorted routes.
- Mobile interaction checks verify that the theme control changes the theme and that the preference survives a reload, and exercise the return-to-top control after scrolling.
- On a detected Chinese route, the audit waits for the variant control to initialize and checks that clicking it changes the document language. This is a heuristic smoke test; it does not validate translation quality.
- Findings are still informational. Browser-only false positives, delayed scripts, and network conditions must be reviewed before treating a finding as a defect.


## Rendered Accessibility and Keyboard Smoke Audit

- The production browser audit checks visible controls and images in the rendered DOM, page language and main landmark count, heading-level jumps, and initial keyboard focus.
- Run `python3 scripts/audit_browser_accessibility.py` after installing Playwright and Chromium.
- Findings are informational heuristics, not a WCAG conformance claim. Review context before editing: decorative images may need `alt=""`, and heading-level skips may be intentional in legacy content.
- Never auto-rewrite article text, headings, image alternatives, or controls based solely on scanner output. Verify each issue in the live page and preserve original content.


## Consolidated Rendered Accessibility Findings

- `browser-accessibility-report.csv` must be included in `audit-issue-register.csv` and the Markdown summary.
- Missing reports are coverage gaps, not evidence of a clean scan.
- Treat scanner output as a lead for human verification. Never auto-generate alt text or rewrite article headings from heuristic findings.


## Audit Consolidator Regression Tests

- Run `python3 -m unittest discover -s tests -p 'test_*.py' -v` whenever report inputs or mapping logic changes.
- Tests must cover expected report coverage, missing-report visibility, preservation of findings, severity normalization, and deduplication counts.
- Do not mark a report as clean when its input artifact is missing.


## Live Redirect Triage

- Production redirects are reviewable warnings, not automatic failures. The consolidated register must retain the original URL, final URL, and number of referencing source files.
- Prefer updating internal references to canonical destinations when verified safe; retain intentional redirects for legacy/external compatibility.
- Distinguish HTTP failures from request/network errors; retry transient errors before making source changes.


## Live URL Resolution Regression Tests

- Test encoded and raw Unicode paths, nested relative references, query preservation, fragment removal, and exclusion of external or non-HTTP references.
- URL quoting must preserve valid existing percent-encoding to avoid turning `%E6...` into `%25E6...` during production probes.


## Live Probe Reliability Gate

- Compile every audit script with `python3 -m py_compile scripts/*.py` before network scans run.
- Preserve valid percent-encoded multilingual paths without double-encoding.
- Keep HTTP failures, request/network errors, redirects, and HTML returned in place of an expected asset as separate result classes.
- A content-type mismatch is a diagnostic signal, not proof of a missing asset; inspect the final URL and response before repair.


## Asset HTML Fallback Triage

- `CONTENT_TYPE_MISMATCH` results must reach the consolidated issue register with the returned content type, URL, and referencing-file count.
- Treat an HTML response for an expected asset as a high-priority review item, not proof of a missing file until the delivered response is inspected.
- Keep the independent audit steps separate in CI so one scanner failure does not suppress the remaining reports; always consolidate and upload available artifacts.


## Audit Execution Continuity

- A completed live-probe future must resolve its matching URL metadata before classification; unexpected future exceptions become `REQUEST_ERROR` rows rather than aborting the whole report.
- An HTTP error from the GET fallback after an unsupported HEAD request retains its HTTP status and is not mislabeled as a network exception.
- Independent audit workflow steps use `if: always()` so one failure does not skip unrelated scanners. The live-reference step runs only when its prerequisite local inventory exists. Consolidation and artifact upload still run after failures.


## Pre-merge Live Audit Verification

- Run the complete read-only live audit on PRs changing audit scripts, tests, the audit workflow, Worker, sitemap, or website HTML/CSS/JS, as well as main pushes, manual dispatch, and the existing schedule.
- Review `audit-summary.md`, `audit-issue-register.csv`, and report coverage in the PR run's uploaded artifact before merging audit changes. A successful unit-test workflow alone does not establish that the production scan ran.
- Live findings are observational and may reflect the currently deployed main branch rather than unmerged PR behavior. Do not mistake PR-time production observations for a deployed preview test.


## Same-page Anchor Integrity

- Source anchor checks must include same-page `#fragment` links as well as links to other pages; valid IDs and named anchors should pass.
- Self-closing images must be included in the source missing-alt inventory.
- Validate these rules with fixture-based tests before treating anchor findings as actionable; compare against the delivered DOM for Worker-generated anchors.


## Private Visual Editor Stable-Baseline Regression Gate

Use this gate whenever the private visual editor, its publishing endpoint, GitHub authentication, Worker integration, or related CI workflow changes.

- [ ] Authorized sign-in is required; no GitHub credential or secret is exposed to client-side code or page content.
- [ ] The editor cannot publish directly to `main`; successful publishing creates a Draft PR only.
- [ ] A valid article path and current source baseline are required before publishing.
- [ ] Publishing detects a changed/stale source baseline and stops rather than overwriting newer article content.
- [ ] The publish action stays disabled until a real reviewed change exists.
- [ ] An unchanged article is rejected server-side; client-side button state is not the only safeguard.
- [ ] Review displays the exact text diff and full-page preview; unrelated page structure and content remain unchanged.
- [ ] Whitespace-only changes are visible in the diff and are not silently discarded or introduced.
- [ ] Test both negative and positive paths: unchanged article cannot create a PR; one intentional article edit can create a Draft PR.
- [ ] The Draft PR runs and passes Content Integrity Gate, Live SEO runtime audit, SEO metadata inventory, Sitemap route parity, and Workers Builds.
- [ ] Inspect the complete PR diff and confirm only the intended file/content changed.
- [ ] After merge, verify the deployment version/source and open the live canonical page to smoke-test the exact change.
- [ ] Record the outcome. Any failed gate blocks merge/deployment until resolved; do not bypass checks to preserve a green status.

Reference end-to-end acceptance test: PR #160 (article whitespace correction), merged after all five checks passed and the live page was confirmed OK by the site owner on 2026-10-18. This is a verified example, not permission to merge future PRs automatically.

### Global copyright runtime verification
- [ ] Worker-delivered footer HTML shows `© 2017–CURRENT_YEAR Awakenology` with the current UTC calendar year, without requiring browser JavaScript.
- [ ] Footer copyright remains identical with JavaScript enabled or disabled across homepage, Search/Ask, TOCs, and articles.


### DOCX-generated article and visual-parity gate (Article 5 regression)
- [ ] Compare article text including whitespace/entities and image tags/attributes against the original source or frozen fixture; independently verify emphasis, colors, headings, spacing, and list structure.
- [ ] Count every original bullet/list item and verify its visible marker, label, order, and content after conversion; flag Wingdings/font-dependent markers and Word conditional-list comments even when text parity passes.
- [ ] Inspect phone-width rendering for bullet/continuation-line alignment, wrapping, overflow, excessive Word indentation, and image placement; inspect desktop as well.
- [ ] Validate title, description, canonical, OG title/description/image against the *current* article, not an earlier page/template.
- [ ] Ensure relevant regression tests are actually discovered and executed in CI logs; a green workflow with an undiscovered test is insufficient.
- [ ] Treat PR live audits as checks of currently deployed production, not proof that unmerged or newly merged changes are live; verify deployment and obtain live-page visual confirmation separately.
- [ ] Preserve Article 5's frozen text/image fixture and its three intentionally repaired bullet glyphs; fixture edits require explicit documented justification.
