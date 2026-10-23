# Shared editing core regression matrix (PR #231)

Status: test specification; browser execution pending. Do not merge on CI alone.

For each case, compare article.textContent before and after, inspect resulting DOM for invalid span > block nesting, and verify unselected formatting remains unchanged.

1. Select middle characters of a single styled span; Default removes size only from selected characters, preserving prefix and suffix.
2. Select entire styled span; Default removes explicit size and leaves text unchanged.
3. Select text across two inline spans; applying a size must not alter unselected characters.
4. Select text across two paragraphs; applying size must not wrap paragraphs in a span.
5. Select a nested font-size span and reset; operation must refuse safely without modifying article.
6. Selection outside article or collapsed selection must refuse without modifying article.
7. Apply arbitrary supported values (10, 12, 16, 24 pt); do not hardcode 14 pt.
8. Repeat apply/reset and inspect for redundant nested spans and text loss.
9. Load a real DOCX with direct run formatting and inherited paragraph/character style formatting; compare source and output.
10. Verify blank paragraphs, alignment, images, lists, tables, links, emphasis, and text-color preservation.

The first eight cases require actual DOM/browser tests. DOCX inheritance is not implemented in this PR. Existing SEO/content CI checks do not substitute for these tests.
