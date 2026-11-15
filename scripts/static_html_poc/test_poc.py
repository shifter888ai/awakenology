"""Regression tests for the non-deployed static HTML proof of concept."""
import unittest
from page_rules import rules_for
from parity_validator import validate, validate_metadata
from html_transformer import transform

SOURCE = '<!doctype html><html lang="en"><head><title>Example</title><link rel="canonical" href="https://old.invalid/"></head><body><main><p style="color:red"><b>Original</b></p><img src="/gallery/a.jpg" width="250" alt="A"></main><footer>Old</footer></body></html>'

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

    def test_content_preservation_and_idempotence(self):
        result = transform(SOURCE, "/English/")
        self.assertTrue(validate(SOURCE, result)["pass"])
        self.assertEqual(result, transform(result, "/English/"))
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(result, "html.parser")
        self.assertEqual(len(soup.select("#awakenology-theme-style")), 1)
        self.assertEqual(len(soup.select('link[rel="icon"][href="/gallery/favicons/favicon.png"]')), 1)
        self.assertIn("awakenology-toc-page", soup.body.get("class", []))
        self.assertEqual(soup.footer.get("id"), "awakenology-site-footer")
        self.assertEqual(soup.footer.get("class"), ["site-footer"])
        self.assertEqual(soup.footer.div.get("id"), "awakenology-footer-inner")
        self.assertEqual(soup.footer.select_one("#awakenology-footer-links").name, "span")
        self.assertIn('href="/Contact/"', str(soup.footer))
        branded = transform(SOURCE.replace("<main>", '<a class="brand" href="/">Home</a><main>'), "/English/")
        branded_soup = BeautifulSoup(branded, "html.parser")
        self.assertEqual(len(branded_soup.select("a.brand svg.brand-symbol")), 1)
        validate_metadata(result, canonical="https://awakenology.space/English/", noindex=False)

    def test_static_footer_contact_target_matches_current_worker(self):
        from pathlib import Path
        import re
        from bs4 import BeautifulSoup

        root = Path(__file__).resolve().parents[2]
        worker_source = (root / "worker.js").read_text(encoding="utf-8")
        match = re.search(
            r'<a class="contact-icon".*?href="([^"]+)" aria-label="([^"]+)" title="Contact">',
            worker_source,
            re.S,
        )
        self.assertIsNotNone(match, "current Worker footer must expose one recognizable Contact link")

        generated = BeautifulSoup(transform(SOURCE, "/English/"), "html.parser")
        contact_link = generated.footer.select_one("a.contact-icon")
        self.assertIsNotNone(contact_link)
        self.assertEqual(contact_link.get("href"), match.group(1))
        self.assertEqual(contact_link.get("aria-label"), match.group(2))


    def test_footer_active_state_matches_current_route(self):
        from bs4 import BeautifulSoup

        contact = BeautifulSoup(transform(SOURCE, "/Contact/"), "html.parser")
        disclaimer = BeautifulSoup(transform(SOURCE, "/Disclaimer/"), "html.parser")
        ordinary = BeautifulSoup(transform(SOURCE, "/English/"), "html.parser")

        self.assertEqual(contact.footer.select_one("a.contact-icon").get("aria-current"), "page")
        self.assertIsNone(contact.footer.select_one("a.disclaimer-icon").get("aria-current"))
        self.assertEqual(disclaimer.footer.select_one("a.disclaimer-icon").get("aria-current"), "page")
        self.assertIsNone(disclaimer.footer.select_one("a.contact-icon").get("aria-current"))
        self.assertIsNone(ordinary.footer.select_one("a.contact-icon").get("aria-current"))
        self.assertIsNone(ordinary.footer.select_one("a.disclaimer-icon").get("aria-current"))

    def test_contact_page_preserves_worker_submission_boundary(self):
        from pathlib import Path
        from bs4 import BeautifulSoup

        root = Path(__file__).resolve().parents[2]
        source = (root / "Contact" / "index.html").read_text(encoding="utf-8")
        generated = transform(source, "/Contact/")
        soup = BeautifulSoup(generated, "html.parser")

        self.assertEqual(len(soup.select("#message-form, #upload-form")), 2)
        self.assertIn('const endpoint="/api/contact";', generated)
        self.assertIn('fetch(endpoint,{method:"POST",body:data,credentials:"same-origin"})', generated)
        self.assertIn("challenges.cloudflare.com/turnstile", generated)
        self.assertEqual(soup.footer.select_one("a.contact-icon").get("href"), "/Contact/")
        self.assertEqual(soup.footer.select_one("a.contact-icon").get("aria-current"), "page")

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

    def test_noindex_routes_have_no_canonical(self):
        from bs4 import BeautifulSoup
        for route in ("/ai-search/", "/search/", "/ask/", "/New-Article/"):
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

    def test_search_page_uses_search_only(self):
        from pathlib import Path
        from bs4 import BeautifulSoup
        root = Path(__file__).resolve().parents[2]
        soup = BeautifulSoup((root / "search/index.html").read_text(encoding="utf-8"), "html.parser")
        self.assertEqual(len(soup.select("form#search-form")), 1)
        self.assertEqual(len(soup.select('input#search-query[type="search"]')), 1)
        self.assertEqual(len(soup.select("button.search-submit[type='submit']")), 1)
        self.assertEqual(len(soup.find_all("search-bar-snippet")), 0)
        self.assertEqual(len(soup.find_all("chat-page-snippet")), 0)
        self.assertEqual(len(soup.find_all("chat-bubble-snippet")), 0)
        self.assertIn("search.ai.cloudflare.com/search", str(soup))

    def test_live_signature_detects_metadata_and_footer_mutations(self):
        from check_live_parity import signature
        baseline = transform(SOURCE, "/English/")
        reference = signature(baseline)
        self.assertEqual(reference, signature(baseline))
        mutations = (
            ('<title>Example</title>', '<title>Changed</title>', "title"),
            ('href="https://awakenology.space/English/"', 'href="https://invalid.example/"', "canonical"),
            ('content="Awakenology"', 'content="Changed"', "og_site_name"),
            ('id="awakenology-site-footer"', 'id="altered-footer"', "footer"),
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

    def test_new_article_model_lab_is_noindex_and_excluded_from_sitemap(self):
        from pathlib import Path
        from urllib.parse import unquote, urlsplit
        from xml.etree import ElementTree
        from bs4 import BeautifulSoup
        root = Path(__file__).resolve().parents[2]
        source = BeautifulSoup((root / "Internal/New-Article/index.html").read_text(encoding="utf-8"), "html.parser")
        robots = source.head.find("meta", attrs={"name": "robots"})
        self.assertEqual(robots.get("content"), "noindex,nofollow")
        self.assertTrue(rules_for("/New-Article/").noindex)
        self.assertIsNone(rules_for("/New-Article/").canonical)
        sitemap = ElementTree.parse(root / "sitemap.xml")
        routes = {unquote(urlsplit(node.text or "").path)
                  for node in sitemap.iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")}
        self.assertNotIn("/New-Article/", routes)

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


    def test_japanese_all_perspectives_article_preserves_article_metadata(self):
        from pathlib import Path
        from urllib.parse import quote
        from bs4 import BeautifulSoup
        from xml.etree import ElementTree
        root = Path(__file__).resolve().parents[2]
        route = "/本源全視点vs個我単一視点/"
        source = (root / "本源全視点vs個我単一視点/index.html").read_text(encoding="utf-8")
        generated = transform(source, route)
        self.assertTrue(validate(source, generated)["pass"])
        before = BeautifulSoup(source, "html.parser")
        after = BeautifulSoup(generated, "html.parser")
        self.assertEqual(after.html.get("lang"), "ja")
        self.assertEqual(after.title.get_text(strip=True), "本源の全視点 vs 個我の単一視点 | Awakenology")
        self.assertEqual(after.find("meta", attrs={"property": "og:type"}).get("content"), "article")
        self.assertEqual(before.find("meta", attrs={"property": "og:type"}).get("content"), "article")
        self.assertEqual(after.head.find("link", rel="canonical").get("href"), rules_for(route).canonical)
        self.assertEqual(after.find("meta", attrs={"property": "og:description"}).get("content"),
                         before.find("meta", attrs={"property": "og:description"}).get("content"))
        alternates = {link.get("hreflang"): link.get("href")
                      for link in after.head.find_all("link", attrs={"rel": "alternate"})}
        self.assertTrue({"en", "ja", "zh-Hant"}.issubset(alternates))
        sitemap = ElementTree.parse(root / "sitemap.xml")
        urls = {node.text for node in sitemap.iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")}
        self.assertIn("https://awakenology.space" + quote(route, safe="/"), urls)

if __name__ == "__main__":
    unittest.main()
