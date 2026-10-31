# Markdown-to-HTML Publishing — Isolated Proof of Concept

## Decision

Use Markdown as the authoring source for suitable new or revised articles, then generate static HTML for publication after review and approval. Do not serve raw Markdown as the normal visitor-facing article experience.

## Safety boundary

This proof of concept is deliberately isolated:
- It writes output only to the caller-supplied destination; the workflow uses a temporary directory.
- The workflow uploads a preview artifact for inspection and never deploys it.
- It does not modify existing published HTML or the production deploy workflow.
- The generated shell is a conversion fixture, not a production Awakenology page. It does not yet integrate the shared header/footer, site CSS, theme controls, fonts, canonical URL rules, structured data, or existing article metadata conventions.

## What this stage verifies

- Required title, description, and language metadata.
- HTML output for paragraphs, emphasis, lists, links, tables, and fenced code.
- Source Markdown remains unchanged.
- Missing required metadata and unsupported metadata fail closed.
- Conversion runs in a pull-request workflow with a pinned renderer version.

## Before production integration

A later stage must compare the generated output with an existing representative Awakenology article and validate content integrity, shared chrome, light/dark mode, fonts, responsive layout, SEO metadata, internal links, sitemap behavior, and the current publishing approval gate. Existing HTML remains authoritative until that validation passes and a deliberate migration is approved.

## Run locally

```sh
python -m pip install 'Markdown==3.8.2'
python -m unittest discover -s scripts/markdown_publish_poc -p 'test_*.py' -v
python scripts/markdown_publish_poc/build.py \
  --source scripts/markdown_publish_poc/fixtures/sample-article.md \
  --output /tmp/markdown-publish-preview/index.html
```
