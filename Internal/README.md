> Repository-only working area. Everything under `Internal/` is excluded from Cloudflare asset deployment by `.assetsignore`.

## Workspace map

- [New-Article test fixture](./New-Article/index.html) — the non-production page used by the Editor and Generator as their default test target.

# Internal

> Working index for research, test cases, and validation. This is a GitHub Markdown document, not a public website navigation page. Keep it out of the English, Chinese, and Japanese website TOCs.

## 1. Knowledge Base

- [Awakenology directionality principles](../docs/awakenology-directionality-principles.md)
- [Unified Awakenology terminology glossary](../Awakenology-Glossary/Terminology.md) — single source of truth; update this file rather than maintaining a separate internal copy.

## 2. Test Pages

- **Format:** use `.md` for internal test pages, working drafts, and review/validation documents.
- **Finalization/publication:** once content is finalized and approved for publication, convert it to `.html`. For a published article, `.html` is the single authoritative source maintained through the Private HTML Editor.
- **No permanent duplicates:** do not keep a Markdown twin for the same finalized/published article. Retire or archive temporary drafts when no longer needed.
- **Existing pages:** apply this rule prospectively; do not bulk-convert or modify existing published HTML articles.
- **Production boundary:** Markdown-to-HTML conversion experiments (including PR #336) remain isolated and must not alter production publishing/deployment until separately validated and explicitly approved.
- **Inventory status:** to be populated after a repository-wide review of existing test and experimental pages.
- For each test page, record its purpose, language, current status, source, expected result, actual result, and validating workflow.
- Keep experimental pages distinct from official articles.

## 3. Mixed-Tendency Cases

Use this section for cases where content mixes hypnosis-oriented and awakening-oriented elements, including surface awakening language that may functionally reinforce hypnosis.

For each case, record:
- Test ID and source link
- Expected classification: hypnosis tendency, awakening tendency, mixed tendency, or insufficient evidence
- Exact text evidence
- Rationale and uncertainty
- Actual result and regression status

## 4. Validation & Results

- Record the validating workflow or test command, run link, result, date, and any unresolved issue.
- Track false positives, false negatives, and uncertain cases.
- Re-run relevant regression tests whenever detection criteria or examples change.

## Detection guardrails

- Evaluate meaning, logic, overall direction, and functional effect—not keywords alone.
- Distinguish describing hypnosis, exposing hypnosis, implementing hypnosis, and using awakening language to reinforce hypnosis.
- Quote the exact source text supporting each conclusion.
- Allow **insufficient evidence**; do not force a binary result.
- Report classification according to the project's definitions, not as scientifically established proof of metaphysical claims.
- Preserve source materials separately from AI-generated interpretations.

## Maintenance

- Update this index when test pages are added, moved, retired, or reclassified.
- Do not add this index to public website navigation or the public sitemap.


## Repository boundary

- Keep engineering infrastructure such as `tests/`, `scripts/`, `docs/`, and `.github/workflows/` in their existing locations.
- `SoC-AssessPoints-Test-Sample-Data/` is an existing public article linked from the language TOCs and included in the sitemap. Despite “Test Sample” in its title, it is published content and must remain outside this internal workspace.
- Create additional `Test-Pages/` or `Test-Data/` subfolders only when there is actual content to put there; do not add empty placeholder folders.
