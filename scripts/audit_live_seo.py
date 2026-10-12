#!/usr/bin/env python3
"""Read-only production SEO audit. Run after audit_seo_metadata.py."""
import collections, csv, sys, time, urllib.error, urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://awakenology.space"
OUT = ROOT / "seo-runtime-report.csv"
UA = "Awakenology-SEO-Audit/1.0 (+https://awakenology.space/)"

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

def main():
    try:
        root = ET.parse(ROOT / "sitemap.xml").getroot()
        urls = [n.text.strip() for n in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc") if n.text]
    except (OSError, ET.ParseError) as e:
        print(f"FAIL: sitemap.xml: {e}"); return 1
    ai = DOMAIN + "/ai-search/"
    if ai not in urls: urls.append(ai)
    source_file = ROOT / "seo-metadata-report.csv"
    source = {}
    if source_file.exists():
        with source_file.open(encoding="utf-8", newline="") as f:
            source = {r["path"]: r.get("flags", "") for r in csv.DictReader(f)}
    opener, rows = urllib.request.build_opener(), []
    for i, url in enumerate(urls, 1):
        errors, status, title, desc, canonical, robots, lang = [], "", "", "", "", "", ""
        path = urlsplit(url).path or "/"
        is_ai = path.rstrip("/") == "/ai-search"
        source_path = "index.html" if path == "/" else path.lstrip("/") + "index.html"
        expected = DOMAIN + (path if path.endswith("/") or path == "/" else path + "/")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with opener.open(req, timeout=20) as res:
                status, final, ctype = res.status, res.geturl(), res.headers.get("Content-Type", "")
                charset = res.headers.get_content_charset() or "utf-8"
                raw = res.read(3000000)
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
