#!/usr/bin/env python3
"""Read-only SEO metadata inventory. Run: python3 scripts/audit_seo_metadata.py"""
import collections
import csv
import html
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "seo-metadata-report.csv"

class HeadParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_head = False
        self.in_title = False
        self.titles = []
        self.descriptions = []
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

rows = []
for path in sorted(ROOT.rglob("*.html")):
    if any(part in (".git", "node_modules") for part in path.parts):
        continue
    relative = path.relative_to(ROOT).as_posix()
    if relative == "404.html":
        scope = "special-404"
    elif relative == "ai-search/index.html":
        scope = "special-ai-search"
    else:
        scope = "normal"
    parser = HeadParser()
    parser.feed(path.read_text(encoding="utf-8"))
    title = parser.titles[0].strip() if parser.titles else ""
    desc = parser.descriptions[0] if parser.descriptions else ""
    flags = []
    if not title:
        flags.append("missing-title")
    if len(parser.titles) > 1:
        flags.append("duplicate-title")
    if not desc:
        flags.append("missing-description")
    if len(parser.descriptions) > 1:
        flags.append("duplicate-description")
    if desc and normalize(desc) == normalize(title):
        flags.append("title-only-description")
    rows.append(dict(path=relative, scope=scope, lang=parser.lang, title=title,
                     description=desc, title_count=len(parser.titles),
                     description_count=len(parser.descriptions),
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
