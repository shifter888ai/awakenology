"""Phase 3: enumerate every tracked public HTML route and fail closed on build loss.

No output is written into the deployed website. The inventory is derived from Git,
not from a hand-maintained list or a sitemap that could silently omit pages.
"""
import hashlib
import json
import subprocess
from pathlib import Path
from urllib.parse import quote

from check_real_pages import ROOT
from html_transformer import transform
from page_rules import rules_for
from parity_validator import validate, validate_metadata, fingerprint

PRIVATE_PREFIXES = ("editor/", "github-editor/", "scripts/", "tests/", "docs/", ".github/")
PRIVATE_NAMES = {"404.html"}
REPORT = ROOT / "static-html-full-inventory-report.json"


def public_sources():
    paths = subprocess.check_output(
        ["git", "ls-files", "-z", "--", "*.html"], cwd=ROOT
    ).decode("utf-8").split("\0")
    result = []
    excluded = []
    for path in sorted(filter(None, paths)):
        if path.startswith(PRIVATE_PREFIXES) or path in PRIVATE_NAMES:
            excluded.append(path)
            continue
        if path != "index.html" and not path.endswith("/index.html"):
            # Unknown public HTML entry points must be classified deliberately.
            raise AssertionError(f"Unclassified public HTML file: {path}")
        result.append(path)
    if not result or "index.html" not in result:
        raise AssertionError("Public route inventory is empty or missing homepage")
    if not {"editor/index.html", "editor/generator.html", "editor/html-generator.html"}.issubset(set(excluded)):
        raise AssertionError("Expected private editor/generator files absent from exclusions")
    return result, excluded


def main():
    paths, excluded = public_sources()
    routes = []
    failures = []
    for path in paths:
        route = "/" if path == "index.html" else "/" + path[:-len("index.html")]
        source = (ROOT / path).read_bytes().decode("utf-8")
        try:
            built = transform(source, route)
            validate(source, built)
            rules = rules_for(route)
            validate_metadata(built, canonical=rules.canonical, noindex=rules.noindex)
            if built != transform(source, route) or built != transform(built, route):
                raise AssertionError("Non-reproducible or non-idempotent build")
            routes.append({"path": path, "route": route,
                           "source_sha256": hashlib.sha256(source.encode("utf-8")).hexdigest(),
                           "built_sha256": hashlib.sha256(built.encode("utf-8")).hexdigest(),
                           "canonical": rules.canonical, "noindex": rules.noindex})
            print(f"PASS {path}", flush=True)
        except Exception as error:
            detail = {"path": path, "route": route, "error": str(error)}
            if "Content integrity failure" in str(error):
                from difflib import SequenceMatcher
                a, b = fingerprint(source), fingerprint(built)
                for field in ("text", "markup"):
                    left, right = a[field], b[field]
                    match = SequenceMatcher(None, left, right, autojunk=False).get_opcodes()
                    first = next(((tag, i, j, x, y) for tag, i, j, x, y in match if tag != "equal"), None)
                    if first:
                        tag, i, j, x, y = first
                        detail[field + "_first_difference"] = {"kind": tag,
                            "source_context": left[max(0, i-90):min(len(left), j+90)],
                            "built_context": right[max(0, x-90):min(len(right), y+90)],
                            "source_length": len(left), "built_length": len(right)}
            failures.append(detail)
            print(f"FAIL {path}: {error}", flush=True)
    report = {"scope": "all tracked public index.html routes, source/build checks only; not full live Worker or browser parity",
              "public_routes": len(paths), "excluded_html": excluded,
              "routes": routes, "failures": failures}
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if failures:
        raise SystemExit(f"{len(failures)} of {len(paths)} public routes failed; no deployment authorized")
    print(f"{len(paths)} public routes passed source, metadata and deterministic build checks")


if __name__ == "__main__":
    main()
