"""Build a complete, public-only static preview in ./dist.

This output is for the isolated workers.dev preview only. It never modifies source
HTML or production Wrangler configuration. Dynamic Worker endpoints are intentionally
not emulated; this is a visual/content preview.
"""
import hashlib
import shutil
import subprocess
from pathlib import Path

from bs4 import BeautifulSoup

from build_staging import local_asset_references
from check_full_inventory import public_sources, ROOT
from html_transformer import transform
from page_rules import rules_for
from parity_validator import validate, validate_metadata

DIST = ROOT / "dist"
EXCLUDED_PREFIXES = (
    ".github/", "docs/", "scripts/", "tests/", "Internal/", "New-Article/",
    "editor/", "github-editor/", "node_modules/", ".wrangler/",
)
ASSET_EXTENSIONS = {
    ".css", ".js", ".mjs", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp",
    ".ico", ".eot", ".ttf", ".woff", ".woff2", ".mp4", ".webm", ".mp3",
    ".wav", ".pdf", ".xlsx", ".csv", ".zip", ".wasm",
}


def tracked_files():
    raw = subprocess.check_output(
        ["git", "ls-files", "-z"], cwd=ROOT
    ).decode("utf-8")
    return sorted(path for path in raw.split("\0") if path)


def is_public_asset(path):
    if path.startswith(EXCLUDED_PREFIXES):
        return False
    if path in {"worker.js", "wrangler.jsonc", "wrangler.preview.jsonc"}:
        return False
    if path.lower().endswith(".html"):
        return False
    return Path(path).suffix.lower() in ASSET_EXTENSIONS


def add_preview_noindex(html, source_path):
    soup = BeautifulSoup(html, "html.parser")
    if not soup.head:
        raise AssertionError(f"HTML page has no head: {source_path}")
    for tag in list(soup.head.find_all("meta", attrs={"name": lambda value: value and value.lower() == "robots"})):
        tag.decompose()
    soup.head.append(soup.new_tag(
        "meta", attrs={"name": "robots", "content": "noindex,nofollow,noarchive"}
    ))
    return str(soup)


def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    public_html, excluded_html = public_sources()
    if "404.html" not in tracked_files():
        raise AssertionError("Expected tracked 404.html fallback page")

    built_html = []
    for source_path in public_html:
        route = "/" if source_path == "index.html" else "/" + source_path[:-len("index.html")]
        source = (ROOT / source_path).read_text(encoding="utf-8")
        built = transform(source, route)
        validate(source, built)
        rules = rules_for(route)
        validate_metadata(built, canonical=rules.canonical, noindex=rules.noindex)
        built = add_preview_noindex(built, source_path)
        target = DIST / source_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(built, encoding="utf-8", newline="")
        built_html.append(source_path)

    # Keep the site's custom 404 design, but mark the preview page noindex too.
    not_found = (ROOT / "404.html").read_text(encoding="utf-8")
    target = DIST / "404.html"
    target.write_text(add_preview_noindex(not_found, "404.html"), encoding="utf-8", newline="")

    assets = []
    for path in tracked_files():
        if not is_public_asset(path):
            continue
        source = ROOT / path
        target = DIST / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        assets.append(path)

    # Do not publish the production sitemap on a temporary preview host.
    # Let crawlers fetch pages and see the explicit noindex directives.
    (DIST / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n", encoding="utf-8", newline=""
    )
    (DIST / "_headers").write_text(
        "/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n"
        "  X-Content-Type-Options: nosniff\n"
        "  Referrer-Policy: strict-origin-when-cross-origin\n",
        encoding="utf-8", newline=""
    )

    copied = {p.relative_to(DIST).as_posix() for p in DIST.rglob("*") if p.is_file()}
    expected_html = set(public_html) | {"404.html"}
    missing_html = sorted(expected_html - copied)
    forbidden = sorted(
        path for path in copied
        if path.startswith(EXCLUDED_PREFIXES)
        or path in {"worker.js", "wrangler.jsonc", "wrangler.preview.jsonc"}
    )
    if missing_html:
        raise AssertionError(f"Preview is missing HTML routes: {missing_html[:20]}")
    if forbidden:
        raise AssertionError(f"Private/tooling files entered preview: {forbidden[:20]}")

    asset_failures = []
    for source_path in public_html:
        html = (DIST / source_path).read_text(encoding="utf-8")
        route = "/" if source_path == "index.html" else "/" + source_path[:-len("index.html")]
        asset_failures.extend(local_asset_references(html, copied, route))
    not_found_html = (DIST / "404.html").read_text(encoding="utf-8")
    asset_failures.extend(local_asset_references(not_found_html, copied, "/404.html"))
    if asset_failures:
        raise AssertionError(
            f"{len(asset_failures)} local HTML asset references are missing: {asset_failures[:20]}"
        )

    digest = hashlib.sha256()
    for path in sorted(copied):
        digest.update(path.encode("utf-8"))
        digest.update((DIST / path).read_bytes())
    print(
        "PREVIEW BUILD PASS: "
        f"{len(built_html)} transformed public HTML pages, "
        f"{len(assets)} copied public assets, 404 fallback, "
        f"noindex headers, and local HTML asset references verified. "
        f"Files: {len(copied)}; SHA-256: {digest.hexdigest()}"
    )


if __name__ == "__main__":
    main()
