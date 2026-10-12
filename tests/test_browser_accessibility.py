import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit_browser_accessibility.py"
SPEC = importlib.util.spec_from_file_location("audit_browser_accessibility", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

class RenderedAccessibilityHelpersTests(unittest.TestCase):
    def test_language_classification(self):
        cases = {"en":"en","en-US":"en","ja":"ja","ja-JP":"ja","zh-Hant":"zh","zh-CN":"zh","":"missing","x-private":"other"}
        for value, expected in cases.items():
            with self.subTest(value=value):
                self.assertEqual(AUDIT.classify_language(value), expected)

if __name__ == "__main__":
    unittest.main()
