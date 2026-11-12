"""Offline route-selection tests for the bounded browser smoke audit."""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "audit_browser_smoke.py"
SPEC = importlib.util.spec_from_file_location("audit_browser_smoke", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


class ChineseRouteSelectionTests(unittest.TestCase):
    def test_source_language_distinguishes_kanji_only_japanese_article(self):
        url = AUDIT.DOMAIN + "/本源全視点vs個我単一視点/"
        self.assertEqual(AUDIT.source_language(url), "ja")
        self.assertFalse(AUDIT.is_chinese_content_route(url))

    def test_traditional_chinese_pages_are_selected_by_source_language(self):
        index = AUDIT.DOMAIN + "/Chinese/"
        article = AUDIT.DOMAIN + "/大揭露2/"
        self.assertEqual(AUDIT.source_language(index), "zh-hant")
        self.assertEqual(AUDIT.source_language(article), "zh-hant")
        self.assertTrue(AUDIT.is_chinese_content_route(index))
        self.assertTrue(AUDIT.is_chinese_content_route(article))

    def test_interaction_sample_is_bounded_and_excludes_japanese_routes(self):
        chinese_index = AUDIT.DOMAIN + "/Chinese/"
        chinese_article = AUDIT.DOMAIN + "/大揭露2/"
        japanese_index = AUDIT.DOMAIN + "/Japanese/"
        japanese_article = AUDIT.DOMAIN + "/本源全視点vs個我単一視点/"
        routes = [
            chinese_index,
            chinese_article,
            japanese_index,
            japanese_article,
            AUDIT.DOMAIN + "/English/",
        ]
        selected = AUDIT.select_chinese_interaction_routes(routes, limit=2)
        self.assertEqual(selected, [chinese_index, chinese_article])
        self.assertNotIn(japanese_index, selected)
        self.assertNotIn(japanese_article, selected)
        self.assertLessEqual(len(selected), 2)

    def test_nonpositive_interaction_limit_returns_no_routes(self):
        routes = [AUDIT.DOMAIN + "/Chinese/", AUDIT.DOMAIN + "/大揭露2/"]
        self.assertEqual(AUDIT.select_chinese_interaction_routes(routes, limit=0), [])


if __name__ == "__main__":
    unittest.main()
