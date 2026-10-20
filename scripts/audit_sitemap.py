#!/usr/bin/env python3
"""Check sitemap URLs against public HTML routes without changing site files."""
import collections
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://awakenology.space"
SPECIAL = {"404.html", "ai-search/index.html", "editor/index.html", "github-editor/index.html", "New-Article/index.html"}
files = {p.relative_to(ROOT).as_posix() for p in ROOT.rglob("index.html")}
files.add("index.html")
expected = {"/" if p == "index.html" else "/" + p[:-len("index.html")] for p in files - SPECIAL}
errors = []
try:
    root = ET.parse(ROOT / "sitemap.xml").getroot()
    locations = [el.text or "" for el in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
except (ET.ParseError, OSError) as exc:
    print(f"FAIL: cannot parse sitemap.xml: {exc}")
    sys.exit(1)
actual = []
for url in locations:
    parts = urlsplit(url)
    if parts.scheme + "://" + parts.netloc != DOMAIN or parts.query or parts.fragment:
        errors.append(f"Noncanonical URL: {url}")
    route = unquote(parts.path)
    if not route.startswith("/") or not route.endswith("/") or "/../" in route or "/./" in route:
        errors.append(f"Invalid route: {url}")
    actual.append(route)
duplicates = [route for route, count in collections.Counter(actual).items() if count > 1]
for route in sorted(duplicates):
    errors.append(f"Duplicate route: {route}")
for route in sorted(expected - set(actual)):
    errors.append(f"Missing sitemap route: {route}")
for route in sorted(set(actual) - expected):
    errors.append(f"Unexpected sitemap route: {route}")
print(f"HTML public routes: {len(expected)}; sitemap entries: {len(locations)}; unique sitemap routes: {len(set(actual))}")
if errors:
    for error in errors:
        print("FAIL:", error)
    sys.exit(1)
print("PASS: sitemap matches public HTML routes exactly.")
