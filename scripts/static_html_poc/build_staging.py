"""Build all public HTML into an isolated temporary staging tree and audit local assets.

CI-only prototype: output lives in a temporary directory and is never published or
copied over source files. The Worker remains the production router.
"""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlparse

from bs4 import BeautifulSoup
from check_full_inventory import public_sources, ROOT
from html_transformer import transform
from page_rules import rules_for
from parity_validator import validate, validate_metadata

REPORT = ROOT / "static-html-staging-report.json"
PRIVATE_PREFIXES = ("editor/", "github-editor/", "scripts/", "tests/", "docs/", ".github/")
ASSET_ATTRS = {"img": "src", "script": "src", "source": "src", "video": "src",
               "audio": "src", "iframe": "src"}


def tracked_files():
    raw = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode("utf-8")
    return {p for p in raw.split("\0") if p}


def local_asset_references(html, tracked, route):
    soup = BeautifulSoup(html, "html.parser")
    refs = []
    for tag in soup.find_all(True):
        attr = ASSET_ATTRS.get(tag.name)
        if attr and tag.get(attr):
            refs.append((tag.name, attr, tag.get(attr)))
        if tag.name == "link" and tag.get("href"):
            rel = [str(x).lower() for x in (tag.get("rel") or [])]
            if any(x in rel for x in ("stylesheet", "icon", "apple-touch-icon", "preload")):
                refs.append((tag.name, "href", tag["href"]))
    failures = []
    for tag, attr, value in refs:
        parsed = urlparse(value.strip())
        if parsed.scheme or parsed.netloc or value.startswith(("data:", "blob:", "#")):
            continue
        path = unquote(parsed.path)
        if not path:
            continue
        candidate = path.lstrip("/") if path.startswith("/") else str((Path(route.lstrip("/")) / path).as_posix())
        candidate = str(Path(candidate))
        if candidate.startswith("../") or candidate == "..":
            failures.append({"route": route, "tag": tag, "attribute": attr, "value": value,
                             "error": "path escapes site root"})
            continue
        options = {candidate}
        if candidate.endswith("/"):
            options.add(candidate + "index.html")
        elif not Path(candidate).suffix:
            options.add(candidate + "/index.html")
            options.add(candidate + ".html")
        if not any(p in tracked for p in options):
            failures.append({"route": route, "tag": tag, "attribute": attr,
                             "value": value, "checked": sorted(options)})
    return failures


def main():
    paths, excluded = public_sources()
    tracked = tracked_files()
    built_routes, asset_failures = [], []
    with tempfile.TemporaryDirectory(prefix="awakenology-static-staging-") as temp:
        output = Path(temp)
        for source_path in paths:
            route = "/" if source_path == "index.html" else "/" + source_path[:-len("index.html")]
            source = (ROOT / source_path).read_text(encoding="utf-8")
            built = transform(source, route)
            validate(source, built)
            rules = rules_for(route)
            validate_metadata(built, canonical=rules.canonical, noindex=rules.noindex)
            target = output / source_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(built, encoding="utf-8", newline="")
            if target.read_text(encoding="utf-8") != built:
                raise AssertionError(f"staged file differs after write/read: {source_path}")
            if transform(source, route) != built or transform(built, route) != built:
                raise AssertionError(f"build is non-deterministic or non-idempotent: {source_path}")
            asset_failures.extend(local_asset_references(built, tracked, route))
            built_routes.append({"source": source_path, "output": source_path,
                                 "bytes": len(built.encode("utf-8")),
                                 "sha256": hashlib.sha256(built.encode("utf-8")).hexdigest()})
        staged_html = sorted(p.relative_to(output).as_posix() for p in output.rglob("*.html"))
        if staged_html != sorted(paths):
            raise AssertionError("staging output route set differs from tracked public source route set")
        forbidden = [p for p in staged_html if p.startswith(PRIVATE_PREFIXES) or p == "404.html"]
        if forbidden:
            raise AssertionError(f"private or excluded HTML entered staging output: {forbidden}")
        if any(p.startswith(("editor/", "github-editor/")) for p in staged_html):
            raise AssertionError("Editor/Generator HTML leaked into public staging output")
        report = {
            "scope": "temporary HTML-only staging build; no deployment, routing, headers or runtime behavior changed",
            "public_source_routes": len(paths), "staged_html_routes": len(staged_html),
            "excluded_html": excluded, "temporary_output_cleaned": True,
            "non_html_assets_copied": False,
            "asset_check": "local HTML asset references checked against tracked repository files; remote/data URLs excluded",
            "local_asset_failures": asset_failures, "routes": built_routes,
        }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if asset_failures:
        raise SystemExit(f"{len(asset_failures)} local asset references failed; report written; no deployment authorized")
    print(f"PASS: {len(paths)} public HTML routes generated in temporary staging; route set, source integrity, metadata, deterministic output and local asset references passed")


if __name__ == "__main__":
    main()
