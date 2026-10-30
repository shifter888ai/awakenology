#!/usr/bin/env python3
"""Report-only, fail-closed static route eligibility; never enables Worker routing."""
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
SITE = "https://awakenology.space"
CONFIG = ROOT / "scripts/static_html_migration/static-route-allowlist.json"
REPORT = ROOT / "static-route-eligibility-report.json"
BLOCKED_PREFIXES = (
    "/editor/", "/github-editor/", "/new-article/", "/ai-search/",
    "/api/", "/auth/", "/oauth/", "/callback/", "/scripts/",
    "/tests/", "/docs/", "/.github/", "/404/",
)


def validate_route(route):
    if not isinstance(route, str) or not route.startswith("/") or not route.endswith("/"):
        raise ValueError("Route must be an absolute slash-terminated path")
    if any(c in route for c in ("%", "?", "#", "\\", "\x00")) or "//" in route:
        raise ValueError("Encoded, ambiguous or non-path route")
    if any(part in (".", "..") for part in route.split("/")):
        raise ValueError("Dot segment in route")
    if any(ord(c) < 32 or ord(c) == 127 for c in route):
        raise ValueError("Control character in route")
    if route.casefold().startswith(BLOCKED_PREFIXES):
        raise ValueError("Private, draft or dynamic route is ineligible")
    return route


def parse_sitemap(xml_bytes):
    root = ET.fromstring(xml_bytes)
    locs = root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
    if not locs:
        raise ValueError("Sitemap has no URL entries")
    routes = set()
    for loc in locs:
        raw = (loc.text or "").strip()
        url = urlsplit(raw)
        if url.scheme != "https" or url.netloc != "awakenology.space" or url.query or url.fragment:
            raise ValueError("Noncanonical sitemap URL: " + raw)
        route = validate_route(unquote(url.path))
        if route in routes:
            raise ValueError("Duplicate decoded sitemap route: " + route)
        routes.add(route)
    return routes


def source_route(path):
    if path == "index.html":
        return "/"
    if path.endswith("/index.html"):
        return "/" + path[:-len("index.html")]
    return None


def classify(tracked_html, sitemap_routes, config):
    if not isinstance(config, dict) or set(config) != {"schema", "mode", "routes"}:
        raise ValueError("Allowlist config schema mismatch")
    if type(config["schema"]) is not int or config["schema"] != 1 or config["mode"] != "report-only":
        raise ValueError("Only schema 1, report-only mode is accepted")
    proposed = config["routes"]
    if not isinstance(proposed, list) or len(proposed) != len(set(map(str, proposed))):
        raise ValueError("Allowlist must be a duplicate-free list")
    if not tracked_html or "index.html" not in tracked_html:
        raise ValueError("Tracked homepage missing")
    eligible = set()
    excluded = []
    all_sources = set()
    for path in sorted(tracked_html):
        route = source_route(path)
        if route is None:
            excluded.append({"path": path, "reason": "not an index route"})
            continue
        if route in all_sources:
            raise ValueError("Duplicate source route: " + route)
        all_sources.add(route)
        try:
            validate_route(route)
        except ValueError:
            excluded.append({"path": path, "reason": "private, draft or invalid route"})
            continue
        if route not in sitemap_routes:
            excluded.append({"path": path, "reason": "not in canonical sitemap"})
            continue
        eligible.add(route)
    missing = sitemap_routes - all_sources
    if missing:
        raise ValueError("Sitemap routes lack tracked HTML: " + repr(sorted(missing)))
    for route in proposed:
        validate_route(route)
        if route not in eligible:
            raise ValueError("Allowlist route is not an eligible tracked sitemap route: " + route)
    return {"scope": "offline eligibility report only; no runtime switch or deployment",
            "mode": "report-only", "activated": False,
            "eligible_candidate_count": len(eligible), "eligible_candidates": sorted(eligible),
            "proposed_allowlist": proposed, "excluded_tracked_html": excluded,
            "deployment": "not performed", "failures": []}


def main():
    try:
        tracked = subprocess.check_output(
            ["git", "ls-files", "-z", "--", "*.html"], cwd=ROOT
        ).decode("utf-8").split("\0")
        tracked = sorted(filter(None, tracked))
        sitemap = parse_sitemap((ROOT / "sitemap.xml").read_bytes())
        config = json.loads(CONFIG.read_text(encoding="utf-8"))
        report = classify(tracked, sitemap, config)
        for route in report["eligible_candidates"]:
            path = "index.html" if route == "/" else route.lstrip("/") + "index.html"
            source = ROOT / path
            if not source.is_file() or source.is_symlink():
                raise ValueError("Candidate source absent or symlinked: " + path)
    except (OSError, UnicodeError, ValueError, ET.ParseError, subprocess.CalledProcessError) as exc:
        report = {"scope": "offline eligibility report only; no runtime switch or deployment",
                  "mode": "report-only", "activated": False, "deployment": "not performed",
                  "failures": [str(exc)]}
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if report["failures"]:
        print("BLOCKED: " + "; ".join(report["failures"]))
        return 1
    print(f"PASS: {report['eligible_candidate_count']} candidate routes inventoried; no routes activated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
