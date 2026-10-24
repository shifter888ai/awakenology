"""Build-time metadata prototype; NOT Worker-equivalent or deployable.

Only deterministic metadata is handled here. Shared footer, logo, theme scripts,
page classes and complete Worker semantics remain outstanding. Article markup must
remain untouched and all changes are confined to this isolated PoC branch.
"""
from bs4 import BeautifulSoup
from page_rules import rules_for

DEFAULT_OG_IMAGE = (
    "https://images.squarespace-cdn.com/content/v1/5e46c1ddfed24d662efc3817/"
    "6e1d6965-c6b2-49d0-971e-4d42f9bcfaaa/Cosmic%2BEye.jpg"
)
SITE_NAME = "Awakenology"
SEO_DESCRIPTIONS = {
    "/Destruction-Occurs-in-an-Instant/": "Awakenology — an account of how 3,000 Domain team members were instantaneously captured 10,000 years ago on Earth.",
    "/ai-search/": "Search the Awakenology site or ask questions about its material using AI.",
    "/三十六計/": "《三十六計》：中國傳統兵法三十六計的全文整理。",
    "/人の多次元複合体構造1-単重複合体/": "人の多次元複合体構造（1）----単重複合体。肉体、霊体、霊串、霊核などの構造を整理。",
    "/人の多次元複合体構造2-二重複合体霊-体/": "人の多次元複合体構造（2）----二重複合体「霊+体」。霊と体の関係と各複合体を整理。",
    "/人の多次元複合体構造3-多重複合体/": "人の多次元複合体構造（3）----多次元的な複合体構造について整理。",
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
        ("og:url", rules.canonical),
        ("og:type", "website"),
        ("og:site_name", SITE_NAME),
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

    return str(soup).replace("<!DOCTYPE html>\n\n", "<!DOCTYPE html>\n", 1)
