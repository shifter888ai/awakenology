"""Build-time static HTML prototype. This is still non-deployable until full parity gates pass.

The runtime fragments are copied from worker.js into this isolated PoC so they can
be applied during generation. BeautifulSoup serialization can normalize legacy HTML;
the article subtree preservation gate remains mandatory.
"""
from pathlib import Path
from urllib.parse import quote
from bs4 import BeautifulSoup, NavigableString
from page_rules import SITE, rules_for

ASSETS = Path(__file__).parent / "assets"
DEFAULT_OG_IMAGE = (
    "https://images.squarespace-cdn.com/content/v1/5e46c1ddfed24d662efc3817/"
    "6e1d6965-c6b2-49d0-971e-4d42f9bcfaaa/Cosmic%2BEye.jpg"
)
SITE_NAME = "Awakenology"
FAVICON = "/gallery/favicons/favicon.png"
LEGACY_DARK_PAGES = {
    "/What-Is-Hypnosis/", "/What-Is-Hypnotic-Reincarnation/",
    "/The-History-of-Reincarnation/", "/Multidimensional-Body-Complex-1-Single-Complex/",
    "/Multidimensional-Body-Complex-3-Multi-Complex/", "/What-is-The-Ultimate-Source/",
    "/What-does-The-Ultimate-Source-like/", "/What-is-Multidimensional-Space-Time/",
    "/What-is-Zero-Energy-Space/", "/Energy-Consumption-and-Transformation/",
    "/アインシュタイン協議百年催眠実験/", "/意識強度とは/",
    "/意識強度検測点1自動意識制御領域/", "/意識強度検測点2自主意識領域/",
    "/意識強度検測点抽出検測データサンプル20190317/",
    "/人の多次元複合体構造1-単重複合体/", "/人の多次元複合体構造2-二重複合体霊-体/",
    "/伝統修行の五段階/",
}
SEO_DESCRIPTIONS = {
    "/Destruction-Occurs-in-an-Instant/": "Awakenology — an account of how 3,000 Domain team members were instantaneously captured 10,000 years ago on Earth.",
    "/ai-search/": "Search the Awakenology site or ask questions about its material using AI.",
    "/三十六計/": "《三十六計》：中國傳統兵法三十六計的全文整理。",
    "/人の多次元複合体構造1-単重複合体/": "人の多次元複合体構造（1）----単重複合体。肉体、霊体、霊串、霊核などの構造を整理。",
    "/人の多次元複合体構造2-二重複合体霊-体/": "人の多次元複合体構造（2）----二重複合体「霊+体」。霊と体の関係と各複合体を整理。",
    "/人の多次元複合体構造3-多重複合体/": "人の多次元複合体構造（3）----多重複合体。多次元的な複合体構造について整理。",
    "/人的多次元複合體結構6-人體18規則與章程/": "人的多次元複合體結構（6）----人體18規則與章程，整理人體資訊模組系統及其管理與技術規則。",
    "/個體現象界與集體現象界/": "個體現象界與集體現象界：介紹自由意識所創造的個體現象界與集體現象界。",
    "/多重時空是什麽/": "多重時空是什麽：介紹界、空間、時空及不同空間的時間特性。",
    "/意識強度檢測點抽樣檢測資料樣本/": "意識強度檢測點：抽樣檢測資料樣本20190317，包含第1至9區的檢測資料。",
    "/愛因斯坦協議百年催眠實驗/": "愛因斯坦協議：百年催眠實驗，2025年公開發布的信息披露內容。",
    "/摧毀只是一瞬間/": "摧毀只是一瞬間：記錄一萬年前同領地三千名隊員被瞬間捕捉的催眠偷襲事件。",
    "/時間是什麽/": "時間是什麽：從深層靈界、淺層靈界與物質界的角度介紹時間遊戲及其規則。",
    "/本源喜歡什麽/": "本源喜歡什麽：以問答形式討論本源、遊戲及自由意識。",
    "/本源是什麽/": "本源是什麽：從與本源合一的觀察，描述本源的無限性、唯一性與不可定義性。",
    "/空間是什麽/": "空間是什麽：從本源與意識的角度討論空間、界與不同層次的存在。",
    "/零能量空間是什麽/": "零能量空間是什麽：介紹零能量空間及其相關概念。",
}
BRAND_SVG = (
    '<svg class="brand-symbol" viewBox="0 0 100 100" role="img" aria-label="Circled A" '
    'style="transform:rotate(5deg);transform-origin:center"><path d="M17 80 A44 44 0 1 1 26.7 87.3" '
    'fill="none" stroke="currentColor" stroke-width="7.5" stroke-linecap="butt"/>'
    '<path d="M27 87 L50 20 L72 77 L58 59 Q52 54 46 55" fill="none" stroke="currentColor" '
    'stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
)


