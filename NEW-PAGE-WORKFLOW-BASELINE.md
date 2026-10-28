# Awakenology New Page Workflow — Confirmed Development Baseline

**Status:** CONFIRMED / FROZEN BASELINE  
**Confirmed:** 2026-10-20  
**Repository:** `shifter888ai/awakenology`  
**Production domain:** https://awakenology.space  
**Acceptance evidence:** PR #171 was merged and the user confirmed that the deployed `New-Article` page looks correct on the live site.

## Purpose

This document freezes the working New Page Generator / Editor process as the accepted development baseline. It records the proven workflow; it does not authorize a redesign, refactor, or unrelated production changes.

## Confirmed end-to-end workflow

1. **Load one Word/DOCX source.** The source may contain the article's English, Japanese, and Traditional Chinese sections in the same file.
2. **Generate one target page.** One input document produces one page per run; it must not silently split a combined multilingual source into three pages.
3. **Preview before publishing.** Render the generated page using the existing Awakenology design, shared navigation/header/footer, responsive behavior, and theme conventions.
4. **Approve & Publish.** Publishing prepares a GitHub change/branch and pull request; it must not bypass the repository review and CI workflow by writing directly to production.
5. **Validate the pull request.** Required repository checks must pass, including:
   - Content Integrity Gate / detection of accidental article-content loss
   - Sitemap route parity
   - SEO metadata inventory
   - Live SEO runtime audit
   - Any other required repository checks
6. **Review and merge.** Merge only the intended page change after the required checks pass and the diff is understood.
7. **Deploy and verify live.** After deployment, open the canonical live route and confirm the intended new article—not stale prior content—is present and renders correctly.

**Short form:** One DOCX → one page → Preview → Approve & Publish → PR + CI → Merge → Deploy → Live verification.

## Confirmed acceptance record

- **PR:** [#171 — Update page: New-Article/index.html](https://github.com/shifter888ai/awakenology/pull/171)
- **Merge commit:** `0b1cec91c8747818fef01bc601f0e0c51ec13d5d`
- **User acceptance:** On 2026-10-20, the user confirmed: “Deployed. New-article looks good on live page.”
- **Test route:** `/New-Article/`
- **Sitemap policy:** `/New-Article/` is a test fixture and must remain excluded from the production sitemap.

## Frozen behavior and guardrails

- Keep the workflow simple and automated; do not add unnecessary steps or require the user to supervise routine mechanics.
- Preserve article text, images, order, links, and intentional formatting. Do not silently rewrite, normalize, or discard source content.
- Keep the generator and editor behavior consistent.
- Preserve the established site template and global components; avoid broad redesigns as part of ordinary article generation.
- A successful CI run is not, by itself, proof of correct live content. The final live-page smoke test remains mandatory.
- Do not modify the frozen workflow, its UI, or its publishing behavior unless the user explicitly requests a change or a confirmed defect requires a narrowly scoped fix.
- Any future change must be proposed as a separate, reviewable change, pass all required checks, and be verified after deployment before it can replace this baseline.

## Scope note

This confirmation locks the demonstrated end-to-end process and its operating rules. It is not a claim that every possible DOCX formatting edge case has been tested. If a future source document exposes a defect, preserve the current baseline and address only that defect with a regression test where practical.

## Final baseline

**The New Page Generator / Editor workflow is accepted as the confirmed development baseline as of 2026-10-20. Keep it stable; no further workflow changes are planned unless explicitly requested.**

## Confirmed DOCX color and theme regression (2026-10-28)

Acceptance evidence: Generator fix PR #293 and existing-page fix PR #294 were merged, deployed, and both confirmed visually OK by the site owner.

- Preserve source DOCX wording, structure, images, and intentional run-level RGB colors. Light mode must retain the original imported colors exactly.
- In Dark mode, improve contrast for imported dark-blue runs only, using the approved readable blue `#83baff` where the Generator identifies those runs. Do not globally recolor blue or override unrelated intentional colors.
- The theme-specific styling must be present in both Generate Preview and the generated/published HTML; switching themes must not mutate source content or permanently replace inline DOCX color values.
- An upstream Generator correction does not retroactively repair published pages. Patch affected existing pages separately and minimally; do not silently regenerate approved content.
- Regression verification must include representative imported dark-blue runs in both themes, preview and generated HTML, and confirm other text/colors remain unchanged. The site owner's live visual acceptance is the final check.
- Keep the Generator/Editor workflow and the existing publishing approval gates unchanged.
