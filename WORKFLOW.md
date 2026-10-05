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

### 4a. Title/component mapping gate

Before constructing the standard article header, explicitly determine how the original title/meta block maps to the rebuilt page.

Classify each original title-bearing element as exactly one of:

1. **Preserved as the standard component** — the original content is represented by the standard title/meta component and must not also remain elsewhere in the article.
2. **Preserved as page-specific article content** — it remains in the article because it is distinct from the standard page title.
3. **Obsolete/replaced global component** — it is intentionally replaced by an approved global component.

For every original title, subtitle, author/date/meta line, and title-associated block, record:

- exact text
- exact line structure, including explicit `<br>`, paragraph boundaries, and intentional blank lines
- DOM context/role
- font size
- font weight
- font family
- line-height
- alignment
- decoration
- margins/padding/spacing
- color where relevant
- inline/nested formatting
- responsive rules where relevant

**Hard rule: never add a standard title merely because a page has a title in its metadata. First prove that the original title does not already map to that standard component.**

**Hard rule: every original title-bearing element must map to exactly one rebuilt representation unless it is explicitly classified as an obsolete/replaced global component.**

This gate prevents duplicate titles and prevents title-like content from silently inheriting generic article styling.

## 4b. Page Language / Title Consistency Gate

Before constructing or replacing the standard title/meta block, determine the page language from the original source/content and intended route.

- Inspect the original article content and language-specific source/version.
- Do not infer title language from the folder name alone.
- Verify the original `<html lang>`, `<title>`, H1/title block, meta description, and intended language navigation.
- For multilingual parallel pages, explicitly identify the correct language source before copying or reconstructing title/meta content.
- Map the original title/meta lines only after confirming they belong to the current page language.
- If the original source contains a title/meta language mismatch, treat the mismatch as a source issue to resolve from the correct language version rather than blindly preserving it.

**Hard rule: an unexplained mismatch between the page language and its title/meta language is a hard failure before commit/user testing.**

## 5. Image Asset Integrity Gate

This is a mandatory gate because a page can pass source/content checks while still rendering with missing images.

For **every page-specific content image**, verify the complete chain:

**original HTML image element → original wrapper/container → original CSS rule → rebuilt image element → rebuilt asset path → repository asset → deployed URL**

For each image, record and verify:

- original `src`
- decoded/normalized asset path
- whether the original path is relative, root-relative, absolute, or external
- the page canonical URL used as the base for resolving relative URLs
- rebuilt `src`
- exact repository asset path
- exact original rendering rules
- expected deployed asset URL

### Non-negotiable path rule

A page-specific image must **not** use a bare relative path such as:

`gallery/foo.jpg`

when the rebuilt page is at a root-level route such as:

`/some-page/`

unless the deployed structure has been explicitly verified to resolve that relative path to the intended asset.

For Awakenology's rebuilt root-level routes, the default required form for local page assets is:

`/gallery/...`

or

`/gallery_gen/...`

or another verified root-relative asset path.

Do not rely on the browser, Cloudflare, or the current page URL to "probably" resolve a relative asset correctly.

### Repository + deployment verification

Before a page can pass:

1. Confirm every rebuilt local image path maps to an actual repository asset.
2. Confirm the resolved URL is the intended asset URL, not merely a syntactically valid URL.
3. After commit, fetch/check every page-specific image URL against the canonical deployed page route.
4. A missing asset, wrong asset, wrong path base, redirect to the wrong resource, or unresolved image is a **hard failure**.
5. Do not send the page to the user for testing until every page-specific image has passed this chain.

## 6. Rebuild

Rebuild the page using the approved site design baseline while preserving the original page-specific content and explicit rendering properties.

Rules:

- Preserve all original content unless it is explicitly classified as an obsolete standardized global component.
- Preserve original title/meta line structure.
- Preserve individual heading/paragraph-title formatting and alignment.
- Preserve every page-specific image individually, using the rules extracted from the CSS files actually linked by the original page.
- Do not let generic article CSS override explicit original page-specific image or heading rules.
- Remove obsolete in-body Disclaimer content while retaining the approved global footer Disclaimer.
- Preserve intentional wording; do not silently normalize unusual language.
- When converting an original content element to a semantic element, reproduce its original explicit visual properties independently of the new semantic element's default or standard CSS.

## 7. Pre-test verification

Run the relevant gates in `AUDIT.md` before any user testing.

At minimum verify:

- 100% content mapping
- title/meta line structure
- title/component 1:1 mapping and no duplicate title
- heading/title formatting
- paragraph-title formatting
- image count and 1:1 image mapping
- image source/path integrity
- **every page-specific image resolves to the intended repository asset and deployed URL**
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
- title/component mapping is still 1:1
- no duplicate title or duplicated title-associated block was introduced

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


### Footer normalization for legacy pages

Some legacy pages contain a .footer structure and page-specific footer CSS that can conflict with the approved global footer even when Worker runtime injection supplies the correct content. Therefore:

1. Inspect the actual committed footer element and its surrounding CSS before testing.
2. If the page uses a legacy footer structure/class or conflicting footer CSS, normalize the footer source itself to the approved .site-footer / .footer-inner / .footer-links structure.
3. Preserve the approved Email, three Reddit, and Disclaimer links/icons and © 2017 Awakenology.
4. Explicitly prevent underline on Email and Disclaimer icons, including hover.
5. Re-fetch the committed file and verify exactly one footer and the approved structure before asking the user to live-test.
6. Worker runtime replacement must be treated as supplementary; it must not be relied upon to compensate for a structurally conflicting page source.
