# Rules-Consistency Reconciliation — 2026-10-22

## Purpose and scope

This document records the outcome of a repository governance review. It is documentation-only: it does not authorize production changes, merges of unrelated pull requests, deployment changes, DNS changes, or deletion of branches.

## Authority and workflow

- `The-Master.md` is the authoritative specification for approved site behavior and content-preservation rules.
- `AUDIT.md` defines verification and required regression checks.
- `migration-manifest.json` is a historical migration snapshot, not a live inventory that updates itself.
- The frozen New-Article workflow baseline remains authoritative for the DOCX-to-draft-PR process. Do not reopen or redesign that workflow absent an explicitly requested change or a confirmed defect.
- Production changes continue to require review, all five required checks, explicit human merge approval, and post-deployment verification.

## Historical migration manifest

The manifest records a migration baseline dated 2026-10-12. Its page/asset counts and audit statuses must be read as historical snapshot data. In particular, `PENDING_LIVE_METADATA_VERIFICATION` and `PENDING` must not be treated as either current failures or completed passes; they remain historical pending entries unless a separately evidenced audit explicitly updates them.

The manifest excludes `https://awakenology.org` from the new-site migration. That exclusion is a migration-scope statement only; it does not specify or verify DNS, SSL, hosting, or redirect behavior for the .org domain. Do not change domain configuration as part of this reconciliation.

## Open review items observed during this pass

### PR #176 — homepage and Search/Ask footer year

Keep separate from this documentation reconciliation. Although automated checks were reported as passing, the PR introduces browser-side JavaScript for the copyright year, while the master specification describes a global footer year. A Codex review did not complete because its usage limit was reached. Do not merge solely on the basis of green automated checks; review the implementation against the master rule and verify the rendered footer first.

### PR #56 — English SEO descriptions

The historical Workers Builds check for commit `7089510726fc00774ca6109cef6489f76a9904b7` failed on 2026-10-11. The available check summary does not include the underlying build error, so the cause is undetermined. The content-integrity check passed. Do not treat this old check result as a current production failure or merge the stale branch as-is. If the description edits are still desired, compare them against current `main`, then submit a fresh narrowly scoped PR and run all required checks.

### Historical generator branches

- `feature/unified-html-word-page-generator` was 14 commits ahead and 32 behind `main` at inspection; its differences include editor generator files, `worker.js`, and sitemap/audit files.
- `feature/simple-one-page-generator` was 6 commits ahead and 46 behind `main` at inspection; its differences include editor generator files, `worker.js`, and removal of a deployment workflow file.

These are divergent historical development branches, not merge candidates. Preserve them for reference for now; do not merge or delete them without reviewing and recording their unique changes and receiving explicit approval.

## No-change decisions

- No production HTML, article content, `worker.js`, DNS, or deployment configuration is changed by this memo.
- No open PR is merged or closed by this memo.
- No historical branch is deleted by this memo.
- Do not mark a pending audit item as passed without fresh, recorded evidence.

## Revisit criteria

Reopen an item only when there is fresh evidence, a confirmed defect, or an explicit site-owner request. For any production change, follow the established Discover → Snapshot → Transform → Validate → Commit workflow and the required review/check/approval gates.
