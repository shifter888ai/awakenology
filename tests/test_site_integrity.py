import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit_site_integrity.py"
SPEC = importlib.util.spec_from_file_location("audit_site_integrity", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

class SiteIntegrityTests(unittest.TestCase):
    def test_canonical_page_urls_for_root_and_nested_index(self):
        self.assertEqual(AUDIT.canonical_page_url(AUDIT.ROOT / "index.html"), "https://awakenology.space/")
        self.assertEqual(AUDIT.canonical_page_url(AUDIT.ROOT / "English" / "index.html"), "https://awakenology.space/English/")

    def test_external_and_fragment_refs_are_skipped(self):
        self.assertEqual(AUDIT.local_target("https://example.com/page", "https://awakenology.space/", AUDIT.ROOT / "index.html", "link")[1], "EXTERNAL")
        self.assertEqual(AUDIT.local_target("#section", "https://awakenology.space/", AUDIT.ROOT / "index.html", "link")[1], "SKIP")

    def test_html_parser_collects_links_srcset_and_inline_css(self):
        p = AUDIT.HtmlRefs()
        p.feed('<html><head><style>.x{background:url("/img/a.png")}</style></head><body><a href="/English/">English</a><img src="/img/a.jpg" srcset="/img/a.jpg 1x, /img/b.jpg 2x" style="background:url(/img/c.png)"></body></html>')
        self.assertTrue(any(x[3] == "/English/" for x in p.refs))
        self.assertTrue(any(x[2] == "srcset" and x[3] == "/img/b.jpg" for x in p.refs))
        self.assertTrue(any("/img/a.png" in css for css in p.inline_css))
        self.assertTrue(any("/img/c.png" in css for css in p.inline_css))

    def test_css_url_extraction(self):
        refs = AUDIT.css_references('a{background:url("../images/a.png")} @import "theme.css";')
        self.assertIn(("../images/a.png", "css-url"), refs)
        self.assertIn(("theme.css", "css-import"), refs)

if __name__ == "__main__":
    unittest.main()
