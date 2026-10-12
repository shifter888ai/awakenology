#!/usr/bin/env python3
"""Audit source HTML for broken fragments, duplicate IDs, and basic accessible names.

This is a read-only, informational inventory; dynamic Worker output and browser rendering
must be checked separately.
"""
import argparse
import csv
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://awakenology.space"
OUT = ROOT / "anchor-accessibility-report.csv"
SKIP_DIRS = {".git", "node_modules", ".wrangler", ".venv", "__pycache__"}

def html_files():
    return sorted(p for p in ROOT.rglob("*") if p.is_file()
                  and p.suffix.lower() in {".html", ".htm"}
                  and not any(part in SKIP_DIRS for part in p.parts))

def page_url(source):
    rel = source.relative_to(ROOT).as_posix()
    if rel == "index.html": return DOMAIN + "/"
    if rel.endswith("/index.html"): return DOMAIN + "/" + rel[:-len("index.html")]
    return DOMAIN + "/" + rel

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.images, self.buttons = [], [], [], []
        self._link_stack = []
        self._button_stack = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for key in ("id",):
            if a.get(key): self.ids.append((a[key], tag))
        if tag == "a" and a.get("name"): self.ids.append((a["name"], tag))
        if tag == "img":
            if "alt" not in a: self.images.append((a.get("src", ""), "missing-alt"))
        if tag == "a":
            item = {"href":a.get("href","").strip(),"text":"","label":a.get("aria-label","").strip(),
                    "title":a.get("title","").strip(),"has_image":False,"tag":"a"}
            self._link_stack.append(item)
            if self._link_stack and len(self._link_stack)>1:
                # Nested anchors are invalid HTML; keep each tracked independently.
                pass
        if tag == "img" and self._link_stack and a.get("alt","").strip():
            self._link_stack[-1]["has_image"] = True
        if tag == "button":
            self._button_stack.append({"text":"","label":a.get("aria-label","").strip(),
                                       "title":a.get("title","").strip(),"type":a.get("type","button")})
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag == "a" and self._link_stack:
            self.links.append(self._link_stack.pop())
        if tag == "button" and self._button_stack:
            self.buttons.append(self._button_stack.pop())
    def handle_data(self, data):
        text = data.strip()
        if text:
            for item in self._link_stack: item["text"] += " " + text
            for item in self._button_stack: item["text"] += " " + text

def resolve_page(path):
    path = unquote(path or "/")
    if path == "/": candidates = [ROOT / "index.html"]
    elif path.endswith("/"): candidates = [ROOT / path.lstrip("/") / "index.html"]
    else:
        direct = ROOT / path.lstrip("/")
        candidates = [ROOT / (path.lstrip("/") + "/index.html"), direct, direct / "index.html"]
    for candidate in candidates:
        try: candidate.resolve().relative_to(ROOT.resolve())
        except ValueError: continue
        if candidate.is_file() and candidate.suffix.lower() in {".html",".htm"}: return candidate
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true", help="exit non-zero if any finding exists")
    args = ap.parse_args()
    pages = html_files()
    parsed = {}
    findings = []
    for source in pages:
        parser = PageParser()
        try: parser.feed(source.read_text(encoding="utf-8", errors="replace"))
        except OSError as exc:
            findings.append({"source":source.relative_to(ROOT).as_posix(),"issue":"read-error","severity":"error","reference":"","target":"","detail":str(exc)})
            continue
        counts = Counter(value for value, _ in parser.ids)
        for value, count in counts.items():
            if count > 1:
                findings.append({"source":source.relative_to(ROOT).as_posix(),"issue":"duplicate-id","severity":"warning","reference":"#"+value,"target":source.relative_to(ROOT).as_posix(),"detail":f"ID/name appears {count} times"})
        for src, issue in parser.images:
            findings.append({"source":source.relative_to(ROOT).as_posix(),"issue":issue,"severity":"warning","reference":src,"target":"","detail":"Image has no alt attribute; add descriptive alt text or alt=\"\" if decorative"})
        for link in parser.links:
            if not link["text"].strip() and not link["label"] and not link["title"] and not link["has_image"]:
                findings.append({"source":source.relative_to(ROOT).as_posix(),"issue":"empty-link-name","severity":"warning","reference":link["href"],"target":"","detail":"Link has no detectable text, aria-label, title, or non-empty-alt image"})
            href = link["href"]
            if not href or href.lower().startswith(("mailto:","tel:","javascript:","data:")): continue
            absolute = urljoin(page_url(source), href)
            parts = urlsplit(absolute)
            if parts.scheme not in ("http","https") or parts.netloc.lower() not in {"awakenology.space","www.awakenology.space"}: continue
            if not parts.fragment: continue
            target = source if parts.path == urlsplit(page_url(source)).path else resolve_page(parts.path)
            if target is None:
                # Existing link/asset inventory reports missing target paths separately.
                continue
            target_parser = parser if target == source else parsed.get(target)
            if target_parser is None:
                target_parser = PageParser()
                try: target_parser.feed(target.read_text(encoding="utf-8", errors="replace"))
                except OSError: continue
                parsed[target] = target_parser
            valid_ids = {value for value, _ in target_parser.ids}
            fragment = unquote(parts.fragment)
            if fragment not in valid_ids:
                findings.append({"source":source.relative_to(ROOT).as_posix(),"issue":"broken-fragment","severity":"warning","reference":href,"target":target.relative_to(ROOT).as_posix(),"detail":"Fragment #"+fragment+" not found in target source HTML"})
        for button in parser.buttons:
            if not button["text"].strip() and not button["label"] and not button["title"]:
                findings.append({"source":source.relative_to(ROOT).as_posix(),"issue":"empty-button-name","severity":"warning","reference":"","target":"","detail":"Button has no detectable text, aria-label, or title"})
    fields=["source","issue","severity","reference","target","detail"]
    with OUT.open("w",encoding="utf-8",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=fields); writer.writeheader(); writer.writerows(findings)
    counts=Counter(row["issue"] for row in findings)
    print(f"HTML pages scanned: {len(pages)}; findings: {len(findings)}")
    for issue,count in sorted(counts.items()): print(f"  {issue}: {count}")
    print(f"Report: {OUT.name}")
    for row in findings[:35]:
        print(f'{row["issue"]}: {row["source"]} -> {row["reference"]} ({row["detail"]})')
    if len(findings)>35: print(f"... plus {len(findings)-35} more; see CSV report")
    return 1 if args.strict and findings else 0

if __name__ == "__main__": sys.exit(main())
