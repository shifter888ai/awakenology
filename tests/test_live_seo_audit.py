import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit_live_seo.py"
SPEC = importlib.util.spec_from_file_location("audit_live_seo", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

class LiveSeoParserTests(unittest.TestCase):
    def parse(self, html):
        parser = AUDIT.Head()
        parser.feed(html)
        return parser

    def test_reads_language_title_description_canonical_and_open_graph(self):
        parser = self.parse(
            '<html lang="zh-Hant"><head><title>標題</title>'
            '<meta name="description" content="描述">'
            '<link rel="canonical" href="https://awakenology.space/example/">'
            '<meta property="og:title" content="標題">'
            '<meta property="og:description" content="描述">'
            '<meta property="og:url" content="https://awakenology.space/example/">'
            '<meta property="og:image" content="https://example.com/image.jpg">'
            '</head><body>正文</body></html>'
        )
        self.assertEqual(parser.lang, "zh-Hant")
        self.assertEqual(parser.titles, ["標題"])
        self.assertEqual(parser.desc, ["描述"])
        self.assertEqual(parser.canonicals, ["https://awakenology.space/example/"])
        self.assertEqual(parser.og["og:image"], ["https://example.com/image.jpg"])

    def test_keeps_duplicate_and_empty_tags_visible_to_audit(self):
        parser = self.parse(
            '<html lang="en"><head><title>One</title><title>Two</title>'
            '<meta name="description" content="">'
            '<meta property="og:image" content="">'
            '<meta property="og:image" content="https://example.com/image.jpg">'
            '</head></html>'
        )
        self.assertEqual(parser.titles, ["One", "Two"])
        self.assertEqual(parser.desc, [""])
        self.assertEqual(parser.og["og:image"], ["", "https://example.com/image.jpg"])

    def test_ignores_metadata_after_head(self):
        parser = self.parse(
            '<html lang="en"><head><title>Page</title></head>'
            '<body><meta name="description" content="not head metadata"></body></html>'
        )
        self.assertEqual(parser.desc, [])

if __name__ == "__main__":
    unittest.main()
