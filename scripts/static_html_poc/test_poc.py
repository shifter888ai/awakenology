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
        self.assertEqual(rules_for("/Chinese").language, "zh-Hant")
        self.assertEqual(rules_for("/Chinese").route, "/Chinese/")
        self.assertTrue(rules_for("/ai-search").noindex)
        self.assertIsNone(rules_for("/ai-search").canonical)
        self.assertEqual(rules_for("/ai-search").route, "/ai-search/")
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
        self.assertEqual(soup.footer.get("class"), ["footer", "site-footer"])
        self.assertIn("contact@awakenology.org", str(soup.footer))
        branded = transform(SOURCE.replace("<main>", '<a class="brand" href="/">Home</a><main>'), "/English/")
        branded_soup = BeautifulSoup(branded, "html.parser")
        self.assertEqual(len(branded_soup.select("a.brand svg.brand-symbol")), 1)
        validate_metadata(result, canonical="https://awakenology.space/English/", noindex=False)

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
        result = transform(SOURCE, "/ai-search/")
        validate_metadata(result, canonical=None, noindex=True)
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(result, "html.parser")
        self.assertEqual(
            soup.head.find("meta", attrs={"property": "og:url"})["content"],
            "https://awakenology.space/ai-search/",
        )
        self.assertTrue(validate(SOURCE, result)["pass"])

    def test_live_signature_detects_metadata_and_footer_mutations(self):
        from check_live_parity import signature
        baseline = transform(SOURCE, "/English/")
        reference = signature(baseline)
        self.assertEqual(reference, signature(baseline))
        mutations = (
            ('<title>Example</title>', '<title>Changed</title>', "title"),
            ('href="https://awakenology.space/English/"', 'href="https://invalid.example/"', "canonical"),
            ('content="Awakenology"', 'content="Changed"', "og_site_name"),
            ('class="footer site-footer"', 'class="footer altered"', "footer"),
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
        search = transform(SOURCE, "/ai-search/")
        with self.assertRaises(ValueError):
            validate_metadata(search.replace("</head>", '<meta name="robots" content="index,follow"></head>'),
                              canonical=None, noindex=True)
        with self.assertRaises(ValueError):
            validate_metadata("<html><body><main>Missing head</main></body></html>",
                              canonical=None, noindex=False)

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
                self.assertFalse(route.startswith("/ai-search/"))
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

if __name__ == "__main__":
    unittest.main()
