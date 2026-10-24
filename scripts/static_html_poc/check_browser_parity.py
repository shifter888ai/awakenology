"""Observation-only Chromium parity gate; generated HTML is never deployed."""
import asyncio
import json
import difflib
from pathlib import Path
from urllib.parse import quote
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from check_real_pages import FIXTURES, ROOT
from html_transformer import transform
from page_rules import SITE

VIEWPORTS = {"desktop": (1440, 900), "iphone": (390, 844)}
JS = """() => {
 const node = document.querySelector('article.article, .article, main');
 if (!node) throw new Error('Missing article/main');
 const rect = node.getBoundingClientRect();
 const imgs = [...node.querySelectorAll('img')];
 const semantic = n => n.nodeType === 3 ? (n.textContent.trim() ? ["text", n.textContent] : null) :
   n.nodeType === 1 ? [n.tagName.toLowerCase(), [...n.attributes].map(a => [a.name, a.value]).sort((a,b) => a[0].localeCompare(b[0])), [...n.childNodes].map(semantic).filter(x => x !== null)] : null;
 return {
   article: JSON.stringify(semantic(node)),
   text: node.textContent.replace(/\\s+/g, " ").trim(),
   images: imgs.map(x => [x.getAttribute('src'), x.getAttribute('alt'), x.getAttribute('width'), x.getAttribute('height'), x.getAttribute('style')]),
   brokenImages: imgs.filter(x => x.complete && x.naturalWidth === 0).map(x => x.getAttribute('src')),
   title: document.title,
   bodyClasses: [...document.body.classList].sort(),
   footer: document.querySelector('footer') ? JSON.stringify(semantic(document.querySelector('footer'))) : null,
   horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
   mainVisible: rect.width > 0 && rect.height > 0,
   theme: document.documentElement.getAttribute('data-theme'),
   links: [...document.querySelectorAll('header a[href], nav a[href]')].map(x => [x.textContent.trim(), x.getAttribute('href')]),
 };
}"""

async def snapshot(browser, html, url, width, height, label, output):
    context = await browser.new_context(viewport={"width": width, "height": height},
                                        device_scale_factor=1, color_scheme="dark",
                                        reduced_motion="reduce")
    await context.add_init_script("localStorage.setItem('awakenology-theme','dark')")
    page = await context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    try:
        if html is None:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=45000)
            if response is None or response.status != 200:
                raise AssertionError(f"{label}: live HTTP status not 200")
        else:
            # Fulfill only the requested document at its real origin; assets remain live.
            # Unlike set_content(), this gives localStorage and same-origin scripts a valid origin.
            await page.route(url, lambda route: route.fulfill(status=200, content_type="text/html; charset=utf-8", body=html))
            response = await page.goto(url, wait_until="domcontentloaded", timeout=45000)
            if response is None or response.status != 200:
                raise AssertionError(f"{label}: generated document did not load")
        await page.wait_for_timeout(1200)
        data = await page.evaluate(JS)
        theme_button = page.locator("#awakenology-theme-toggle")
        if await theme_button.count() != 1:
            raise AssertionError(f"{label}: missing unique theme toggle")
        initial = await page.locator("html").get_attribute("data-aw-theme")
        await theme_button.click()
        switched = await page.locator("html").get_attribute("data-aw-theme")
        saved = await page.evaluate("localStorage.getItem('awakenology-theme')")
        await theme_button.click()
        restored = await page.locator("html").get_attribute("data-aw-theme")
        if (initial, switched, saved, restored) != ("dark", "light", "light", "dark"):
            raise AssertionError(f"{label}: theme round-trip failed: {initial, switched, saved, restored}")
        data["themeRoundTrip"] = [initial, switched, saved, restored]
        top = page.locator("#awakenology-return-top")
        if await top.count() != 1:
            raise AssertionError(f"{label}: missing unique return-to-top control")
        await page.screenshot(path=str(output / (label + ".png")), full_page=True,
                              animations="disabled", timeout=30000)
        return data, errors
    finally:
        await context.close()

async def main():
    failures = []
    output = Path("browser-parity-screenshots")
    output.mkdir(exist_ok=True)
    async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                for route, (path, _) in FIXTURES.items():
                    source = (ROOT / path).read_bytes().decode("utf-8")
                    generated = transform(source, route)
                    url = SITE + quote(route, safe="/%")
                    for viewport, (width, height) in VIEWPORTS.items():
                        key = quote(route, safe="").replace("%", "_") or "root"
                        live, live_errors = await snapshot(browser, None, url, width, height,
                                                           key + "-" + viewport + "-live", output)
                        built, built_errors = await snapshot(browser, generated, url, width, height,
                                                             key + "-" + viewport + "-built", output)
                        # Browser serialization normalizes HTML independently of BeautifulSoup.
                        fields = ("article", "text", "images", "title", "bodyClasses", "footer", "links", "mainVisible", "theme", "themeRoundTrip")
                        diff = [field for field in fields if live[field] != built[field]]
                        if built["brokenImages"]:
                            diff.append("generated brokenImages: " + str(built["brokenImages"]))
                        if built["horizontalOverflow"] != live["horizontalOverflow"]:
                            diff.append("horizontalOverflow")
                        if diff:
                            details = {}
                            for field in diff:
                                if field in ("article", "text", "footer"):
                                    a, b = str(live[field]), str(built[field])
                                    details[field] = {"live_length": len(a), "built_length": len(b),
                                        "first_difference": next((i for i, (x, y) in enumerate(zip(a, b)) if x != y), min(len(a), len(b))),
                                        "diff_sample": list(difflib.unified_diff(a.splitlines(), b.splitlines(), fromfile="live", tofile="built", lineterm=""))[:24]}
                                else:
                                    details[field] = {"live": live.get(field), "built": built.get(field)}
                            failures.append({"route": route, "viewport": viewport, "differences": diff,
                                             "details": details, "live_errors": live_errors, "built_errors": built_errors})
                        print(f"{route} {viewport}: " + ("MATCH" if not diff else "DIFF " + ", ".join(diff)), flush=True)
            finally:
                await browser.close()
    report = {"fixtures": len(FIXTURES), "viewports": list(VIEWPORTS),
              "failures": failures, "scope": "browser DOM/behavior baseline, not pixel equivalence"}
    Path("browser-parity-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    if failures:
        raise SystemExit(f"{len(failures)} browser parity comparisons differ; no deployment authorized")
    print("18 browser DOM comparisons passed; screenshot captures were observation-only.")

if __name__ == "__main__":
    asyncio.run(main())
