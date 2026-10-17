# GitHub-native article editor (parallel pilot)

This pilot keeps the existing Cloudflare editor unchanged while testing a GitHub-native draft-PR path.

## Current pilot workflow

1. Open the editor's review screen and inspect the full-page preview and text diff.
2. Obtain the target article's current Git blob SHA from GitHub's file page/API.
3. Open **Actions → Create draft article PR from reviewed HTML → Run workflow**.
4. Supply the repository-relative article path, current blob SHA, and complete reviewed HTML.
5. The workflow checks the SHA against `main`, validates the target and HTML, creates a branch, and opens a **draft PR**. It never writes directly to `main` or deploys the site.

The workflow uses GitHub's built-in `GITHUB_TOKEN`; it does not ask the editor to store a personal access token. Starting the workflow requires the user to be signed in to GitHub with repository permissions.

## Important limitations of this pilot

- This is a safe intermediate workflow, not yet the one-click editor integration.
- GitHub workflow-dispatch input is limited in size; the workflow blocks HTML over 60,000 UTF-8 bytes.
- The expected blob SHA is mandatory so a stale review cannot overwrite a newer article.
- The workflow is deliberately separate from the Cloudflare deployment workflow.
- Do not merge a content PR until the normal content-integrity checks and visual review pass.

A later one-click flow requires a properly registered GitHub App/OAuth integration or another authenticated backend. Do not embed write credentials in a static GitHub Pages page.
