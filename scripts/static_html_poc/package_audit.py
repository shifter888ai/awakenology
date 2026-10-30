#!/usr/bin/env python3
"""Build an offline, non-deployable static HTML manifest; never modifies source files."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from bs4 import BeautifulSoup
from check_full_inventory import ROOT, public_sources
from html_transformer import transform
from page_rules import rules_for
from parity_validator import validate, validate_metadata
from build_staging import tracked_files, local_asset_references

REPORT = ROOT / "static-html-package-audit.json"
def sha(data):
    return hashlib.sha256(data).hexdigest()
def build():
    paths, excluded = public_sources()
    tracked = tracked_files()
    routes = []
    failures = []
    for path in paths:
        route = "/" if path == "index.html" else "/" + path[:-len("index.html")]
        source_bytes = (ROOT / path).read_bytes()
        source = source_bytes.decode("utf-8")
        output = transform(source, route)
        validate(source, output)
        rules = rules_for(route)
        validate_metadata(output, canonical=rules.canonical, noindex=rules.noindex)
        if transform(source, route) != output or transform(output, route) != output:
            raise AssertionError("non-deterministic transform: " + path)
        failures.extend(local_asset_references(output, tracked, route))
        routes.append({"path": path, "route": route, "source_sha256": sha(source_bytes),
                       "generated_sha256": sha(output.encode("utf-8")), "generated_bytes": len(output.encode("utf-8"))})
    if failures:
        raise AssertionError("missing local assets: " + json.dumps(failures, ensure_ascii=False))
    # No generated HTML is placed in the repository or uploaded as a deployable bundle.
    return {"schema": 1, "mode": "offline manifest only; NOT a deployable package",
            "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
            "route_count": len(routes), "excluded_html": excluded, "routes": routes,
            "source_asset_count": len(tracked), "local_asset_failures": failures,
            "deployment": "not performed", "private_editor_included": False}
def main():
    report = build()
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(f"PASS: {report['route_count']} routes inventoried; offline digest manifest written; no deployable HTML produced")
if __name__ == "__main__":
    main()
