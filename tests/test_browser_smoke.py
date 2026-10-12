import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit_browser_smoke.py"
SPEC = importlib.util.spec_from_file_location("audit_browser_smoke", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

class BrowserSmokeHelpersTests(unittest.TestCase):
    def test_language_route_selector_includes_home_and_language_paths(self):
        self.assertTrue(AUDIT.language_route("https://awakenology.space/"))
        self.assertTrue(AUDIT.language_route("https://awakenology.space/English/"))
        self.assertTrue(AUDIT.language_route("https://awakenology.space/日本語/"))
        self.assertFalse(AUDIT.language_route("https://awakenology.space/articles/random/"))

if __name__ == "__main__":
    unittest.main()
