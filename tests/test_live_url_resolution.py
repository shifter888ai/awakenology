"""Regression tests for production URL resolution and response classification."""
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

class LiveResponseClassificationTests(unittest.TestCase):
    def test_success_without_redirect_passes(self):
        self.assertEqual(AUDIT.classify_response("https://awakenology.space/a", "link", 200,
                         "text/html; charset=utf-8", "https://awakenology.space/a", ""), "PASS")

    def test_redirect_is_distinguished(self):
        self.assertEqual(AUDIT.classify_response("https://awakenology.space/a", "link", 200,
                         "text/html", "https://awakenology.space/b/", ""), "REDIRECT")

    def test_missing_resource_is_http_error(self):
        self.assertEqual(AUDIT.classify_response("https://awakenology.space/a.png", "asset", 404,
                         "text/html", "https://awakenology.space/a.png", ""), "HTTP_ERROR")

    def test_html_fallback_for_asset_is_content_type_mismatch(self):
        self.assertEqual(AUDIT.classify_response("https://awakenology.space/missing.png", "asset", 200,
                         "text/html; charset=utf-8", "https://awakenology.space/missing.png", ""),
                         "CONTENT_TYPE_MISMATCH")

    def test_network_error_is_not_http_error(self):
        self.assertEqual(AUDIT.classify_response("https://awakenology.space/a", "link", "",
                         "", "", "TimeoutError"), "REQUEST_ERROR")

if __name__ == "__main__":
    unittest.main()
