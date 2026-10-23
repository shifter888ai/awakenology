#!/usr/bin/env python3
"""Guard Worker-first routing: transform HTML and protect private tools, bypass static assets."""
import fnmatch
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://awakenology.space"
CONFIG = ROOT / "wrangler.jsonc"
SITEMAP = ROOT / "sitemap.xml"

def fail(message):
    print("FAIL:", message)
    return False

try:
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    patterns = config["assets"]["run_worker_first"]
except (OSError, json.JSONDecodeError, KeyError, TypeError) as exc:
    print(f"FAIL: cannot read Worker-first configuration: {exc}")
    sys.exit(1)

if not isinstance(patterns, list):
    print("FAIL: run_worker_first must be a path-pattern list, not a global boolean.")
    sys.exit(1)

errors = []
required_patterns = {
    "/", "/*/",
    "/editor", "/editor/*",
    "/github-editor", "/github-editor/*",
    "/New-Article", "/New-Article/*",
    "/auth", "/auth/*",
    "/api/editor", "/api/editor/*",
}
missing = sorted(required_patterns - set(patterns))
if missing:
    errors.append("Missing required Worker-first patterns: " + ", ".join(missing))

def routed(path):
    return any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns)

try:
    root = ET.parse(SITEMAP).getroot()
    urls = [node.text.strip() for node in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc") if node.text]
except (OSError, ET.ParseError) as exc:
    print(f"FAIL: cannot read sitemap.xml: {exc}")
    sys.exit(1)

public_routes = []
for url in urls:
    parts = urlsplit(url)
    path = unquote(parts.path)
    if parts.scheme + "://" + parts.netloc != DOMAIN or parts.query or parts.fragment:
        errors.append(f"Noncanonical sitemap URL: {url}")
    if not path.endswith("/"):
        errors.append(f"Public HTML route does not end with slash: {path}")
    if not routed(path):
        errors.append(f"Public HTML route would bypass Worker transformations: {path}")
    public_routes.append(path)

protected_paths = [
    "/editor", "/editor/", "/editor/index.html",
    "/github-editor", "/github-editor/", "/github-editor/index.html",
    "/New-Article", "/New-Article/",
    "/auth/github", "/api/editor/create-draft-pr", "/api/editor/publish-page",
]
for path in protected_paths:
    if not routed(path):
        errors.append(f"Private tool/auth/API path would bypass Worker: {path}")

static_paths = [
    "/assets/reddit-one.svg",
    "/New-Article/assets/docx-image-001.jpg",
    "/gallery/dialog8-image-2.jpg",
    "/css/site.css",
    "/js/site.js",
    "/sitemap.xml",
    "/robots.txt",
]
for path in static_paths:
    if routed(path):
        errors.append(f"Static asset unexpectedly invokes Worker first: {path}")

worker_source = (ROOT / "worker.js").read_text(encoding="utf-8")
if 'decodedPathname === "/New-Article/"' not in worker_source:
    errors.append("Word generator route is missing the runtime noindex safeguard.")

print(f"Public sitemap routes checked: {len(public_routes)}")
print(f"Worker-first patterns configured: {len(patterns)}")
print(f"Static asset examples checked: {len(static_paths)}")
if errors:
    for error in errors:
        print("FAIL:", error)
    sys.exit(1)
print("PASS: public HTML routes and private tool paths remain Worker-first; static assets bypass Worker-first routing.")
