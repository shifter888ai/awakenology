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
        validate_metadata(result, canonical="https://awakenology.space/English/", noindex=False)

    def test_search_noindex_and_no_canonical(self):
        result = transform(SOURCE, "/ai-search/")
        validate_metadata(result, canonical=None, noindex=True)
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
