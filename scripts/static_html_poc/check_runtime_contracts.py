#!/usr/bin/env python3
"""Read-only live HTTP contract probe for the isolated static HTML PoC.

No cookies, credentials, writes, or authenticated actions are used.
"""
import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone

PUBLIC = "https://awakenology.space"
EDITOR = "https://editor.awakenology.space"
REPORT = "static-html-runtime-contract-report.json"

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

OPENER = urllib.request.build_opener(NoRedirect)

def probe(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Awakenology-static-html-readonly-audit/1.0"})
    try:
        response = OPENER.open(req, timeout=20)
    except urllib.error.HTTPError as exc:
        response = exc
    except Exception as exc:
        return {"url": url, "error": type(exc).__name__ + ": " + str(exc)}
    body = response.read(512_000).decode("utf-8", "replace")
    headers = {k.lower(): v for k, v in response.headers.items()}
    robots_meta = re.findall(r"<meta\\b[^>]*\\bname=[\\\"\x27]robots[\\\"\x27][^>]*>", body, flags=re.I)
    return {
        "robots_meta": robots_meta,
        "url": url,
        "status": response.code,
        "location": headers.get("location", ""),
        "cache_control": headers.get("cache-control", ""),
        "x_robots_tag": headers.get("x-robots-tag", ""),
        "content_type": headers.get("content-type", ""),
        "body_bytes_sampled": len(body.encode("utf-8")),
        "body_sample": "",
    }

def main():
    checks = []
    def add(name, url, predicate, explanation):
        result = probe(url)
        passed = predicate(result)
        checks.append({"name": name, "pass": bool(passed), "expectation": explanation, "observation": result})
        print(("PASS" if passed else "FAIL") + ": " + name + " — " + explanation)
        if not passed:
            print("  observed:", {k:v for k,v in result.items() if k not in ("body_sample",)})
    add("public homepage", PUBLIC + "/", lambda r: r.get("status") == 200 and "text/html" in r.get("content_type", ""), "HTTP 200 HTML")
    add("public missing path", PUBLIC + "/__static_html_probe_missing_20261030__/", lambda r: r.get("status") == 404, "HTTP 404 for a unique nonexistent route")
    add("public editor path denied", PUBLIC + "/editor/", lambda r: r.get("status") == 404 and "editor.awakenology.space" not in r.get("location", ""), "public host must not expose or redirect to private editor")
    add("public draft API denied", PUBLIC + "/api/editor/create-draft-pr", lambda r: r.get("status") in (404, 405) and "editor.awakenology.space" not in r.get("location", ""), "public host must not expose private publishing API")
    add("AI Search remains noindex", PUBLIC + "/ai-search/", lambda r: r.get("status") == 200 and ("noindex" in " ".join(r.get("robots_meta", [])).lower() or "noindex" in r.get("x_robots_tag", "").lower()), "AI Search response retains noindex treatment")
    add("editor root requires authentication", EDITOR + "/", lambda r: r.get("status") in (302, 303, 401, 403) and ("github.com/login/oauth/authorize" in r.get("location", "") or "/auth/github" in r.get("location", "") or r.get("status") in (401, 403)), "unauthenticated editor root redirects to OAuth or denies access")
    add("editor page requires authentication", EDITOR + "/editor/", lambda r: r.get("status") in (302, 303, 401, 403) and ("github.com/login/oauth/authorize" in r.get("location", "") or "/auth/github" in r.get("location", "") or r.get("status") in (401, 403)), "unauthenticated editor page redirects to OAuth or denies access")
    add("public query-string homepage", PUBLIC + "/?static_html_probe=1", lambda r: r.get("status") == 200 and "text/html" in r.get("content_type", ""), "query string must not break homepage")
    add("Chinese Unicode article", PUBLIC + "/%E5%A4%A7%E6%8F%AD%E9%9C%B26/", lambda r: r.get("status") == 200 and "text/html" in r.get("content_type", ""), "encoded Unicode route returns HTML")
    add("Chinese Unicode article with query", PUBLIC + "/%E5%A4%A7%E6%8F%AD%E9%9C%B26/?static_html_probe=1", lambda r: r.get("status") == 200 and "text/html" in r.get("content_type", ""), "encoded Unicode route retains query handling")
    add("public robots.txt", PUBLIC + "/robots.txt", lambda r: r.get("status") == 200 and "text/plain" in r.get("content_type", ""), "public robots resource available")
    add("editor robots.txt", EDITOR + "/robots.txt", lambda r: r.get("status") == 200 and "text/plain" in r.get("content_type", ""), "private host serves robots policy")
    add("editor OAuth callback without state", EDITOR + "/auth/github/callback", lambda r: r.get("status") == 400 and "no-store" in r.get("cache_control", ""), "invalid OAuth callback rejected without initiating login")
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "read-only; unauthenticated; no writes or secrets",
        "checks_passed": sum(c["pass"] for c in checks),
        "checks_total": len(checks),
        "checks": checks,
        "limitations": [
            "Observes live production HTTP contracts only; does not deploy or compare against an isolated staging host.",
            "No authenticated OAuth, draft publishing, or Generator flow is exercised.",
            "Response bodies are not included in the report; only extracted robots meta tags and HTTP metadata are recorded.",
        ],
    }
    with open(REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"Runtime contract checks: {report['checks_passed']}/{report['checks_total']} passed")
    if report["checks_passed"] != report["checks_total"]:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
