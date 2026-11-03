#!/usr/bin/env python3
"""Temporary HTML -> Markdown -> HTML fidelity probe for one existing article.

The Markdown source is created only in a temporary directory and is never committed
or uploaded. The report deliberately distinguishes text/image preservation from
formatting losses; this is a diagnostic, not a publishing migration.
"""
from __future__ import annotations

import argparse
import json
import re
import tempfile
from pathlib import Path

from bs4 import BeautifulSoup
from markdownify import markdownify

from build import build


def visible_text(markup: str) -> str:
    soup = BeautifulSoup(markup, "html.parser")
    article = soup.select_one("article.article") or soup
    return re.sub(r"\s+", " ", article.get_text(" ", strip=True)).strip()


def image_inventory(markup: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(markup, "html.parser")
    article = soup.select_one("article.article") or soup
    return [
        {"src": image.get("src", ""), "alt": image.get("alt", "")}
        for image in article.find_all("img")
    ]


def formatting_inventory(markup: str) -> dict[str, int]:
    soup = BeautifulSoup(markup, "html.parser")
    article = soup.select_one("article.article") or soup
    spans = article.find_all("span")
    return {
        "blue_text_spans": sum(
            "blue" in " ".join([node.get("class", [""])[0], node.get("style", "")]).lower()
            or "rgb(0, 0, 255)" in node.get("style", "").lower()
            for node in spans
        ),
        "font_size_spans": sum("font-size" in node.get("style", "") for node in spans),
        "underlined_elements": sum(
            node.name == "u" or "underline" in node.get("style", "")
            for node in article.find_all(["u", "span"])
        ),
        "aligned_paragraphs": sum(
            "text-align" in node.get("style", "")
            for node in article.find_all(["p", "div"])
        ),
        "intentional_blank_paragraphs": sum(
            "word-blank-paragraph" in node.get("class", [])
            for node in article.find_all("p")
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-html", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()

    source = args.source_html.read_text(encoding="utf-8")
    source_soup = BeautifulSoup(source, "html.parser")
    article = source_soup.select_one("article.article")
    if article is None:
        raise SystemExit("Source HTML has no article.article element.")

    title = source_soup.title.get_text(" ", strip=True) if source_soup.title else "Untitled"
    description_tag = source_soup.find("meta", attrs={"name": "description"})
    description = description_tag.get("content", "") if description_tag else ""
    lang = source_soup.html.get("lang", "zh-Hant")

    # Markdownify uses Markdown for standard structure and leaves no permanent
    # source file. Any unsupported rich styling is recorded below as a loss.
    markdown_body = markdownify(str(article), heading_style="ATX")
    markdown_source = (
        "---\n"
        f'title: "{title.replace(chr(34), chr(39))}"\n'
        f'description: "{description.replace(chr(34), chr(39))}"\n'
        f'lang: "{lang}"\n'
        "---\n\n"
        f"{markdown_body}\n"
    )

    with tempfile.TemporaryDirectory(prefix="awakenology-fidelity-") as temp:
        temp_dir = Path(temp)
        md_path = temp_dir / "temporary-source.md"
        md_path.write_text(markdown_source, encoding="utf-8")
        build(md_path, args.output)
        generated = args.output.read_text(encoding="utf-8")

    source_text = visible_text(str(article))
    output_text = visible_text(generated)
    source_images = image_inventory(str(article))
    output_images = image_inventory(generated)
    source_format = formatting_inventory(str(article))
    output_format = formatting_inventory(generated)

    report = {
        "source": str(args.source_html),
        "temporary_markdown_committed": False,
        "temporary_markdown_uploaded": False,
        "output_isolated": True,
        "text_content_exact_after_whitespace_normalization": source_text == output_text,
        "source_text_characters": len(source_text),
        "output_text_characters": len(output_text),
        "source_images": source_images,
        "output_images": output_images,
        "images_preserved_exactly": source_images == output_images,
        "source_formatting": source_format,
        "output_formatting": output_format,
        "formatting_losses": {
            key: max(0, value - output_format.get(key, 0))
            for key, value in source_format.items()
        },
        "assessment": "PASS" if source_text == output_text and source_images == output_images else "CONTENT_DIFFERS",
        "note": "A passing text/image check does not imply visual fidelity. Compare formatting inventories and inspect the isolated HTML artifact.",
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
