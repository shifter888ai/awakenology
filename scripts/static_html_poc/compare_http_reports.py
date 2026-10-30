#!/usr/bin/env python3
"""Offline fail-closed comparison of two read-only HTTP contract reports.

Usage: python scripts/static_html_poc/compare_http_reports.py production.json staging.json
No network requests or deployments are performed.
"""
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit

FIELDS = ("status", "content_type", "cache_control", "x_robots_tag", "vary",
          "content_security_policy", "strict_transport_security", "robots_meta")
VOLATILE = ("etag", "body_bytes_sampled")
def key(url):
    u = urlsplit(url)
    return (u.path or "/", u.query, "private" if u.hostname == "editor.awakenology.space" else "public")
def indexed(report):
    entries = report["http_baseline_matrix"]
    result = {}
    for entry in entries:
        k = key(entry["url"])
        if k in result:
            raise ValueError("duplicate route: " + repr(k))
        result[k] = entry
    return result
def compare(production, staging):
    a, b = indexed(production), indexed(staging)
    issues = []
    for k in sorted(a.keys() | b.keys()):
        if k not in a or k not in b:
            issues.append({"route": k, "field": "route_presence", "production": k in a, "staging": k in b})
            continue
        for field in FIELDS:
            if a[k].get(field) != b[k].get(field):
                issues.append({"route": k, "field": field, "production": a[k].get(field), "staging": b[k].get(field)})
        # Compare redirect target path/query, not hostname: staging uses a separate host.
        x, y = a[k].get("location", ""), b[k].get("location", "")
        def target(value):
            if not value: return ""
            u = urlsplit(value)
            return (u.path, u.query, u.fragment)
        if target(x) != target(y):
            issues.append({"route": k, "field": "location", "production": x, "staging": y})
        if "error" in a[k] or "error" in b[k]:
            issues.append({"route": k, "field": "transport_error", "production": a[k].get("error"), "staging": b[k].get("error")})
    return issues
def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: compare_http_reports.py production.json staging.json")
    production, staging = (json.loads(Path(p).read_text(encoding="utf-8")) for p in sys.argv[1:])
    issues = compare(production, staging)
    print(json.dumps({"result": "PASS" if not issues else "BLOCKED", "routes": len(indexed(production)),
                      "differences": issues, "not_compared": VOLATILE}, ensure_ascii=False, indent=2))
    if issues:
        raise SystemExit(1)
if __name__ == "__main__":
    main()
