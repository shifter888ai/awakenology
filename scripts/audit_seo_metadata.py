#!/usr/bin/env python3
"""Read-only SEO metadata inventory. Run: python3 scripts/audit_seo_metadata.py"""
import collections
import csv
import html
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "seo-metadata-report.csv"

class HeadParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_head = False
        self.in_title = False
        self.titles = []
        self.descriptions = []
        self.canonicals = []
        self.open_graph = collections.defaultdict(list)
        self.lang = ""
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang", "")
        if tag == "head":
            self.in_head = True
        if not self.in_head:
            return
        if tag == "title":
            self.in_title = True
            self.titles.append("")
        if tag == "meta" and a.get("name", "").lower() == "description":
            self.descriptions.append(a.get("content", "").strip())
        if tag == "link" and "canonical" in a.get("rel", "").lower().split():
            self.canonicals.append(a.get("href", "").strip())
        if tag == "meta" and a.get("property", "").lower().startswith("og:"):
            self.open_graph[a["property"].lower()].append(a.get("content", "").strip())
    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "head":
            self.in_head = False
    def handle_data(self, data):
        if self.in_title and self.titles:
            self.titles[-1] += data

def normalize(s):
    s = html.unescape(s).strip()
    for prefix in ("Awakenology - ", "催醒法 - "):
        if s.startswith(prefix):
            s = s[len(prefix):]
    if s.endswith(" | Awakenology"):
        s = s[:-len(" | Awakenology")]
    return " ".join(s.split()).casefold()

def page_scope(relative):
    """Classify private tools separately from public SEO pages."""
    if relative == "404.html":
        return "special-404"
    if relative == "ai-search/index.html":
        return "special-ai-search"
    if relative.startswith(("editor/", "github-editor/")):
        return "special-editor"
    return "normal"

rows = []
for path in sorted(ROOT.rglob("*.html")):
    if any(part in (".git", "node_modules") for part in path.parts):
        continue
    relative = path.relative_to(ROOT).as_posix()
    scope = page_scope(relative)
    parser = HeadParser()
    parser.feed(path.read_text(encoding="utf-8"))
    title = parser.titles[0].strip() if parser.titles else ""
    desc = parser.descriptions[0] if parser.descriptions else ""
    flags = []
    if not title:
        flags.append("missing-title")
    if len(parser.titles) > 1:
        flags.append("duplicate-title")
    if not desc and scope == "normal":
        flags.append("missing-description")
    if len(parser.descriptions) > 1:
        flags.append("duplicate-description")
    if desc and normalize(desc) == normalize(title):
        flags.append("title-only-description")
    if scope == "normal":
        if not parser.canonicals or not parser.canonicals[0]:
            flags.append("missing-canonical")
        if len(parser.canonicals) > 1:
            flags.append("duplicate-canonical")
    for prop, values in sorted(parser.open_graph.items()):
        if len(values) > 1:
            flags.append("duplicate-" + prop)
        if any(not value for value in values):
            flags.append("empty-" + prop)
    for prop in ("og:url", "og:image"):
        for value in parser.open_graph.get(prop, []):
            parsed = urlparse(value)
            if value and (parsed.scheme not in ("http", "https") or not parsed.netloc):
                flags.append("nonabsolute-" + prop)
    rows.append(dict(path=relative, scope=scope, lang=parser.lang, title=title,
                     description=desc, title_count=len(parser.titles),
                     description_count=len(parser.descriptions),
                     canonical=parser.canonicals[0] if parser.canonicals else "",
                     canonical_count=len(parser.canonicals),
                     og_title_count=len(parser.open_graph.get("og:title", [])),
                     og_description_count=len(parser.open_graph.get("og:description", [])),
                     og_url_count=len(parser.open_graph.get("og:url", [])),
                     og_image_count=len(parser.open_graph.get("og:image", [])),
                     flags=";".join(flags)))
with OUT.open("w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
normal = [r for r in rows if r["scope"] == "normal"]
counts = collections.Counter(flag for r in normal for flag in r["flags"].split(";") if flag)
print(f"HTML files: {len(rows)}; normal pages: {len(normal)}; special pages: {len(rows)-len(normal)}")
print("Normal-page flags:", dict(sorted(counts.items())))
for r in normal:
    if r["flags"]:
        print(f'{r["path"]}: {r["flags"]}')
print(f"Full report: {OUT.name}")
