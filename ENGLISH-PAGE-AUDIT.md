# English Page Audit

This checklist is mandatory for every rebuilt English page before it is considered verified.

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

## 5. Duplication Check

- [ ] Check the page source and `worker.js`.
- [ ] No duplicated title or metadata in the article body.
- [ ] No duplicated navigation/footer inside article content or TOC.
- [ ] No page-local implementation of Worker-owned components.
- [ ] No local Return-to-top implementation.
- [ ] No duplicate theme toggle.
- [ ] No duplicate Chinese Simplified/Traditional toggle.
- [ ] Worker-owned components render exactly once.

## 6. Global Components

- [ ] Global navigation: English / 日本語 / 中文 / Search / Ask.
- [ ] Footer order is exactly:
  Contact → Reddit 1 → Reddit 2 → Reddit 3 → Disclaimer → © 2024 Awakenology.org
- [ ] Exactly three Reddit anchors, in the required order.
- [ ] Each Reddit anchor contains exactly one internal image asset.
- [ ] Reddit destinations and aria labels are correct.
- [ ] Disclaimer link is present.
- [ ] Copyright is present.

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

## 10. Live Test

After deployment:

- [ ] Open the live English page.
- [ ] Check desktop appearance.
- [ ] Check mobile appearance.
- [ ] Check dark/light mode.
- [ ] Check Worker floating controls.
- [ ] Check navigation.
- [ ] Check footer.
- [ ] Check images and links.
- [ ] Confirm no visible spacing, duplication, or formatting problems remain.

**Completion standard:** A page is considered verified only when all applicable checks above pass.
