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
        with self.assertRaises(ValueError):
            rules_for("relative")

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

    def test_mutation_fails_closed(self):
        with self.assertRaises(ValueError):
            validate(SOURCE, SOURCE.replace('width="250"', 'width="300"'))
        with self.assertRaises(ValueError):
            validate(SOURCE, SOURCE.replace("<b>Original</b>", "<b>Changed</b>"))
        with self.assertRaises(ValueError):
            validate(SOURCE, SOURCE.replace('style="color:red"', 'style="color:blue"'))

if __name__ == "__main__":
    unittest.main()
