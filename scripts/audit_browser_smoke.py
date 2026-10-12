#!/usr/bin/env python3
"""Browser smoke audit for the published sitemap using Playwright.

This is an informational production check. It does not change website content.
"""
import argparse
import asyncio
import csv
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://awakenology.space"
SITEMAP = DOMAIN + "/sitemap.xml"
REPORT = ROOT / "browser-smoke-report.csv"
SCREENSHOT_DIR = ROOT / "browser-smoke-screenshots"
UA = "Awakenology-Browser-Smoke-Audit/1.0 (+https://awakenology.space/)"

def get_routes():
    request = urllib.request.Request(SITEMAP, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=20) as response:
        data = response.read()
    root = ET.fromstring(data)
    routes = []
    for node in root.iter():
        if node.tag.rsplit("}", 1)[-1] == "loc" and node.text:
            url = node.text.strip()
            parts = urlparse(url)
            if parts.scheme == "https" and parts.netloc.lower() == "awakenology.space":
                routes.append(url)
    return sorted(set(routes))

def language_route(url):
    path = urlparse(url).path.lower()
    if path == "/": return True
    return any(token in path for token in ("/english/", "/japanese/", "/chinese/", "/日本語/", "/中文/", "/繁體中文/", "/简体中文/"))

async def inspect_route(browser, url, semaphore, viewport, screenshot=False):
    async with semaphore:
        page = await browser.new_page(viewport=viewport, device_scale_factor=1)
        rows, console_errors, page_errors, failed_requests = [], [], [], []
        host = urlparse(url).netloc.lower()
        page.on("console", lambda msg: console_errors.append(msg.text[:400]) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: page_errors.append(str(exc)[:400]))
        page.on("requestfailed", lambda req: failed_requests.append(req.url) if urlparse(req.url).netloc.lower() == host else None)
        page.on("response", lambda response: rows.append({"url":url,"viewport":f'{viewport["width"]}x{viewport["height"]}',"check":"same-host-http-error","status":str(response.status),"detail":response.url[:500]}) if urlparse(response.url).netloc.lower() == host and response.status >= 400 else None)
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(500)
            facts = await page.evaluate("""() => ({
              title: document.title || '',
              lang: document.documentElement.getAttribute('lang') || '',
              horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
              images: Array.from(document.images).map(i => ({src:i.currentSrc||i.src, complete:i.complete, width:i.naturalWidth})),
              themeButton: !!document.querySelector('#awakenology-theme-toggle'),
              returnTopButton: !!document.querySelector('#awakenology-return-top')
            })""")
            if response is None:
                rows.append({"url":url,"viewport":f'{viewport["width"]}x{viewport["height"]}',"check":"navigation","status":"","detail":"No main-document response"})
            elif response.status >= 400:
                rows.append({"url":url,"viewport":f'{viewport["width"]}x{viewport["height"]}',"check":"page-http-status","status":str(response.status),"detail":"Main document response"})
            if not facts["title"].strip():
                rows.append({"url":url,"viewport":f'{viewport["width"]}x{viewport["height"]}',"check":"missing-document-title","status":"warning","detail":"Browser-rendered document has no title"})
            if not facts["lang"].strip():
                rows.append({"url":url,"viewport":f'{viewport["width"]}x{viewport["height"]}',"check":"missing-document-lang","status":"warning","detail":"Browser-rendered html element has no lang"})
            if facts["horizontalOverflow"]:
                rows.append({"url":url,"viewport":f'{viewport["width"]}x{viewport["height"]}',"check":"horizontal-overflow","status":"warning","detail":"Document scroll width exceeds viewport"})
            for img in facts["images"]:
                if img["complete"] and img["src"] and img["width"] == 0:
                    rows.append({"url":url,"viewport":f'{viewport["width"]}x{viewport["height"]}',"check":"broken-rendered-image","status":"warning","detail":img["src"][:500]})
            for err in sorted(set(failed_requests)):
                rows.append({"url":url,"viewport":f'{viewport["width"]}x{viewport["height"]}',"check":"same-host-request-failed","status":"warning","detail":err[:500]})
            for err in sorted(set(page_errors)):
                rows.append({"url":url,"viewport":f'{viewport["width"]}x{viewport["height"]}',"check":"javascript-exception","status":"warning","detail":err})
            for err in sorted(set(console_errors)):
                rows.append({"url":url,"viewport":f'{viewport["width"]}x{viewport["height"]}',"check":"console-error","status":"info","detail":err})
            if screenshot:
                SCREENSHOT_DIR.mkdir(exist_ok=True)
                slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", urlparse(url).path.strip("/") or "home")[:70]
                await page.screenshot(path=str(SCREENSHOT_DIR / f"{slug}-{viewport['width']}.png"), full_page=True, animations="disabled")
            if viewport["width"] <= 430 and facts["themeButton"]:
                await page.locator("#awakenology-theme-toggle").click(timeout=3000)
                theme = await page.locator("html").get_attribute("data-aw-theme")
                if theme not in ("dark", "light"):
                    rows.append({"url":url,"viewport":f'{viewport["width"]}x{viewport["height"]}',"check":"theme-toggle","status":"warning","detail":f"Unexpected theme state after click: {theme}"})
        except Exception as exc:
            rows.append({"url":url,"viewport":f'{viewport["width"]}x{viewport["height"]}',"check":"browser-navigation-error","status":"error","detail":str(exc)[:500]})
        finally:
            await page.close()
        return rows

async def run(routes, workers, max_routes, screenshots):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        semaphore = asyncio.Semaphore(max(1, min(workers, 8)))
        targets = routes[:max_routes] if max_routes else routes
        tasks = [inspect_route(browser, url, semaphore, {"width":1365,"height":900},
                               screenshot=screenshots and url == DOMAIN + "/") for url in targets]
        mobile_targets = [u for u in targets if language_route(u)]
        # Keep the mobile pass representative and bounded while every sitemap route gets a desktop pass.
        for url in mobile_targets[:12]:
            tasks.append(inspect_route(browser, url, semaphore, {"width":390,"height":844},
                                       screenshot=screenshots and (url == DOMAIN + "/" or len(tasks) < 3)))
        results = await asyncio.gather(*tasks)
        await browser.close()
    return [row for group in results for row in group], len(targets), len(mobile_targets[:12])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--max-routes", type=int, default=0, help="optional route cap for local smoke tests")
    parser.add_argument("--screenshots", action="store_true", help="save homepage/representative mobile screenshots")
    args = parser.parse_args()
    routes = get_routes()
    findings, desktop_count, mobile_count = asyncio.run(run(routes, args.workers, args.max_routes, args.screenshots))
    fields = ["url","viewport","check","status","detail"]
    with REPORT.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(findings)
    counts = {}
    for row in findings:
        counts[row["check"]] = counts.get(row["check"], 0) + 1
    print(f"Sitemap routes: {len(routes)}; desktop checked: {desktop_count}; representative mobile checked: {mobile_count}")
    print(f"Browser findings: {len(findings)}; report: {REPORT.name}")
    for check, count in sorted(counts.items()):
        print(f"  {check}: {count}")
    return 0

if __name__ == "__main__":
    main()
