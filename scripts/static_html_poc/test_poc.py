"""Regression tests for the non-deployed static HTML proof of concept."""
import unittest
from page_rules import rules_for
from parity_validator import validate, validate_metadata
from html_transformer import transform

SOURCE = '<!doctype html><html lang="en"><head><title>Example</title><link rel="canonical" href="https://old.invalid/"></head><body><header class="site-header"><a class="brand" href="/">Old brand</a><nav aria-label="Site navigation"><a href="/">Home</a></nav></header><main><p style="color:red"><b>Original</b></p><img src="/gallery/a.jpg" width="250" alt="A"></main><footer>Old</footer></body></html>'

class ParityTests(unittest.TestCase):
    def test_route_rules(self):
        self.assertEqual(rules_for("/Chinese/").language, "zh-Hant")
        self.assertIsNone(rules_for("/ai-search/").canonical)
        self.assertTrue(rules_for("/ai-search/").noindex)
        for route in ("/search/", "/ask/"):
            self.assertIsNone(rules_for(route).canonical)
            self.assertTrue(rules_for(route).noindex)
        self.assertEqual(rules_for("/Chinese").language, "zh-Hant")
        self.assertEqual(rules_for("/Chinese").route, "/Chinese/")
        self.assertTrue(rules_for("/ai-search").noindex)
        self.assertIsNone(rules_for("/ai-search").canonical)
        self.assertEqual(rules_for("/ai-search").route, "/ai-search/")
        self.assertTrue(rules_for("/search").noindex)
        self.assertTrue(rules_for("/ask").noindex)
        with self.assertRaises(ValueError):
            rules_for("relative")

    def test_unicode_canonical_and_invalid_routes(self):
        from urllib.parse import quote
        unicode_route = "/與退化派對話8/"
        self.assertEqual(rules_for(unicode_route).canonical,
                         "https://awakenology.space" + quote(unicode_route, safe="/%"))
        self.assertEqual(rules_for("/與退化派對話8").canonical,
                         rules_for(unicode_route).canonical)
        self.assertEqual(rules_for("/What-Is-Hypnosis/index.html").canonical,
                         "https://awakenology.space/What-Is-Hypnosis/index.html")
        for invalid in ("", "relative", "//evil.example/", "/path?x=1",
                        "/path#fragment", "/path//nested"):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                rules_for(invalid)

    def test_shared_html_template_slots(self):
        from html_transformer import HEADER_TEMPLATE, FOOTER_TEMPLATE
        for token in ("{{BRAND_SVG}}", "{{LANGUAGE_LINKS}}", "{{ACTION_LINKS}}"):
            self.assertEqual(HEADER_TEMPLATE.count(token), 1)
        for token in ("{{CONTACT_ACTIVE}}", "{{DISCLAIMER_ACTIVE}}", "{{YEAR}}"):
            self.assertEqual(FOOTER_TEMPLATE.count(token), 1)

    def test_content_preservation_and_idempotence(self):
        from bs4 import BeautifulSoup
        result = transform(SOURCE, "/English/")
        self.assertTrue(validate(SOURCE, result)["pass"])
        self.assertNotIn("{{", str(BeautifulSoup(result, "html.parser").select_one("header#awakenology-site-header")))
        self.assertNotIn("{{", str(BeautifulSoup(result, "html.parser").select_one("footer#awakenology-site-footer")))
        self.assertEqual(result, transform(result, "/English/"))
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(result, "html.parser")
        self.assertEqual(len(soup.select("#awakenology-theme-style")), 1)
        self.assertEqual(len(soup.select('link[rel="icon"][href="/gallery/favicons/favicon.png"]')), 1)
        self.assertIn("awakenology-toc-page", soup.body.get("class", []))
        self.assertEqual(soup.select_one("header#awakenology-site-header").get("class"), ["site-header"])
        self.assertIsNotNone(soup.select_one("#awakenology-brand svg.brand-symbol"))
        self.assertEqual(len(soup.select("#awakenology-language-nav a")), 3)
        self.assertEqual(len(soup.select("#awakenology-action-nav a")), 3)
        self.assertEqual(soup.footer.get("id"), "awakenology-site-footer")
        self.assertEqual(soup.footer.get("class"), ["site-footer"])
        self.assertEqual(soup.footer.select_one("#awakenology-footer-inner") is not None, True)
        self.assertEqual(soup.footer.select_one("a.contact-icon").get("href"), "/Contact/")
        branded = transform(SOURCE.replace("<main>", '<a class="brand" href="/">Home</a><main>'), "/English/")
        branded_soup = BeautifulSoup(branded, "html.parser")
        self.assertEqual(len(branded_soup.select("#awakenology-brand svg.brand-symbol")), 1)
        validate_metadata(result, canonical="https://awakenology.space/English/", noindex=False)


    def test_header_active_language_and_action_links(self):
        from bs4 import BeautifulSoup
        cases = (
            ("/Chinese/", '#awakenology-language-nav a[href="/Chinese/"]'),
            ("/Coach_cn/", '#awakenology-language-nav a[href="/Chinese/"]'),
            ("/search/", '#awakenology-action-nav a[href="/search/"]'),
            ("/ai-search/", '#awakenology-action-nav a[href="/search/"]'),
            ("/ask/", '#awakenology-action-nav a[href="/ask/"]'),
            ("/links/", '#awakenology-action-nav a[href="/links/"]'),
        )
        for route, selector in cases:
            with self.subTest(route=route):
                soup = BeautifulSoup(transform(SOURCE, route), "html.parser")
                self.assertEqual(soup.select_one(selector).get("aria-current"), "page")

    def test_missing_global_header_fails_closed(self):
        import re
        source = re.sub(r'<header class="site-header">[\s\S]*?</header>', "", SOURCE, count=1)
        with self.assertRaises(ValueError):
            transform(source, "/English/")

    def test_footer_active_page_links(self):
        from bs4 import BeautifulSoup
        for route, selector in (("/Contact/", "a.contact-icon"), ("/Disclaimer/", "a.disclaimer-icon")):
            with self.subTest(route=route):
                soup = BeautifulSoup(transform(SOURCE, route), "html.parser")
                self.assertEqual(soup.footer.select_one(selector).get("aria-current"), "page")

    def test_open_graph_defaults_and_title(self):
        result = transform(SOURCE, "/English/")
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(result, "html.parser")
        self.assertEqual(soup.html.get("lang"), "en")
        self.assertEqual(soup.head.find("meta", attrs={"property": "og:title"})["content"], "Example")
        self.assertEqual(soup.head.find("meta", attrs={"property": "og:type"})["content"], "website")
        self.assertEqual(soup.head.find("meta", attrs={"property": "og:site_name"})["content"], "Awakenology")
        self.assertEqual(soup.head.find("meta", attrs={"property": "og:image"})["content"],
                         "https://images.squarespace-cdn.com/content/v1/5e46c1ddfed24d662efc3817/6e1d6965-c6b2-49d0-971e-4d42f9bcfaaa/Cosmic%2BEye.jpg")

    def test_search_noindex_and_no_canonical(self):
        from bs4 import BeautifulSoup
        for route in ("/ai-search/", "/search/", "/ask/"):
            with self.subTest(route=route):
                result = transform(SOURCE, route)
                validate_metadata(result, canonical=None, noindex=True)
                soup = BeautifulSoup(result, "html.parser")
                self.assertEqual(
                    soup.head.find("meta", attrs={"property": "og:url"})["content"],
                    "https://awakenology.space" + route,
                )
                self.assertTrue(validate(SOURCE, result)["pass"])


    def test_ask_page_uses_full_page_chat_not_bubble(self):
        from pathlib import Path
        from bs4 import BeautifulSoup
        root = Path(__file__).resolve().parents[2]
        soup = BeautifulSoup((root / "ask/index.html").read_text(encoding="utf-8"), "html.parser")
        self.assertEqual(len(soup.find_all("chat-page-snippet")), 1)
        self.assertEqual(len(soup.find_all("chat-bubble-snippet")), 0)
        self.assertEqual(len(soup.find_all("search-bar-snippet")), 0)
        self.assertIn("v0.0.40", soup.find("script", attrs={"type": "module"})["src"])

    def test_search_page_uses_dedicated_search_form(self):
        from pathlib import Path
        from bs4 import BeautifulSoup
        root = Path(__file__).resolve().parents[2]
        soup = BeautifulSoup((root / "search/index.html").read_text(encoding="utf-8"), "html.parser")
        form = soup.find("form", id="search-form", attrs={"role": "search"})
        self.assertIsNotNone(form)
        self.assertIsNotNone(form.find("input", id="search-query", attrs={"type": "search"}))
        self.assertIsNotNone(form.find("button", attrs={"type": "submit", "aria-label": "Search"}))
        self.assertIsNotNone(soup.find(id="search-status", attrs={"aria-live": "polite"}))
        self.assertIsNotNone(soup.find(id="search-results"))
        self.assertEqual(len(soup.find_all("chat-page-snippet")), 0)
        self.assertEqual(len(soup.find_all("chat-bubble-snippet")), 0)

    def test_live_signature_detects_metadata_and_footer_mutations(self):
        from check_live_parity import signature
        baseline = transform(SOURCE, "/English/")
        reference = signature(baseline)
        self.assertEqual(reference, signature(baseline))
        mutations = (
            ('id="awakenology-site-header"', 'id="altered-site-header"', "header"),
            ('<title>Example</title>', '<title>Changed</title>', "title"),
            ('href="https://awakenology.space/English/"', 'href="https://invalid.example/"', "canonical"),
            ('content="Awakenology"', 'content="Changed"', "og_site_name"),
            ('class="site-footer"', 'class="footer altered"', "footer"),
        )
        for before, after, field in mutations:
            with self.subTest(field=field):
                self.assertIn(before, baseline)
                altered = baseline.replace(before, after, 1)
                self.assertNotEqual(reference[field], signature(altered)[field])

    def test_live_signature_rejects_incomplete_html(self):
        from check_live_parity import signature
        with self.assertRaises(ValueError):
            signature("<html><head><title>Broken</title></head></html>")

    def test_metadata_validator_rejects_duplicates_and_conflicts(self):
        result = transform(SOURCE, "/English/")
        canonical = "https://awakenology.space/English/"
        with self.assertRaises(ValueError):
            validate_metadata(result.replace("</head>", '<link rel="CANONICAL" href="' + canonical + '"></head>'),
                              canonical=canonical, noindex=False)
        with self.assertRaises(ValueError):
            validate_metadata(result.replace("</head>", '<meta name="robots" content="noindex,follow"></head>'),
                              canonical=canonical, noindex=False)
        for route in ("/ai-search/", "/search/", "/ask/"):
            search = transform(SOURCE, route)
            with self.assertRaises(ValueError):
                validate_metadata(search.replace("</head>", '<meta name="robots" content="index,follow"></head>'),
                                  canonical=None, noindex=True)
        with self.assertRaises(ValueError):
            validate_metadata("<html><body><main>Missing head</main></body></html>",
                              canonical=None, noindex=False)

    def test_internal_and_draft_html_excluded_from_public_inventory(self):
        from check_full_inventory import public_sources
        from build_staging import PRIVATE_PREFIXES
        paths, excluded = public_sources()
        self.assertIn("Internal/", PRIVATE_PREFIXES)
        self.assertIn("New-Article/", PRIVATE_PREFIXES)
        self.assertNotIn("Internal/New-Article/index.html", paths)
        self.assertIn("Internal/New-Article/index.html", excluded)
        self.assertFalse(any(path.startswith(("Internal/", "New-Article/")) for path in paths))

    def test_private_editor_excluded_from_public_crawl_inventory(self):
        from pathlib import Path
        from urllib.parse import urlsplit, unquote
        from xml.etree import ElementTree
        root = Path(__file__).resolve().parents[2]
        robots = (root / "robots.txt").read_text(encoding="utf-8")
        disallowed = {line.split(":", 1)[1].strip() for line in robots.splitlines()
                      if line.lower().startswith("disallow:")}
        for prefix in ("/editor/", "/auth/", "/api/editor/"):
            with self.subTest(prefix=prefix):
                self.assertIn(prefix, disallowed)
        sitemap = ElementTree.parse(root / "sitemap.xml")
        for loc in sitemap.iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc"):
            route = unquote(urlsplit(loc.text or "").path)
            with self.subTest(route=route):
                self.assertFalse(any(route.startswith(prefix) for prefix in disallowed))
                self.assertFalse(route.startswith(("/ai-search/", "/search/", "/ask/")))
                self.assertFalse(any(part in route.lower() for part in
                                     ("/new-page-generator/", "/word-generator/", "/html-generator/")))
        # This is a static inventory guard, not an authenticated live-host audit.

    def test_mutation_fails_closed(self):
        with self.assertRaises(ValueError):
            validate(SOURCE, SOURCE.replace('width="250"', 'width="300"'))
        with self.assertRaises(ValueError):
            validate(SOURCE, SOURCE.replace("<b>Original</b>", "<b>Changed</b>"))
        with self.assertRaises(ValueError):
            validate(SOURCE, SOURCE.replace('style="color:red"', 'style="color:blue"'))


    def test_shared_header_footer_layout_and_svg_bounds(self):
        from pathlib import Path
        root = Path(__file__).resolve().parent
        css = (root / "assets" / "theme.html").read_text(encoding="utf-8")
        required = (
            "#awakenology-header-inner{",
            "#awakenology-brand{",
            "#awakenology-nav{",
            "#awakenology-language-nav,#awakenology-action-nav{",
            "#awakenology-action-nav .nav-icon-link svg{display:block;width:16px;height:16px",
            "#awakenology-footer-inner{",
            "#awakenology-footer-links{",
            "@media(max-width:700px)",
        )
        for rule in required:
            with self.subTest(rule=rule):
                self.assertIn(rule, css)
        self.assertNotIn("#awakenology-action-nav .nav-icon-link svg{display:block;width:300px", css)

    def test_worker_header_footer_css_is_synchronized(self):
        from pathlib import Path
        root = Path(__file__).resolve().parents[2]
        worker = (root / "worker.js").read_text(encoding="utf-8")
        theme = (root / "scripts/static_html_poc/assets/theme.html").read_text(encoding="utf-8")
        start = worker.index("/* Canonical shared header: page CSS cannot alter its structure or geometry. */")
        end = worker.index("</style>", start)
        canonical = worker[start:end]
        self.assertEqual(theme.count(canonical), 1)
        self.assertIn("/* Canonical Worker header/footer CSS synchronized with worker.js. */", theme)

if __name__ == "__main__":
    unittest.main()
