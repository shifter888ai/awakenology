import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit_browser_smoke.py"
SPEC = importlib.util.spec_from_file_location("audit_browser_smoke", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

class BrowserSmokeHelpersTests(unittest.TestCase):
    def test_route_language_classification(self):
        cases = {
            "https://awakenology.space/": "home",
            "https://awakenology.space/English/": "en",
            "https://awakenology.space/en/": "en",
            "https://awakenology.space/日本語/": "ja",
            "https://awakenology.space/ja/": "ja",
            "https://awakenology.space/中文/": "zh",
            "https://awakenology.space/繁體中文/": "zh",
            "https://awakenology.space/articles/random/": "other",
        }
        for url, expected in cases.items():
            with self.subTest(url=url):
                self.assertEqual(AUDIT.route_language(url), expected)

    def test_mobile_sample_includes_home_and_language_buckets(self):
        routes = [
            "https://awakenology.space/",
            "https://awakenology.space/English/",
            "https://awakenology.space/English/a/",
            "https://awakenology.space/日本語/",
            "https://awakenology.space/日本語/a/",
            "https://awakenology.space/中文/",
            "https://awakenology.space/中文/a/",
            "https://awakenology.space/other/",
        ]
        selected = AUDIT.select_mobile_routes(routes, limit=6)
        self.assertIn("https://awakenology.space/", selected)
        languages = {AUDIT.route_language(url) for url in selected}
        self.assertIn("en", languages)
        self.assertIn("ja", languages)
        self.assertIn("zh", languages)
        self.assertLessEqual(len(selected), 6)

    def test_mobile_sample_is_deterministic_and_unique(self):
        routes = [f"https://awakenology.space/English/page-{i}/" for i in range(30)]
        a = AUDIT.select_mobile_routes(routes, limit=10)
        b = AUDIT.select_mobile_routes(routes, limit=10)
        self.assertEqual(a, b)
        self.assertEqual(len(a), len(set(a)))

if __name__ == "__main__":
    unittest.main()
