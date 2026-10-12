#!/usr/bin/env python3
"""Browser smoke audit for the published sitemap using Playwright.

Informational production checks only; this script never changes website content.
"""
import argparse
import asyncio
import csv
import re
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://awakenology.space"
SITEMAP = DOMAIN + "/sitemap.xml"
REPORT = ROOT / "browser-smoke-report.csv"
SCREENSHOT_DIR = ROOT / "browser-smoke-screenshots"
UA = "Awakenology-Browser-Smoke-Audit/1.0 (+https://awakenology.space/)"
MOBILE_VIEWPORT = {"width": 390, "height": 844}
DESKTOP_VIEWPORT = {"width": 1365, "height": 900}

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

def route_language(url):
    path = urlparse(url).path.lower()
    if path == "/":
        return "home"
    if any(token in path for token in ("/english/", "/en/", "/en-", "/en_")):
        return "en"
    if any(token in path for token in ("/japanese/", "/日本語/", "/ja/", "/ja-", "/ja_")):
        return "ja"
    if any(token in path for token in ("/chinese/", "/中文/", "/繁體中文/", "/简体中文/", "/zh/", "/zh-", "/zh_")):
        return "zh"
    return "other"

def select_mobile_routes(routes, limit=12):
    """Choose the homepage and spread the remaining sample across language buckets."""
    routes = sorted(set(routes))
    if not routes or limit <= 0:
        return []
    selected = []
    home = next((url for url in routes if urlparse(url).path == "/"), None)
    if home:
        selected.append(home)
    buckets = defaultdict(list)
    for url in routes:
        if url != home:
            buckets[route_language(url)].append(url)
    preferred = ["en", "ja", "zh", "other", "home"]
    for language in preferred:
        bucket = buckets.get(language, [])
        if bucket and len(selected) < limit:
            selected.append(bucket[len(bucket) // 2])
    # Spread remaining slots across remaining routes instead of taking the first alphabetically.
    remaining = [u for u in routes if u not in selected]
    slots = limit - len(selected)
    if slots > 0 and remaining:
        for i in range(min(slots, len(remaining))):
            selected.append(remaining[min(len(remaining)-1, int((i + 0.5) * len(remaining) / min(slots, len(remaining))))])
    return list(dict.fromkeys(selected))[:limit]

def finding(url, viewport, check, status="warning", detail=""):
    return {"url":url, "viewport":f'{viewport["width"]}x{viewport["height"]}',
            "check":check, "status":status, "detail":str(detail)[:500]}

async def inspect_route(browser, url, semaphore, viewport, screenshot=False, interactions=False):
    async with semaphore:
        context = await browser.new_context(viewport=viewport, device_scale_factor=1)
        page = await context.new_page()
        rows, console_errors, page_errors, failed_requests = [], [], [], []
        host = urlparse(url).netloc.lower()
        page.on("console", lambda msg: console_errors.append(msg.text[:400]) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: page_errors.append(str(exc)[:400]))
        page.on("requestfailed", lambda req: failed_requests.append(req.url) if urlparse(req.url).netloc.lower() == host else None)
        page.on("response", lambda response: rows.append(finding(url, viewport, "same-host-http-error", str(response.status), response.url)) if urlparse(response.url).netloc.lower() == host and response.status >= 400 else None)
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(500)
            facts = await page.evaluate("""() => ({
              title: document.title || '',
              lang: document.documentElement.getAttribute('lang') || '',
              horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
              images: Array.from(document.images).map(i => ({src:i.currentSrc||i.src, complete:i.complete, width:i.naturalWidth})),
              themeButton: !!document.querySelector('#awakenology-theme-toggle'),
              theme: document.documentElement.getAttribute('data-aw-theme') || '',
              returnTopButton: !!document.querySelector('#awakenology-return-top'),
              chineseButton: !!document.querySelector('#awakenology-cn-toggle')
            })""")
            if response is None:
                rows.append(finding(url, viewport, "navigation", "error", "No main-document response"))
            elif response.status >= 400:
                rows.append(finding(url, viewport, "page-http-status", str(response.status), "Main document response"))
            if not facts["title"].strip():
                rows.append(finding(url, viewport, "missing-document-title", "warning", "Rendered document has no title"))
            if not facts["lang"].strip():
                rows.append(finding(url, viewport, "missing-document-lang", "warning", "Rendered html element has no lang"))
            if facts["horizontalOverflow"]:
                rows.append(finding(url, viewport, "horizontal-overflow", "warning", "Document scroll width exceeds viewport"))
            for img in facts["images"]:
                if img["complete"] and img["src"] and img["width"] == 0:
                    rows.append(finding(url, viewport, "broken-rendered-image", "warning", img["src"]))
            for err in sorted(set(failed_requests)):
                rows.append(finding(url, viewport, "same-host-request-failed", "warning", err))
            for err in sorted(set(page_errors)):
                rows.append(finding(url, viewport, "javascript-exception", "warning", err))
            for err in sorted(set(console_errors)):
                rows.append(finding(url, viewport, "console-error", "info", err))
            if screenshot:
                SCREENSHOT_DIR.mkdir(exist_ok=True)
                slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", urlparse(url).path.strip("/") or "home")[:70]
                await page.screenshot(path=str(SCREENSHOT_DIR / f"{slug}-{viewport['width']}.png"), full_page=True, animations="disabled")
            if interactions and viewport["width"] <= 430:
                theme_locator = page.locator("#awakenology-theme-toggle")
                if await theme_locator.count():
                    before = await page.locator("html").get_attribute("data-aw-theme")
                    await theme_locator.click(timeout=3000)
                    await page.wait_for_timeout(100)
                    after = await page.locator("html").get_attribute("data-aw-theme")
                    if before not in ("dark", "light") or after not in ("dark", "light") or before == after:
                        rows.append(finding(url, viewport, "theme-toggle-no-state-change", "warning", f"before={before!r}; after={after!r}"))
                    else:
                        await page.reload(wait_until="domcontentloaded", timeout=30000)
                        persisted = await page.locator("html").get_attribute("data-aw-theme")
                        if persisted != after:
                            rows.append(finding(url, viewport, "theme-preference-not-persisted", "warning", f"expected={after!r}; got={persisted!r}"))
                else:
                    rows.append(finding(url, viewport, "theme-toggle-missing", "warning", "Global theme toggle was not found in the mobile DOM"))
                top_locator = page.locator("#awakenology-return-top")
                if await top_locator.count():
                    await page.evaluate("window.scrollTo(0, Math.max(1000, document.documentElement.scrollHeight))")
                    await page.wait_for_timeout(100)
                    visible = await top_locator.is_visible()
                    if not visible:
                        rows.append(finding(url, viewport, "return-top-not-visible-after-scroll", "warning", "Return-to-top control did not become visible after scrolling"))
                    else:
                        await top_locator.click(timeout=3000)
                        await page.wait_for_timeout(300)
                        scroll_y = await page.evaluate("window.scrollY")
                        if scroll_y > 80:
                            rows.append(finding(url, viewport, "return-top-click-failed", "warning", f"Scroll position after click: {scroll_y}"))
                if route_language(url) == "zh":
                    await page.wait_for_timeout(1200)
                    cn_locator = page.locator("#awakenology-cn-toggle")
                    if not await cn_locator.count():
                        rows.append(finding(url, viewport, "chinese-variant-toggle-missing", "warning", "Chinese variant toggle not found after waiting for initialization"))
                    else:
                        old_lang = await page.locator("html").get_attribute("lang")
                        await cn_locator.click(timeout=3000)
                        await page.wait_for_timeout(200)
                        new_lang = await page.locator("html").get_attribute("lang")
                        if old_lang and new_lang == old_lang:
                            rows.append(finding(url, viewport, "chinese-variant-toggle-no-change", "warning", f"Language remained {new_lang!r} after toggle"))
        except Exception as exc:
            rows.append(finding(url, viewport, "browser-navigation-error", "error", exc))
        finally:
            await context.close()
        return rows

async def run(routes, workers, max_routes, screenshots):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        semaphore = asyncio.Semaphore(max(1, min(workers, 8)))
        targets = routes[:max_routes] if max_routes else routes
        mobile_targets = select_mobile_routes(targets, 12)
        tasks = [inspect_route(browser, url, semaphore, DESKTOP_VIEWPORT,
                               screenshot=screenshots and url == DOMAIN + "/", interactions=False)
                 for url in targets]
        tasks.extend(inspect_route(browser, url, semaphore, MOBILE_VIEWPORT,
                                   screenshot=screenshots and (url == DOMAIN + "/" or route_language(url) in {"en","ja","zh"}),
                                   interactions=True)
                     for url in mobile_targets)
        results = await asyncio.gather(*tasks)
        await browser.close()
    return [row for group in results for row in group], len(targets), len(mobile_targets)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--max-routes", type=int, default=0, help="optional route cap for local smoke tests")
    parser.add_argument("--screenshots", action="store_true", help="save homepage and representative mobile screenshots")
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
