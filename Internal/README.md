> Repository-only working area. Everything under `Internal/` is excluded from Cloudflare asset deployment by `.assetsignore`.

# Internal workspace

This folder is for general project-internal working material that is not part of the public website and is not specifically part of the AI instruction/reference workspace.

## Workspace map

- [New-Article test fixture](./New-Article/index.html) — non-production page used by the Editor and Generator as their default test target.
- [Cloudflare Contact setup](./Operations/CONTACT-CLOUDFLARE-SETUP.md) — operational setup notes for the Contact page.

## Folder ownership

- `.github/awakenology-ai/` — AI-specific operating instructions, prompts, indexes, and source-backed knowledge references used by AI-assisted work. Keep AI guidance close to the GitHub configuration.
- `Internal/` — general internal working material, private test fixtures, unpublished drafts, operational notes, and project records that are not AI-specific.
- `.github/workflows/` — GitHub Actions workflows; keep them here.
- `tests/`, `scripts/`, and engineering material in `docs/` — keep engineering infrastructure and technical documentation in their existing locations.
- Public, approved Awakenology content remains in its existing public content folders. Do not move published content here merely because its title contains “Test”.

## Reference material

- [AI workspace index](../.github/awakenology-ai/README.md) — AI-specific guidance and knowledge references.
- [Unified Awakenology terminology glossary](../Awakenology-Glossary/Terminology.md) — single source of truth; update this file rather than maintaining a separate internal copy.

## Test Pages

- **Format:** use `.md` for internal test pages, working drafts, and review/validation documents.
- **Finalization/publication:** once content is finalized and approved for publication, convert it to `.html`. For a published article, `.html` is the single authoritative source maintained through the Private HTML Editor.
- **No permanent duplicates:** do not keep a Markdown twin for the same finalized/published article. Retire or archive temporary drafts when no longer needed.
- **Existing pages:** apply this rule prospectively; do not bulk-convert or modify existing published HTML articles.
- **Production boundary:** Markdown-to-HTML conversion experiments (including PR #336) remain isolated and must not alter production publishing/deployment until separately validated and explicitly approved.
- **Inventory status:** to be populated after a repository-wide review of existing test and experimental pages.
- For each test page, record its purpose, language, current status, source, expected result, actual result, and validating workflow.
- Keep experimental pages distinct from official articles.

## Mixed-Tendency Cases

Use this section for cases where content mixes hypnosis-oriented and awakening-oriented elements, including surface awakening language that may functionally reinforce hypnosis.

For each case, record:
- Test ID and source link
- Expected classification: hypnosis tendency, awakening tendency, mixed tendency, or insufficient evidence
- Exact text evidence
- Rationale and uncertainty
- Actual result and regression status

## Validation & Results

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

- Update this index when internal test pages, operational notes, or working documents are added, moved, retired, or reclassified.
- Do not add this index to public website navigation or the public sitemap.
- Create additional subfolders only when there is actual content to put there; do not add empty placeholder folders.

## Public-content exception

`SoC-AssessPoints-Test-Sample-Data/` is an existing public article linked from the language TOCs and included in the sitemap. Despite “Test Sample” in its title, it is published content and must remain outside this internal workspace.
