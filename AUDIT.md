# Page Audit

This checklist is mandatory for every rebuilt page before it is considered verified.

Use the applicable language-specific section for English, Japanese, or Chinese pages.

## 1. Original Content Match

- [ ] Compare the rebuilt page against the original page.
- [ ] Confirm 100% of original content is preserved.
- [ ] Preserve all text, headings, TOCs, metadata, links, images, unusual wording, intentional formatting, spaces, NBSPs, and content-bearing elements.
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
  Contact → Reddit 1 → Reddit 2 → Reddit 3 → Disclaimer → © 2024 Awakenology.org
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
- [ ] Confirm article links and external links are preserved.
- [ ] No unintended legacy external assets remain.

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

### Chinese Pages

- [ ] Preserve the original Chinese wording, punctuation, spacing, line breaks, links, images, and intentional formatting.
- [ ] Chinese navigation and page-language links are correct.
- [ ] Confirm the Worker-provided Simplified/Traditional toggle is present and works.
- [ ] Confirm Simplified Chinese displays correctly.
- [ ] Confirm Traditional Chinese conversion displays correctly.
- [ ] Confirm conversion does not alter non-Chinese content, URLs, HTML attributes, or site controls.
- [ ] Confirm the selected Chinese variant persists according to the Worker behavior.
- [ ] Check both Simplified and Traditional views on desktop and mobile.

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
