#!/usr/bin/env python3
"""Read-only live HTTP contract probe for the isolated static HTML PoC.

No cookies, credentials, writes, or authenticated actions are used.
"""
import json
import os
from pathlib import Path
from bs4 import BeautifulSoup
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
    soup = BeautifulSoup(body, "html.parser")
    robots_meta = [str(tag) for tag in soup.find_all("meta", attrs={"name": "robots"})]
    search_widgets = len(soup.find_all("search-bar-snippet"))
    search_forms = len(soup.select("form#search-form"))
    chat_widgets = len(soup.find_all("chat-page-snippet"))
    return {
        "search_widgets": search_widgets,
        "search_forms": search_forms,
        "chat_page_widgets": chat_widgets,
        "robots_meta": robots_meta,
        "url": url,
        "status": response.code,
        "location": headers.get("location", ""),
        "cache_control": headers.get("cache-control", ""),
        "x_robots_tag": headers.get("x-robots-tag", ""),
        "content_type": headers.get("content-type", ""),
        "vary": headers.get("vary", ""),
        "content_security_policy": headers.get("content-security-policy", ""),
        "strict_transport_security": headers.get("strict-transport-security", ""),
        "etag": headers.get("etag", ""),
        "body_bytes_sampled": len(body.encode("utf-8")),
        "body_sample": "",
    }

