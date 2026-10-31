#!/usr/bin/env python3
"""Read-only production SEO audit. Run after audit_seo_metadata.py."""
import argparse, collections, csv, os, subprocess, sys, time, urllib.error, urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://awakenology.space"
OUT = ROOT / "seo-runtime-report.csv"
UA = "Awakenology-SEO-Audit/1.0 (+https://awakenology.space/)"


def read_url_with_retries(opener, request, timeout=20, attempts=2):
    """Read a URL with one bounded retry for transient network timeouts/errors."""
    last_error = None
    for attempt in range(attempts):
        try:
            with opener.open(request, timeout=timeout) as response:
                status = response.status
                final_url = response.geturl()
                content_type = response.headers.get("Content-Type", "")
                charset = response.headers.get_content_charset() or "utf-8"
                raw = response.read(3000000)
                return status, final_url, content_type, charset, raw
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            last_error = error
            if attempt + 1 < attempts:
                time.sleep(1)
    raise last_error


class Head(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.head = self.title_on = False
        self.titles, self.desc, self.robots, self.canonicals = [], [], [], []
        self.og, self.lang = collections.defaultdict(list), ""
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html": self.lang = a.get("lang", "").strip()
        if tag == "head": self.head = True
        if not self.head: return
        if tag == "title":
            self.title_on = True
            self.titles.append("")
        if tag == "meta":
            name, prop, value = a.get("name", "").lower(), a.get("property", "").lower(), a.get("content", "").strip()
            if name == "description": self.desc.append(value)
            if name == "robots": self.robots.append(value.lower())
            if prop.startswith("og:"): self.og[prop].append(value)
        if tag == "link" and "canonical" in a.get("rel", "").lower().split():
            self.canonicals.append(a.get("href", "").strip())
    def handle_endtag(self, tag):
        if tag == "title": self.title_on = False
        if tag == "head": self.head = False
    def handle_data(self, data):
        if self.title_on and self.titles: self.titles[-1] += data

def select_sample_urls(urls, limit):
    """Return a deterministic, evenly distributed route sample with key routes retained."""
    if limit <= 0 or limit >= len(urls):
        return list(urls)
    selected = []
    for key in (DOMAIN + "/", DOMAIN + "/ai-search/"):
        if key in urls and key not in selected and len(selected) < limit:
            selected.append(key)
    remaining = [url for url in urls if url not in selected]
    slots = limit - len(selected)
    if slots > 0 and remaining:
        if slots == 1:
            indices = [len(remaining) // 2]
        else:
            indices = [round(i * (len(remaining) - 1) / (slots - 1)) for i in range(slots)]
        selected.extend(remaining[i] for i in indices)
    selected_set = set(selected)
    return [url for url in urls if url in selected_set]


def main():
    parser = argparse.ArgumentParser(description="Audit deployed metadata; --max-routes bounds production requests.")
    parser.add_argument("--max-routes", type=int, default=0, help="maximum routes to fetch after sitemap validation; 0 means all")
    args = parser.parse_args()
    try:
        root = ET.parse(ROOT / "sitemap.xml").getroot()
        urls = [n.text.strip() for n in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc") if n.text]
    except (OSError, ET.ParseError) as e:
        print(f"FAIL: sitemap.xml: {e}"); return 1
    if len(urls) != len(set(urls)):
        print("FAIL: sitemap contains duplicate URL entries")
        return 1
    if any(urlsplit(url).scheme != "https" or urlsplit(url).netloc != "awakenology.space" for url in urls):
        print("FAIL: sitemap contains a URL outside the canonical HTTPS domain")
        return 1
    # A noindex page must remain crawlable so crawlers can observe its robots meta tag.
    try:
        req = urllib.request.Request(DOMAIN + "/robots.txt", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as response:
            robots_text = response.read(200000).decode("utf-8", errors="replace")
        if response.status != 200:
            print("FAIL: robots.txt returned HTTP " + str(response.status))
            return 1
        for line in robots_text.splitlines():
            if line.strip().lower().startswith("disallow:") and line.split(":", 1)[1].strip().rstrip("/") == "/ai-search":
                print("FAIL: robots.txt blocks /ai-search/, preventing crawlers from seeing noindex")
                return 1
        if "https://awakenology.space/sitemap.xml" not in robots_text:
            print("FAIL: robots.txt does not advertise the canonical sitemap URL")
            return 1
    except (urllib.error.URLError, TimeoutError, OSError, UnicodeError) as e:
        print("FAIL: cannot verify robots.txt: " + type(e).__name__)
        return 1
    print("PASS: robots.txt allows crawler access to /ai-search/ and advertises the canonical sitemap")
    ai = DOMAIN + "/ai-search/"
    if ai not in urls: urls.append(ai)
    source_file = ROOT / "seo-metadata-report.csv"
    source = {}
    if source_file.exists():
        with source_file.open(encoding="utf-8", newline="") as f:
            source = {r["path"]: r.get("flags", "") for r in csv.DictReader(f)}
    # Production routes stay live-checked; PR-only routes use checked-out HTML.
    try:
        req = urllib.request.Request(DOMAIN + "/sitemap.xml", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as response:
            if response.status != 200: raise OSError("production sitemap status")
            deployed_root = ET.fromstring(response.read(3000000))
        deployed_urls = {n.text.strip() for n in deployed_root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc") if n.text}
    except (urllib.error.URLError, TimeoutError, OSError, ET.ParseError) as e:
        print("FAIL: cannot verify production sitemap: " + type(e).__name__)
        return 1
    # In pull requests, use the base branch sitemap to distinguish genuinely new
    # routes from routes already deployed. Production sitemap/CDN state can be ahead
    # of or inconsistent with the checked-out PR HTML, so it is not a reliable test
    # of whether a PR route should be audited locally.
    base_urls = set()
    if os.environ.get("GITHUB_EVENT_NAME") == "pull_request":
        base_ref = os.environ.get("GITHUB_BASE_REF", "").strip()
        if base_ref:
            try:
                base_xml = subprocess.run(
                    ["git", "show", f"origin/{base_ref}:sitemap.xml"],
                    check=True, capture_output=True, text=True, timeout=10
                ).stdout
                base_root = ET.fromstring(base_xml)
                base_urls = {n.text.strip() for n in base_root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc") if n.text}
                print(f"PR base sitemap routes loaded: {len(base_urls)} ({base_ref})")
            except (subprocess.SubprocessError, ET.ParseError):
                print("WARNING: could not read base-branch sitemap; falling back to production sitemap comparison")
    total_routes = len(urls)
    if args.max_routes > 0 and args.max_routes < total_routes:
        urls = select_sample_urls(urls, args.max_routes)
        print(f"Bounded production metadata sample: {len(urls)} of {total_routes} routes; full sitemap/robots checks retained")
    opener, rows = urllib.request.build_opener(), []
    for i, url in enumerate(urls, 1):
        errors, status, title, desc, canonical, robots, lang = [], "", "", "", "", "", ""
        path = urlsplit(url).path or "/"
        is_ai = path.rstrip("/") == "/ai-search"
        source_path = "index.html" if path == "/" else unquote(path.lstrip("/")) + "index.html"
        expected = DOMAIN + (path if path.endswith("/") or path == "/" else path + "/")
        try:
            use_local_pr_html = bool(base_urls) and url not in base_urls
            if (use_local_pr_html or (not base_urls and url not in deployed_urls)) and not is_ai:
                local = ROOT / source_path
                if not local.is_file(): raise OSError("new route missing local HTML")
                status, final, ctype, charset = 200, url, "text/html", "utf-8"
                raw = local.read_bytes()
            else:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                status, final, ctype, charset, raw = read_url_with_retries(opener, req)
            if status != 200: errors.append("http-status-" + str(status))
            if "text/html" not in ctype.lower(): errors.append("non-html-content-type")
            if final.rstrip("/") != url.rstrip("/"): errors.append("redirected-url")
            p = Head(); p.feed(raw.decode(charset, errors="replace"))
            lang = p.lang
            title = p.titles[0].strip() if p.titles else ""
            desc = p.desc[0] if p.desc else ""
            canonical = p.canonicals[0] if p.canonicals else ""
            robots = ",".join(p.robots)
            if not lang: errors.append("missing-lang")
            if not title: errors.append("missing-title")
            if len(p.titles) != 1: errors.append("title-count-" + str(len(p.titles)))
            if not desc: errors.append("missing-description")
            if len(p.desc) != 1: errors.append("description-count-" + str(len(p.desc)))
            if not is_ai:
                if len(p.canonicals) != 1: errors.append("canonical-count-" + str(len(p.canonicals)))
                if canonical != expected: errors.append("canonical-mismatch")
            directives = {d.strip() for x in p.robots for d in x.replace(" ", ",").split(",") if d.strip()}
            if is_ai and not {"noindex", "follow"}.issubset(directives): errors.append("ai-search-not-noindex-follow")
            if not is_ai and "noindex" in directives: errors.append("unexpected-noindex")
            for prop in ("og:title", "og:description", "og:url", "og:image"):
                vals = p.og.get(prop, [])
                if len(vals) != 1: errors.append(prop + "-count-" + str(len(vals)))
                if not vals or not vals[0]: errors.append(prop + "-empty")
            if p.og.get("og:url", [""])[0] != expected: errors.append("og-url-mismatch")
            img = urlsplit(p.og.get("og:image", [""])[0])
            if img.scheme not in ("http", "https") or not img.netloc: errors.append("og-image-not-absolute")
            if path == "/" and p.og.get("og:type", [""])[0] != "website": errors.append("homepage-og-type-not-website")
        except (urllib.error.URLError, TimeoutError, OSError, UnicodeError) as e:
            errors.append("fetch-error-" + type(e).__name__)
        src = source.get(source_path, "")
        comparison = "RUNTIME_FAILURE" if errors else ("SOURCE_WARNING_RUNTIME_PASS" if src else "PASS")
        rows.append({"url":url,"source_path":source_path,"http_status":status,"lang":lang,
          "title":title,"description":desc,"canonical":canonical,"robots":robots,
          "source_flags":src,"runtime_flags":";".join(sorted(set(errors))),
          "source_runtime_comparison":comparison,"result":"FAIL" if errors else "PASS"})
        print(f"[{i}/{len(urls)}] {'FAIL' if errors else 'PASS'} {url}" + (": "+", ".join(sorted(set(errors))) if errors else ""))
        time.sleep(.15)
    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    failed = sum(r["result"] == "FAIL" for r in rows)
    warnings = sum(r["source_runtime_comparison"] == "SOURCE_WARNING_RUNTIME_PASS" for r in rows)
    print(f"Production URLs checked: {len(rows)} including /ai-search/; failed: {failed}; passed: {len(rows)-failed}")
    print(f"Source warnings with passing runtime metadata: {warnings}")
    print(f"Report: {OUT.name}")
    return 1 if failed else 0

if __name__ == "__main__": sys.exit(main())