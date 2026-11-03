# Markdown-to-HTML Publishing — Isolated Proof of Concept

## Decision

Use Markdown only for drafts and internal tests. Finalized articles are maintained as HTML; do not keep a permanent Markdown duplicate or change the established HTML publishing workflow. This proof of concept tests a safe, isolated conversion path only and does not propose a change to that source-of-truth rule.

## Safety boundary

This proof of concept is deliberately isolated:

- It writes output only to a new, caller-supplied destination that does not already exist; the workflow uses a temporary directory.
- The workflow uploads a preview artifact for inspection and never deploys it.
- It does not modify existing published HTML or the production deploy workflow.
- The generated shell is a conversion fixture, not a production Awakenology page. It does not yet integrate the shared header/footer, site CSS, theme controls, fonts, canonical URL rules, structured data, or existing article metadata conventions.

## What this stage verifies

- Required title, description, and language metadata.
- HTML output for paragraphs, emphasis, lists, links, tables, and fenced code.
- Source Markdown remains unchanged.
- Missing required metadata and unsupported metadata fail closed.
- Duplicate metadata fields are rejected.
- Existing output destinations are never overwritten, including hard-link aliases to the source.
- The renderer fails closed when generated HTML contains markup, attributes, or URL schemes outside the explicit allowlist; raw HTML is not an authoring escape hatch.
- Conversion runs in a pull-request workflow with pinned Markdown and HTML-sanitizer versions.

## Before production integration

A representative published article (`大揭露6/index.html`) was inspected. It contains speaker-specific blue text, inline font sizing, underlining, deliberate blank paragraphs, and images in addition to ordinary paragraphs and lists. No matching Markdown source exists in the repository, so a faithful source-to-output comparison cannot yet be claimed. A future real-article test must begin with an explicitly approved Markdown source and compare extracted article text and semantic structure without rewriting the published page. It must also validate shared chrome, light/dark mode, locked language fonts, responsive layout, SEO metadata, internal links, sitemap behavior, and the existing publishing approval gate. Existing HTML remains authoritative until all gates pass and a deliberate migration is approved.

## Run locally

```sh
python -m pip install 'Markdown==3.8.2' 'bleach==6.2.0'
python -m unittest discover -s scripts/markdown_publish_poc -p 'test_*.py' -v
python scripts/markdown_publish_poc/build.py \
  --source scripts/markdown_publish_poc/fixtures/sample-article.md \
  --output /tmp/markdown-publish-preview/index.html
```