def _dedupe_meta(soup, attr, value, content):
    tags = soup.head.find_all("meta", attrs={attr: value})
    if tags:
        tags[0]["content"] = content
        for duplicate in tags[1:]:
            duplicate.decompose()
    else:
        soup.head.append(soup.new_tag("meta", attrs={attr: value, "content": content}))


def _dedupe_link(soup, rel, href):
    tags = [tag for tag in soup.head.find_all("link")
            if rel in (tag.get("rel") or [])]
    if tags:
        tags[0]["href"] = href
        for duplicate in tags[1:]:
            duplicate.decompose()
    else:
        soup.head.append(soup.new_tag("link", rel=rel, href=href))


def _inject_runtime_fragments(soup, route):
    # These exact fragments are sourced from worker.js. Avoid duplicate injection.
    if not soup.select_one("#awakenology-theme-style"):
        fragment = BeautifulSoup((ASSETS / "theme.html").read_text(encoding="utf-8"), "html.parser")
        for node in list(fragment.contents):
            if getattr(node, "name", None):
                soup.head.append(node)
    if not soup.find("script", string=lambda text: text and 'var KEY="awakenology-theme"' in text):
        fragment = BeautifulSoup((ASSETS / "theme-toggle.html").read_text(encoding="utf-8"), "html.parser")
        for node in list(fragment.contents):
            if getattr(node, "name", None):
                soup.head.append(node)
    if not soup.find("script", attrs={"type": "module"}):
        fragment = BeautifulSoup((ASSETS / "chinese-toggle.html").read_text(encoding="utf-8"), "html.parser")
        for node in list(fragment.contents):
            if getattr(node, "name", None):
                soup.head.append(node)

    # The Worker removes existing icon declarations before adding the canonical favicon.
    for link in list(soup.head.find_all("link")):
        rel = [item.lower() for item in (link.get("rel") or [])]
        if "icon" in rel or "apple-touch-icon" in rel:
            link.decompose()
    favicon = soup.new_tag("link", rel="icon", type="image/png", href=FAVICON)
    structured_data = soup.head.find("script", attrs={"type": "application/ld+json"})
    if structured_data:
        structured_data.insert_before(favicon)
    else:
        soup.head.append(favicon)

    body = soup.body
    classes = list(body.get("class", []))
    if route in {"/English/", "/Japanese/", "/Chinese/"}:
        classes.append("awakenology-toc-page")
    for path, cls in (("/English/", "awakenology-lang-en"),
                      ("/Japanese/", "awakenology-lang-ja"),
                      ("/Chinese/", "awakenology-lang-zh")):
        if route == path:
            classes.append(cls)
    if route in LEGACY_DARK_PAGES:
        classes.append("awakenology-legacy-dark-page")
    has_han = any("\u3400" <= ch <= "\u9fff" for ch in route)
    has_kana = any("\u3040" <= ch <= "\u30ff" for ch in route)
    if route in {"/Chinese/", "/Coach_cn/"} or (any(ord(ch) > 127 for ch in route) and has_han and not has_kana):
        classes.append("awakenology-chinese-page")
    body["class"] = list(dict.fromkeys(classes))

    if route != "/":
        for anchor in soup.select("a.brand[href='/']"):
            if not anchor.select_one("svg.brand-symbol"):
                anchor.insert(0, BeautifulSoup(BRAND_SVG, "html.parser").svg)