def main():
    is_pull_request = os.environ.get("GITHUB_EVENT_NAME") == "pull_request"
    checks = []

    def add(name, url, predicate, explanation):
        result = probe(url)
        passed = predicate(result)
        checks.append({"name": name, "pass": bool(passed), "expectation": explanation, "observation": result})
        print(("PASS" if passed else "FAIL") + ": " + name + " — " + explanation)
        if not passed:
            print("  observed:", {k: v for k, v in result.items() if k != "body_sample"})

    def local_contract(name, relative_path, predicate, explanation, root):
        source = (root / relative_path).read_text(encoding="utf-8")
        passed = bool(predicate(source))
        checks.append({
            "name": name,
            "pass": passed,
            "expectation": explanation,
            "observation": {"source_path": relative_path, "mode": "pull-request source check"},
        })
        print(("PASS" if passed else "FAIL") + ": " + name + " — " + explanation)
        if not passed:
            print("  source:", relative_path)

    if is_pull_request:
        # Pull-request mode is source-only: no production HTTP requests are made.
        root = Path(__file__).resolve().parents[2]
        local_contract(
            "legacy AI Search route redirects to Search", "worker.js",
            lambda source: 'url.pathname === "/ai-search" || url.pathname === "/ai-search/"' in source
                and 'Response.redirect(new URL("/search/" + url.search, url.origin).toString(), 301)' in source,
            "Worker source permanently redirects the legacy route to /search/", root)
        local_contract(
            "Search page remains noindex", "search/index.html",
            lambda source: 'id="search-form"' in source
                and 'id="search-query"' in source
                and 'class="search-submit"' in source
                and "search.ai.cloudflare.com/search" in source
                and "<chat-page-snippet" not in source
                and "<chat-bubble-snippet" not in source
                and 'name="robots" content="noindex,follow"' in source,
            "Search source contains the dedicated inline search form, no chat widget, and remains noindex", root)
        local_contract(
            "Ask page remains noindex", "ask/index.html",
            lambda source: source.count("<chat-page-snippet") == 1
                and "<search-bar-snippet" not in source
                and "<chat-bubble-snippet" not in source
                and 'name="robots" content="noindex,follow"' in source,
            "Ask source contains only the full-page chat interface and remains noindex", root)
        matrix = []
        matrix_errors = []
        mode = "pull_request source-only; no HTTP requests"
        limitations = [
            "Pull-request mode validates proposed Worker/Search/Ask source contracts locally and makes no HTTP requests.",
            "Private Editor/Generator authentication and authenticated publishing flows are not exercised.",
            "Source checks do not establish live status/header/cache or browser parity.",
        ]
    else:
        add("public homepage", PUBLIC + "/", lambda r: r.get("status") == 200 and "text/html" in r.get("content_type", ""), "HTTP 200 HTML")
        add("public missing path", PUBLIC + "/__static_html_probe_missing_20261030__/", lambda r: r.get("status") == 404, "HTTP 404 for a unique nonexistent route")
        add("public editor path denied", PUBLIC + "/editor/", lambda r: r.get("status") == 404 and "editor.awakenology.space" not in r.get("location", ""), "public host must not expose or redirect to private editor")
        add("public draft API denied", PUBLIC + "/api/editor/create-draft-pr", lambda r: r.get("status") in (404, 405) and "editor.awakenology.space" not in r.get("location", ""), "public host must not expose private publishing API")
        add("legacy AI Search route redirects to Search", PUBLIC + "/ai-search/", lambda r: r.get("status") == 301 and r.get("location", "").rstrip("/").endswith("/search"), "legacy route permanently redirects to the dedicated Search page")
        add("Search page remains noindex", PUBLIC + "/search/", lambda r: r.get("status") == 200 and r.get("search_forms") == 1 and r.get("search_widgets") == 0 and r.get("chat_page_widgets") == 0 and ("noindex" in " ".join(r.get("robots_meta", [])).lower() or "noindex" in r.get("x_robots_tag", "").lower()), "Search page contains only the Search widget and remains noindex")
        add("Ask page remains noindex", PUBLIC + "/ask/", lambda r: r.get("status") == 200 and r.get("chat_page_widgets") == 1 and r.get("search_widgets") == 0 and r.get("search_forms") == 0 and ("noindex" in " ".join(r.get("robots_meta", [])).lower() or "noindex" in r.get("x_robots_tag", "").lower()), "Ask page contains only the full-page chat interface and remains noindex")
        add("editor root requires authentication", EDITOR + "/", lambda r: r.get("status") in (302, 303, 401, 403) and ("github.com/login/oauth/authorize" in r.get("location", "") or "/auth/github" in r.get("location", "") or r.get("status") in (401, 403)), "unauthenticated editor root redirects to OAuth or denies access")
        add("editor page requires authentication", EDITOR + "/editor/", lambda r: r.get("status") in (302, 303, 401, 403) and ("github.com/login/oauth/authorize" in r.get("location", "") or "/auth/github" in r.get("location", "") or r.get("status") in (401, 403)), "unauthenticated editor page redirects to OAuth or denies access")
        add("public query-string homepage", PUBLIC + "/?static_html_probe=1", lambda r: r.get("status") == 200 and "text/html" in r.get("content_type", ""), "query string must not break homepage")
        add("Chinese Unicode article", PUBLIC + "/%E5%A4%A7%E6%8F%AD%E9%9C%B26/", lambda r: r.get("status") == 200 and "text/html" in r.get("content_type", ""), "encoded Unicode route returns HTML")
        add("Chinese Unicode article with query", PUBLIC + "/%E5%A4%A7%E6%8F%AD%E9%9C%B26/?static_html_probe=1", lambda r: r.get("status") == 200 and "text/html" in r.get("content_type", ""), "encoded Unicode route retains query handling")
        add("public robots.txt", PUBLIC + "/robots.txt", lambda r: r.get("status") == 200 and "text/plain" in r.get("content_type", ""), "public robots resource available")
        add("editor robots.txt", EDITOR + "/robots.txt", lambda r: r.get("status") == 200 and "text/plain" in r.get("content_type", ""), "private host serves robots policy")
        add("editor OAuth callback without state", EDITOR + "/auth/github/callback", lambda r: r.get("status") == 400 and "no-store" in r.get("cache_control", ""), "invalid OAuth callback rejected without initiating login")
        matrix_urls = [
            PUBLIC + "/", PUBLIC + "/index.html", PUBLIC + "/?phase5=1",
            PUBLIC + "/%E5%A4%A7%E6%8F%AD%E9%9C%B26/",
            PUBLIC + "/%E5%A4%A7%E6%8F%AD%E9%9C%B26/?phase5=1",
            PUBLIC + "/robots.txt", PUBLIC + "/sitemap.xml",
            PUBLIC + "/ai-search/", PUBLIC + "/search/", PUBLIC + "/ask/", PUBLIC + "/editor/",
            PUBLIC + "/__static_html_phase5_missing__/",
            EDITOR + "/", EDITOR + "/editor/", EDITOR + "/robots.txt",
        ]
        matrix = [probe(url) for url in matrix_urls]
        matrix_errors = [item for item in matrix if "error" in item]
        print(f"Observed HTTP baseline matrix: {len(matrix)} routes; {len(matrix_errors)} transport errors")
        mode = "read-only; unauthenticated; no writes or secrets; optional manual production HTTP contract"
        limitations = [
            "Observes live production HTTP contracts only; does not deploy or compare against an isolated staging host.",
            "No authenticated OAuth, draft publishing, or Generator flow is exercised.",
            "Response bodies are not included in the report; only extracted robots meta tags and HTTP metadata are recorded.",
        ]

    report = {
        "http_baseline_matrix": matrix,
        "http_baseline_transport_errors": matrix_errors,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "checks_passed": sum(c["pass"] for c in checks),
        "checks_total": len(checks),
        "checks": checks,
        "limitations": limitations,
    }
    with open(REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"Runtime contract checks: {report['checks_passed']}/{report['checks_total']} passed")
    if report["checks_passed"] != report["checks_total"] or matrix_errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
