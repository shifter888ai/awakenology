"""Compare public Worker-rendered pages to PoC output without changing production.

Run manually: python scripts/static_html_poc/check_live_parity.py
An HTTP failure or mismatch exits nonzero. This is an observation-only audit.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup
from html_transformer import transform
from page_rules import rules_for
from check_real_pages import FIXTURES, ROOT

def signature(html):
    soup = BeautifulSoup(html, "html.parser")
    if not soup.head or not soup.body:
        raise ValueError("Incomplete response")
    def metas(key, value):
        return sorted((m.get("content") or "") for m in soup.head.find_all("meta") if m.get(key, "").lower() == value)
    return {
        "title": soup.title.get_text() if soup.title else None,
        "description": metas("name", "description"),
        "robots": metas("name", "robots"),
        "canonical": sorted(x.get("href") for x in soup.head.find_all("link") if "canonical" in (x.get("rel") or [])),
        "og_title": metas("property", "og:title"),
        "og_description": metas("property", "og:description"),
        "og_url": metas("property", "og:url"),
        "og_image": metas("property", "og:image"),
        "og_type": metas("property", "og:type"),
        "og_site_name": metas("property", "og:site_name"),
        "theme_styles": len(soup.select("#awakenology-theme-style")),
        "cn_styles": len(soup.select("#awakenology-cn-style")),
        "favicon": sorted(x.get("href") for x in soup.head.find_all("link") if "icon" in (x.get("rel") or [])),
        "body_classes": sorted(soup.body.get("class", [])),
        "footer": str(soup.footer) if soup.footer else None,
    }

def main():
    failures = 0
    for route, (path, _) in FIXTURES.items():
        url = rules_for(route).canonical or "https://awakenology.space" + route
        request = Request(url, headers={"User-Agent": "Awakenology-static-parity-audit/1.0", "Accept": "text/html"})
        with urlopen(request, timeout=25) as response:
            if response.status != 200 or "text/html" not in response.headers.get("Content-Type", ""):
                raise ValueError(f"Unexpected HTTP response for {route}")
            live = response.read().decode("utf-8")
        source = (ROOT / path).read_text(encoding="utf-8")
        generated = transform(source, route)
        a, b = signature(live), signature(generated)
        differing = [key for key in a if a[key] != b[key]]
        print(f"{path}: " + ("MATCH" if not differing else "NOT YET PARITY: " + ", ".join(differing)))
        failures += bool(differing)
    if failures:
        raise SystemExit(f"{failures} pages differ from current Worker output; do not deploy")
    print("Five-page signature parity passed (not a byte-for-byte or visual comparison).")

if __name__ == "__main__":
    main()