def _replace_footer(soup):
    footer = soup.find("footer")
    if not footer:
        return
    footer["class"] = ["footer", "site-footer"]
    footer.clear()
    inner = BeautifulSoup(
        '<div class="footer-inner"><span class="footer-links">'
        '<a class="contact-icon" href="mailto:contact@awakenology.org" aria-label="Email Awakenology" title="Contact"><span aria-hidden="true">✉</span></a>'
        '<a class="reddit-icon reddit-one" href="https://www.reddit.com/r/EscapeReincarnation/" aria-label="Reddit: Escape Reincarnation"><img src="/assets/reddit-one.svg" alt=""></a>'
        '<a class="reddit-icon reddit-two" href="https://www.reddit.com/r/EscapePrisonPlanet/" aria-label="Reddit: Escape Prison Planet"><img src="/assets/reddit-two.svg" alt=""></a>'
        '<a class="reddit-icon reddit-three" href="https://www.reddit.com/user/Lower-Lingonberry-40/" aria-label="Reddit: Lower-Lingonberry-40"><img src="/assets/reddit-three.svg" alt=""></a>'
        '<a class="disclaimer-icon" href="/Disclaimer/" aria-label="Disclaimer" title="Disclaimer"><span aria-hidden="true">ⓘ</span></a>'
        '</span><span>© 2017–YEAR Awakenology</span></div>', "html.parser").div
    copyright = inner.find("span", string=lambda text: text and "© 2017–YEAR" in text)
    if copyright:
        copyright.string.replace_with("© 2017–" + __import__("datetime").datetime.now(__import__("datetime").timezone.utc).year.__str__() + " Awakenology")
    footer.append(inner)


def transform(source: str, route: str) -> str:
    rules = rules_for(route)
    soup = BeautifulSoup(source, "html.parser")
    if not soup.html or not soup.head or not soup.body:
        raise ValueError("Incomplete HTML document")

    if rules.language:
        soup.html["lang"] = rules.language

    title = soup.title.get_text().strip() if soup.title else ""
    description = SEO_DESCRIPTIONS.get(rules.route, "")
    existing_description = soup.head.find("meta", attrs={"name": "description"})
    description_value = (
        (existing_description.get("content") or "").strip()
        if existing_description else ""
    )
    if not description_value and description:
        _dedupe_meta(soup, "name", "description", description)
        description_value = description

    og_title = soup.head.find("meta", attrs={"property": "og:title"})
    if title and not (og_title and (og_title.get("content") or "").strip()):
        _dedupe_meta(soup, "property", "og:title", title)
    og_description = soup.head.find("meta", attrs={"property": "og:description"})
    if description_value and not (og_description and (og_description.get("content") or "").strip()):
        _dedupe_meta(soup, "property", "og:description", description_value)

    for prop, value in (
        ("og:image", DEFAULT_OG_IMAGE),
        ("og:url", SITE + quote(rules.route, safe="/%")),
        ("og:type", "website"), ("og:site_name", SITE_NAME),
    ):
        if value and not soup.head.find("meta", attrs={"property": prop}):
            _dedupe_meta(soup, "property", prop, value)

    if rules.canonical:
        _dedupe_link(soup, "canonical", rules.canonical)
    else:
        for link in soup.head.select('link[rel="canonical"]'):
            link.decompose()

    if rules.noindex:
        _dedupe_meta(soup, "name", "robots", "noindex,follow")

    _inject_runtime_fragments(soup, rules.route)
    _replace_footer(soup)
    if rules.route == "/" and not soup.find("script", string=lambda text: text and '"@type":"WebSite"' in text):
        soup.head.append(BeautifulSoup(
            '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Awakenology","url":"https://awakenology.space/"}</script>',
            "html.parser").script)

    # Legacy pages may leave runs of blank text nodes when icon links are removed.
    # Collapse whitespace-only head nodes to one newline so repeated transforms are stable.
    previous_was_whitespace = False
    for node in list(soup.head.contents):
        if isinstance(node, NavigableString) and not str(node).strip():
            if previous_was_whitespace:
                node.extract()
            else:
                node.replace_with(chr(10))
                previous_was_whitespace = True
        else:
            previous_was_whitespace = False

    output = str(soup)
    doctype_prefix = "<!DOCTYPE html>"
    if output.startswith(doctype_prefix):
        remainder = output[len(doctype_prefix):].lstrip(chr(10))
        output = doctype_prefix + chr(10) + remainder
    # Preserve a source article's second trailing newline when BeautifulSoup
    # serialization collapses precisely that one whitespace character.
    # Replace only the exact parsed article subtree; no other mismatch is masked.
    source_article = BeautifulSoup(source, "html.parser").select_one("article.article, .article")
    output_article = BeautifulSoup(output, "html.parser").select_one("article.article, .article")
    if source_article is not None and output_article is not None:
        original_markup, generated_markup = str(source_article), str(output_article)
        newline = chr(10)
        if (original_markup.endswith(newline * 2 + "</article>") and
                generated_markup.endswith(newline + "</article>") and
                original_markup == generated_markup[:-len("</article>")] + newline + "</article>"):
            if output.count(generated_markup) != 1:
                raise ValueError("Ambiguous article whitespace restoration")
            output = output.replace(generated_markup, original_markup, 1)
    return output
