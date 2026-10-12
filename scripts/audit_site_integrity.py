#!/usr/bin/env python3
"""Inventory local HTML/CSS links and asset references without changing site files.

Run: python3 scripts/audit_site_integrity.py
Add --strict to return a non-zero status when broken references are found.
"""
import argparse
import csv
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://awakenology.space"
OUT = ROOT / "site-integrity-report.csv"
SKIP_DIRS = {".git", "node_modules", ".wrangler", ".venv", "__pycache__"}
ASSET_EXTENSIONS = {".css", ".js", ".mjs", ".png", ".jpg", ".jpeg", ".gif", ".webp",
                    ".avif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".otf",
                    ".pdf", ".mp4", ".webm", ".mp3", ".wav", ".json", ".xml"}
CSS_URL = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.IGNORECASE)
CSS_IMPORT = re.compile(r"@import\s+(?:url\()?\s*(['\"])(.*?)\1", re.IGNORECASE)

class RefParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []
        self.inline_css = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for attr in ("href", "src", "poster", "data-src", "data-original"):
            value = a.get(attr, "").strip()
            if value:
                kind = "asset" if attr != "href" or tag in {"link"} and (
                    any(x in a.get("rel", "").lower().split() for x in ("stylesheet", "icon", "preload", "manifest"))
                    or Path(urlsplit(value).path).suffix.lower() in ASSET_EXTENSIONS
                ) else "link"
                self.refs.append((kind, tag, attr, value))
        if a.get("srcset"):
            for item in a["srcset"].split(","):
                value = item.strip().split(" ")[0]
                if value: self.refs.append(("asset", tag, "srcset", value))
        if a.get("style"):
            self.inline_css.append(a["style"])
    def handle_data(self, data):
        # HTMLParser does not identify style-block context reliably after nested markup;
        # CSS in style blocks is collected by a small stateful subclass below.
        pass

class HtmlRefs(RefParser):
    def __init__(self):
        super().__init__()
        self.in_style = False
    def handle_starttag(self, tag, attrs):
        if tag == "style": self.in_style = True
        super().handle_starttag(tag, attrs)
    def handle_endtag(self, tag):
        if tag == "style": self.in_style = False
    def handle_data(self, data):
        if self.in_style: self.inline_css.append(data)

def all_files():
    for path in ROOT.rglob("*"):
        if not path.is_file() or any(part in SKIP_DIRS for part in path.parts):
            continue
        yield path

def canonical_page_url(source):
    rel = source.relative_to(ROOT).as_posix()
    if rel == "index.html": return DOMAIN + "/"
    if rel.endswith("/index.html"): return DOMAIN + "/" + rel[:-len("index.html")]
    return DOMAIN + "/" + rel

def local_target(value, base_url, source_file, kind):
    value = value.strip()
    if not value or value.startswith(("#", "data:", "javascript:", "mailto:", "tel:", "sms:")):
        return None, "SKIP", ""
    absolute = urljoin(base_url, value)
    parts = urlsplit(absolute)
    if parts.scheme not in ("http", "https"):
        return None, "SKIP", ""
    if parts.netloc.lower() not in {"awakenology.space", "www.awakenology.space"}:
        return None, "EXTERNAL", absolute
    path = unquote(parts.path or "/")
    if kind == "asset":
        rel = path.lstrip("/") or "index.html"
        target = (ROOT / rel).resolve()
        try: target.relative_to(ROOT.resolve())
        except ValueError: return None, "BROKEN", "path-escapes-root"
        if target.is_file(): return target, "PASS", target.relative_to(ROOT).as_posix()
        return target, "BROKEN", rel
    # Page links may point to a directory route, a file, or a legacy extensionless route.
    if path == "/": candidates = [ROOT / "index.html"]
    elif path.endswith("/"): candidates = [ROOT / path.lstrip("/") / "index.html"]
    else:
        direct = ROOT / path.lstrip("/")
        candidates = [direct, direct / "index.html", ROOT / (path.lstrip("/") + "/index.html")]
        if not Path(path).suffix: candidates = [ROOT / (path.lstrip("/") + "/index.html"), direct]
    for target in candidates:
        try: target.resolve().relative_to(ROOT.resolve())
        except ValueError: continue
        if target.is_file() and target.suffix.lower() in {".html", ".htm"}:
            return target, "PASS", target.relative_to(ROOT).as_posix()
        if target.is_file() and target.suffix.lower() not in {".html", ".htm"}:
            return target, "PASS", target.relative_to(ROOT).as_posix()
    return None, "BROKEN", path

def css_references(css):
    found = [(m.group(2).strip(), "css-url") for m in CSS_URL.finditer(css)]
    found.extend((m.group(2).strip(), "css-import") for m in CSS_IMPORT.finditer(css))
    return found

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true", help="exit non-zero if broken local references exist")
    args = ap.parse_args()
    files = list(all_files())
    html_files = [p for p in files if p.suffix.lower() in {".html", ".htm"}]
    rows = []
    for source in html_files:
        base_url = canonical_page_url(source)
        parser = HtmlRefs()
        try: parser.feed(source.read_text(encoding="utf-8", errors="replace"))
        except OSError as exc:
            rows.append({"source":source.relative_to(ROOT).as_posix(),"kind":"html","tag":"","attribute":"","reference":"","target":"","status":"READ_ERROR","detail":str(exc)})
            continue
        refs = list(parser.refs)
        for css in parser.inline_css:
            refs.extend(("asset", "style", "css", value) for value, _ in css_references(css))
        for kind, tag, attr, value in refs:
            target, status, detail = local_target(value, base_url, source, kind)
            if status in {"SKIP", "EXTERNAL"}: continue
            rows.append({"source":source.relative_to(ROOT).as_posix(),"kind":kind,"tag":tag,"attribute":attr,"reference":value,"target":detail,"status":status,"detail":""})
    for source in [p for p in files if p.suffix.lower() == ".css"]:
        try: text = source.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            rows.append({"source":source.relative_to(ROOT).as_posix(),"kind":"css","tag":"","attribute":"","reference":"","target":"","status":"READ_ERROR","detail":str(exc)})
            continue
        base_url = DOMAIN + "/" + source.relative_to(ROOT).as_posix()
        for value, ref_kind in css_references(text):
            target, status, detail = local_target(value, base_url, source, "asset")
            if status in {"SKIP", "EXTERNAL"}: continue
            rows.append({"source":source.relative_to(ROOT).as_posix(),"kind":ref_kind,"tag":"css","attribute":"url","reference":value,"target":detail,"status":status,"detail":""})
    fields = ["source","kind","tag","attribute","reference","target","status","detail"]
    with OUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields); writer.writeheader(); writer.writerows(rows)
    broken = [r for r in rows if r["status"] in {"BROKEN", "READ_ERROR"}]
    checked = sum(r["status"] in {"PASS", "BROKEN", "READ_ERROR"} for r in rows)
    print(f"HTML pages scanned: {len(html_files)}; local references checked: {checked}; broken/read errors: {len(broken)}")
    print(f"Report: {OUT.name}")
    for row in broken[:50]:
        print(f'{row["status"]}: {row["source"]} -> {row["reference"]} ({row["target"]})')
    if len(broken) > 50: print(f"... plus {len(broken)-50} more; see CSV report")
    return 1 if args.strict and broken else 0

if __name__ == "__main__": sys.exit(main())
