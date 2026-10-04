# Page Audit

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
- [ ] No legacy WebsiteBuilder wrappers or obsolete page-builder markup.
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
  Contact email icon → Reddit 1 → Reddit 2 → Reddit 3 → Disclaimer → © 2024 Awakenology.org
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
- [ ] No obvious legacy WebsiteBuilder styling, fonts, wrappers, controls, or visual artifacts remain.
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

## 11. Pre-Test Rendering Gate
- [ ] Complete source, DOM, CSS, asset, link, duplication, and responsive checks before requesting live testing.
- [ ] Where rendered-page inspection is available, inspect the rendered result before reporting the page ready for testing.
- [ ] Do not use user live testing as the first discovery method for structural or image-scale problems.

## 11. Live Test

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
