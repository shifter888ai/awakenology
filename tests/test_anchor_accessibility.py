import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit_anchor_accessibility.py"
SPEC = importlib.util.spec_from_file_location("audit_anchor_accessibility", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

class AnchorAccessibilityTests(unittest.TestCase):
    def test_collects_ids_named_anchors_images_and_controls(self):
        p = AUDIT.PageParser()
        p.feed('<html><body><h2 id="section">Heading</h2><a name="legacy"></a><img src="x.jpg"><a href="#section">Read</a><button>Go</button></body></html>')
        self.assertIn(("section", "h2"), p.ids)
        self.assertIn(("legacy", "a"), p.ids)
        self.assertEqual(p.images, [("x.jpg", "missing-alt")])
        self.assertEqual(next(link for link in p.links if link["href"] == "#section")["text"].strip(), "Read")
        self.assertEqual(p.links[0]["href"], "")  # legacy named anchor is not a navigation link
        self.assertEqual(p.buttons[0]["text"].strip(), "Go")

    def test_page_resolution_supports_directory_routes(self):
        self.assertEqual(AUDIT.resolve_page("/").name, "index.html")
        self.assertEqual(AUDIT.resolve_page("/English/").name, "index.html")

    def test_fragment_urls_resolve_relative_to_source_page(self):
        source = AUDIT.ROOT / "English" / "index.html"
        resolved = AUDIT.urljoin(AUDIT.page_url(source), "../")
        self.assertEqual(resolved, "https://awakenology.space/")

if __name__ == "__main__":
    unittest.main()
