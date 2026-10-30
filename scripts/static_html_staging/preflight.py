#!/usr/bin/env python3
"""Fail-closed, read-only preflight for isolated static HTML staging.

This script does not generate, replace, or deploy public files.
"""
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
EXCLUDED = {"404.html", "ai-search/index.html", "editor/index.html",
            "github-editor/index.html", "New-Article/index.html"}
PREFIXES = ("editor/", "github-editor/", "scripts/", "tests/", "docs/", ".github/")
DOMAIN = "https://awakenology.space"
errors = []

def require(condition, message):
    if not condition:
        errors.append(message)

config = (ROOT / "wrangler.jsonc").read_text(encoding="utf-8")
worker = (ROOT / "worker.js").read_text(encoding="utf-8")
require('"main": "./worker.js"' in config, "Worker entry changed")
require('"run_worker_first": true' in config, "Worker-first routing changed")
require('"binding": "ASSETS"' in config, "ASSETS binding changed")
for token in ('const EDITOR_HOST = "editor.awakenology.space"', 'verifyEditorSession',
              'startGitHubLogin', 'finishGitHubLogin', 'createGitHubInstallationToken',
              'env.ASSETS.fetch(request)', 'new HTMLRewriter()'):
    require(token in worker, "Worker boundary missing: " + token)

tracked = subprocess.check_output(["git", "ls-files", "-z", "--", "*.html"], cwd=ROOT).decode().split("\0")
public = sorted(p for p in tracked if p and p.endswith("/index.html") or p == "index.html")
public = [p for p in public if p not in EXCLUDED and not p.startswith(PREFIXES)]
require("index.html" in public, "Homepage missing")
require("New-Article/index.html" in tracked, "Draft exclusion must remain explicit")
require("editor/index.html" in tracked, "Private editor exclusion must remain explicit")
routes = {"/" if p == "index.html" else "/" + p[:-len("index.html")] for p in public}
try:
    root = ET.parse(ROOT / "sitemap.xml").getroot()
    urls = [x.text or "" for x in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
    actual = []
    for url in urls:
        parsed = urlsplit(url)
        require(parsed.scheme + "://" + parsed.netloc == DOMAIN and not parsed.query and not parsed.fragment,
                "Noncanonical sitemap URL: " + url)
        actual.append(unquote(parsed.path))
    require(len(actual) == len(set(actual)), "Duplicate sitemap route")
    require(set(actual) == routes, "Sitemap mismatch: missing=" + repr(sorted(routes-set(actual))) +
            " unexpected=" + repr(sorted(set(actual)-routes)))
except (OSError, ET.ParseError) as exc:
    errors.append("Sitemap parse failed: " + str(exc))
report = {"scope": "read-only preflight; no generated output, browser parity or deployment",
          "public_routes": len(routes), "sitemap_routes": len(actual) if "actual" in locals() else None,
          "worker_runtime_retained": True, "failures": errors}
print(json.dumps(report, ensure_ascii=False, indent=2))
sys.exit(1 if errors else 0)
