"""Fail-closed source-content and metadata checks; rendered parity is a separate gate."""
from bs4 import BeautifulSoup
from hashlib import sha256

def _scope(soup):
    node = soup.select_one("article.article, .article") or soup.select_one("main")
    if node is None:
        raise ValueError("No article or main content")
    return node

def fingerprint(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    if soup.html is None or soup.head is None or soup.body is None:
        raise ValueError("Incomplete HTML document")
    node = _scope(soup)
    return {
        "text": node.get_text(separator="", strip=False),
        "markup": str(node),
        "images": [tuple(sorted(image.attrs.items())) for image in node.select("img")],
        "sha256": sha256(html.encode("utf-8")).hexdigest(),
    }

def validate(source: str, output: str, *, require_markup: bool = True) -> dict:
    a, b = fingerprint(source), fingerprint(output)
    result = {
        "text_unchanged": a["text"] == b["text"],
        "images_unchanged": a["images"] == b["images"],
        "markup_unchanged": a["markup"] == b["markup"],
        "source_sha256": a["sha256"],
        "output_sha256": b["sha256"],
    }
    result["pass"] = result["text_unchanged"] and result["images_unchanged"] and (not require_markup or result["markup_unchanged"])
    if not result["pass"]:
        raise ValueError("Content integrity failure: " + str(result))
    return result

def validate_metadata(html: str, *, canonical: str | None, noindex: bool) -> None:
    soup = BeautifulSoup(html, "html.parser")
    if soup.head is None:
        raise ValueError("Missing document head")
    links = [link for link in soup.head.find_all("link")
             if "canonical" in [str(rel).lower() for rel in link.get("rel", [])]]
    robots = [meta for meta in soup.head.find_all("meta")
              if (meta.get("name") or "").lower() == "robots"]
    if len(links) != (0 if canonical is None else 1):
        raise ValueError("Canonical count mismatch")
    if canonical is not None and links[0].get("href") != canonical:
        raise ValueError("Canonical URL mismatch")
    if len(robots) > 1:
        raise ValueError("Duplicate robots metadata")
    if noindex:
        if len(robots) != 1 or "noindex" not in {
            token.strip().lower() for token in robots[0].get("content", "").split(",")
        }:
            raise ValueError("Missing unique noindex metadata")
    elif robots and "noindex" in {
        token.strip().lower() for token in robots[0].get("content", "").split(",")
    }:
        raise ValueError("Unexpected noindex metadata on indexable route")
