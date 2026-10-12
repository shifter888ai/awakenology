"""Regression tests for source anchor resolution and self-closing markup."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlsplit
import csv

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit_anchor_accessibility.py"
SPEC = importlib.util.spec_from_file_location("audit_anchor_accessibility", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

class AnchorAuditTests(unittest.TestCase):
    def test_self_closing_image_is_checked(self):
        parser = AUDIT.PageParser()
        parser.feed('<img src="/gallery/a.png"/><img src="/gallery/b.png" alt=""/>')
        self.assertEqual(parser.images, [("/gallery/a.png", "missing-alt")])

    def test_same_page_fragment_is_checked_and_valid_fragment_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            page = root / "index.html"
            page.write_text('<h2 id="valid">Title</h2><a href="#valid">Good</a>'
                            '<a href="#missing">Bad</a>', encoding="utf-8")
            output = root / "anchor-accessibility-report.csv"
            with patch.object(AUDIT, "ROOT", root), patch.object(AUDIT, "OUT", output), \
                 patch("sys.argv", ["audit_anchor_accessibility.py"]):
                self.assertEqual(AUDIT.main(), 0)
            with output.open(encoding="utf-8", newline="") as stream:
                rows = list(csv.DictReader(stream))
            broken = [r for r in rows if r["issue"] == "broken-fragment"]
            self.assertEqual(len(broken), 1)
            self.assertEqual(broken[0]["reference"], "#missing")
            self.assertEqual(broken[0]["target"], "index.html")

if __name__ == "__main__":
    unittest.main()
