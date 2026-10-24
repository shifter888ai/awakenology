"""Fail-closed preliminary content comparison. Not a rendered parity claim."""
from bs4 import BeautifulSoup
from hashlib import sha256

def fingerprint(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    if soup.body is None:
        raise ValueError("Missing body")
    scope = soup.select_one("article.article, .article") or soup.select_one("main")
    if scope is None:
        raise ValueError("No article or main content")
    images = [(img.get("src"), img.get("alt"), img.get("width"), img.get("height"), img.get("style")) for img in scope.select("img")]
    return {"text": scope.get_text(separator="", strip=False), "images": images, "sha256": sha256(html.encode()).hexdigest()}

def validate(source: str, output: str) -> dict:
    a, b = fingerprint(source), fingerprint(output)
    result = {"text_unchanged": a["text"] == b["text"], "images_unchanged": a["images"] == b["images"], "source_sha256": a["sha256"], "output_sha256": b["sha256"]}
    result["pass"] = result["text_unchanged"] and result["images_unchanged"]
    if not result["pass"]:
        raise ValueError("Content integrity failure: " + str(result))
    return result
