#!/usr/bin/env python3
"""Isolated Markdown-to-HTML proof of concept. Never writes into the site root."""
from __future__ import annotations

import argparse
import html
from pathlib import Path
import re
import sys

import markdown


def read_document(path: Path) -> tuple[dict[str, str], str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError("Markdown source must begin with YAML-style front matter.")
    parts = text.split("---\n", 2)
    if len(parts) != 3:
        raise ValueError("Front matter must be closed by a second --- line.")
    metadata: dict[str, str] = {}
    for line in parts[1].splitlines():
        if not line.strip():
            continue
        if ":" not in line:
            raise ValueError(f"Invalid front matter line: {line}")
        key, value = line.split(":", 1)
        key = key.strip().lower()
        value = value.strip().strip('"').strip("'")
        if key not in {"title", "description", "lang", "date"}:
            raise ValueError(f"Unsupported metadata field: {key}")
        if not value:
            raise ValueError(f"Metadata field {key} must not be empty.")
        metadata[key] = value
    for required in ("title", "description", "lang"):
        if required not in metadata:
            raise ValueError(f"Required metadata field missing: {required}")
    body = parts[2].lstrip()
    if not body.strip():
        raise ValueError("Markdown body must not be empty.")
    return metadata, body


def build(source: Path, output: Path) -> None:
    metadata, source_body = read_document(source)
    body_html = markdown.markdown(
        source_body,
        extensions=["tables", "fenced_code", "sane_lists"],
        output_format="html",
    )
    title = html.escape(metadata["title"], quote=True)
    description = html.escape(metadata["description"], quote=True)
    lang = html.escape(metadata["lang"], quote=True)
    document = f"""<!doctype html>
<html lang="{lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{description}">
</head>
<body>
  <!-- Isolated PoC shell only; production shared header/footer and styles are not included. -->
  <main id="main-content">
    <article class="article">
      <h1>{title}</h1>
      {body_html}
    </article>
  </main>
</body>
</html>
"""
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(document, encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        build(args.source, args.output)
    except (OSError, ValueError) as exc:
        print(f"Build blocked: {exc}", file=sys.stderr)
        return 1
    print(f"Built isolated HTML artifact: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
