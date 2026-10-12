"""Regression tests for production URL resolution."""
import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit_live_links_assets.py"
SPEC = importlib.util.spec_from_file_location("audit_live_links_assets", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

class LiveURLResolutionTests(unittest.TestCase):
    def test_encoded_unicode_path_is_not_double_encoded(self):
        self.assertEqual(AUDIT.make_url("index.html", "/%E6%97%A5%E6%9C%AC%E8%AA%9E/"),
                         "https://awakenology.space/%E6%97%A5%E6%9C%AC%E8%AA%9E/")

    def test_raw_unicode_path_is_encoded_once(self):
        self.assertEqual(AUDIT.make_url("index.html", "/日本語/"),
                         "https://awakenology.space/%E6%97%A5%E6%9C%AC%E8%AA%9E/")

    def test_relative_asset_resolves_from_nested_page(self):
        self.assertEqual(AUDIT.make_url("English/index.html", "../gallery/logo.png"),
                         "https://awakenology.space/gallery/logo.png")

    def test_query_is_preserved_and_fragment_removed(self):
        self.assertEqual(AUDIT.make_url("index.html", "/English/?view=full#section"),
                         "https://awakenology.space/English/?view=full")

    def test_external_and_non_http_references_are_skipped(self):
        self.assertEqual(AUDIT.make_url("index.html", "https://example.com/a"), "")
        self.assertEqual(AUDIT.make_url("index.html", "mailto:test@example.com"), "")
        self.assertEqual(AUDIT.make_url("index.html", "javascript:void(0)"), "")

if __name__ == "__main__":
    unittest.main()
