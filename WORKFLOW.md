# Awakenology Page Rebuild Workflow

This file defines the execution procedure for rebuilding pages in the Awakenology migration. It works together with `The-Master.md` (requirements) and `AUDIT.md` (verification gates).

## Core rule

**No page is sent to the user for live testing until all pre-test gates pass.**

**The original HTML is the authority for the page's actual stylesheet dependencies. Never assume which CSS bundle contains a rule.**

## 1. Select the page

- Use the authoritative page queue.
- Do not follow repository order when the queue specifies a different order.
- Record the exact repository path and canonical URL.

## 2. Fetch the original

- Fetch the current original HTML from GitHub.
- Record its blob SHA.
- Do not rebuild from memory or from an earlier fetched copy.

## 3. Identify the actual CSS dependencies

Read every `<link rel="stylesheet">` in the original HTML.

Fetch **every stylesheet actually linked by that page**, including:
- common/shared bundles
- page-specific bundles
- any additional linked CSS

Do not assume that a bundle used by another page is relevant to this page.

## 4. Build the page inventory before rebuilding

Inventory the entire original document body, distinguishing standardized global components from page-specific content.

Record, as applicable:

- page title and every title/meta line separately
- headings and paragraph titles individually
- exact DOM context/role of each content-bearing element
- text and intentional wording
- links and destinations
- images, including images outside the main article wrapper
- image source/path and actual asset
- image wrapper/container
- original image width, min-width, max-width, height, margins, alignment, display/flex rules, object-fit/object-position, and responsive overrides
- `<br>`, `<hr>`, lists, tables, spacers and other content-bearing structure
- source/credit/author/date blocks
- intentional whitespace or formatting
- inline/nested formatting
- page-specific colors
- obsolete in-body global Disclaimer

## 5. Rebuild

Rebuild the page using the approved site design baseline while preserving the original page-specific content and explicit rendering properties.

Rules:

- Preserve all original content unless it is explicitly classified as an obsolete standardized global component.
- Preserve original title/meta line structure.
- Preserve individual heading/paragraph-title formatting and alignment.
- Preserve every page-specific image individually, using the rules extracted from the CSS files actually linked by the original page.
- Use root-relative asset paths where required by the deployed structure.
- Do not let generic article CSS override explicit original page-specific image or heading rules.
- Remove obsolete in-body Disclaimer content while retaining the approved global footer Disclaimer.
- Preserve intentional wording; do not silently normalize unusual language.

## 6. Pre-test verification

Run the relevant gates in `AUDIT.md` before any user testing.

At minimum verify:

- 100% content mapping
- title/meta line structure
- heading/title formatting
- paragraph-title formatting
- image count and 1:1 image mapping
- image source/path integrity
- exact page-specific image rendering rules
- internal links
- HTML structure
- global-component duplication
- context-specific duplicate-text handling
- dark-mode readability
- standard header/footer
- responsive rules
- no accidental content loss

### Hard stop

If any inventory item or verification gate fails, **do not commit for user testing**. Fix the page and repeat the verification.

## 7. Commit

After all pre-test checks pass:

1. Commit the rebuilt page.
2. Record the commit SHA and content SHA.
3. Do not make unrelated changes in the same commit.

## 8. Post-commit verification

Immediately fetch the committed file from GitHub again.

Verify the actual committed version, not merely the intended local/generated version.

At minimum re-check:

- file exists at the expected path
- expected content is present
- expected CSS/HTML changes are present
- image paths and explicit image rules are present
- no unintended deletion or insertion occurred

Only after this verification is complete may the page be offered for live testing.

## 9. Live test

Provide the user with the exact deployed test URL.

The user's live browser test is the final rendered check.

Do not treat a successful source audit as a substitute for the user's live visual test.

## 10. User-reported correction

If the user reports a visual or functional problem:

1. Inspect the current committed source first.
2. Identify the exact original-to-rebuilt mismatch.
3. Fix only the affected property/element unless a broader issue is demonstrated.
4. Re-fetch and verify the changed file.
5. Only then ask the user to test again.

Do not guess.

## 11. Page approval and progression

When the user confirms the page is correct:

- treat that page as approved baseline for standardized components
- retain its commit history
- move to the next page in the authoritative queue
- repeat this workflow from Step 1

## Separation of responsibilities

- `The-Master.md`: what the rebuilt site must satisfy.
- `AUDIT.md`: what must be verified.
- `WORKFLOW.md`: how the work is executed.
