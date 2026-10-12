#!/usr/bin/env python3
"""Read-only rendered accessibility smoke audit for Awakenology production routes."""
import argparse
import asyncio
import csv
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://awakenology.space"
SITEMAP = DOMAIN + "/sitemap.xml"
OUT = ROOT / "browser-accessibility-report.csv"
UA = "Awakenology-Rendered-Accessibility-Audit/1.0 (+https://awakenology.space/)"

def get_routes():
    req = urllib.request.Request(SITEMAP, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as response:
        root = ET.fromstring(response.read())
    return sorted({node.text.strip() for node in root.iter()
                   if node.tag.rsplit("}", 1)[-1] == "loc" and node.text
                   and urlparse(node.text.strip()).scheme == "https"
                   and urlparse(node.text.strip()).netloc.lower() == "awakenology.space"})

def classify_language(value):
    value = (value or "").strip().lower()
    if not value:
        return "missing"
    if value.startswith("en"): return "en"
    if value.startswith("ja"): return "ja"
    if value.startswith(("zh", "cmn")): return "zh"
    return "other"

async def inspect(browser, url, semaphore, width=1365, height=900):
    async with semaphore:
        page = await browser.new_page(viewport={"width": width, "height": height})
        findings = []
        def add(check, detail, severity="warning"):
            findings.append({"url":url,"viewport":f"{width}x{height}","check":check,
                             "severity":severity,"detail":str(detail)[:500]})
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(350)
            if response is None or response.status >= 400:
                add("page-response", f"HTTP {response.status if response else 'no response'}", "high")
            facts = await page.evaluate("""() => {
              const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
              const name = el => (el.getAttribute('aria-label') || el.getAttribute('title') ||
                el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
              const controls = Array.from(document.querySelectorAll('button, input, select, textarea, [role="button"], [role="link"]'))
                .filter(visible).filter(el => !name(el) && !(el.labels && Array.from(el.labels).some(l => l.innerText.trim())));
              const images = Array.from(document.images).filter(visible)
                .filter(el => !el.hasAttribute('alt'));
              const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(visible).map(el => Number(el.tagName.slice(1)));
              const badHeadingJumps = [];
              for (let i=1;i<headings.length;i++) if (headings[i] > headings[i-1]+1) badHeadingJumps.push(headings[i-1]+'→'+headings[i]);
              return {
                title: document.title.trim(),
                lang: document.documentElement.getAttribute('lang') || '',
                mainCount: document.querySelectorAll('main, [role="main"]').length,
                unlabeledControls: controls.map(el => el.outerHTML.slice(0,220)),
                imagesWithoutAlt: images.map(el => el.outerHTML.slice(0,220)),
                headingJumps: badHeadingJumps,
                focusableCount: document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])').length
              };
            }""")
            if not facts["title"]: add("missing-title", "Rendered document title is empty", "high")
            if not facts["lang"]: add("missing-document-language", "HTML element has no lang attribute", "high")
            elif classify_language(facts["lang"]) == "other":
                add("unrecognized-document-language", f"lang={facts['lang']!r}")
            if facts["mainCount"] != 1:
                add("main-landmark-count", f"Expected exactly one main landmark; found {facts['mainCount']}")
            for item in facts["imagesWithoutAlt"]:
                add("visible-image-missing-alt", item)
            for item in facts["unlabeledControls"]:
                add("visible-control-missing-name", item)
            for item in facts["headingJumps"]:
                add("heading-level-skip", item, "info")
            if facts["focusableCount"] == 0:
                add("no-focusable-controls", "No links or interactive controls detected", "info")
            # Keyboard smoke check: tab focus should land on a visible element when controls exist.
            if facts["focusableCount"]:
                await page.keyboard.press("Tab")
                focus = await page.evaluate("""() => {
                  const el = document.activeElement;
                  return {tag: el ? el.tagName.toLowerCase() : '', text: el ? (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0,120) : '',
                    body: el === document.body, visible: !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)};
                }""")
                if focus["body"] or not focus["visible"]:
                    add("keyboard-first-focus", f"Tab did not focus a visible element: {focus}")
        except Exception as exc:
            add("browser-audit-error", repr(exc), "high")
        finally:
            await page.close()
        return findings

async def run(routes, workers, max_routes):
    targets = routes[:max_routes] if max_routes else routes
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        sem = asyncio.Semaphore(max(1, min(workers, 8)))
        results = await asyncio.gather(*(inspect(browser, url, sem) for url in targets))
        await browser.close()
    return targets, [row for group in results for row in group]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--max-routes", type=int, default=0, help="optional cap for local smoke tests")
    args = ap.parse_args()
    routes = get_routes()
    targets, findings = asyncio.run(run(routes, args.workers, args.max_routes))
    fields = ["url","viewport","check","severity","detail"]
    with OUT.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(findings)
    print(f"Rendered accessibility routes: {len(targets)}; findings: {len(findings)}; report: {OUT.name}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
