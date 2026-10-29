import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit_live_links_assets.py"
SPEC = importlib.util.spec_from_file_location("audit_live_links_assets", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

class LiveLinkAssetTests(unittest.TestCase):
    def test_root_and_nested_source_base(self):
        self.assertEqual(AUDIT.source_base("index.html"), "https://awakenology.space/")
        self.assertEqual(AUDIT.source_base("English/index.html"), "https://awakenology.space/English/")

    def test_resolves_relative_and_root_relative_references(self):
        self.assertEqual(AUDIT.make_url("English/index.html", "../images/a.jpg"), "https://awakenology.space/images/a.jpg")
        self.assertEqual(AUDIT.make_url("English/index.html", "/gallery/a.png"), "https://awakenology.space/gallery/a.png")

    def test_removes_fragments_but_keeps_query(self):
        self.assertEqual(AUDIT.make_url("index.html", "/page/?v=2#section"), "https://awakenology.space/page/?v=2")

    def test_private_editor_sources_and_public_host_paths_are_not_probed(self):
        self.assertEqual(AUDIT.make_url("editor/index.html", "/editor/generator.html"), "")
        self.assertEqual(AUDIT.make_url("editor/generator.html", "/gallery/logo.svg"), "")
        self.assertEqual(AUDIT.make_url("github-editor/index.html", "/gallery/logo.svg"), "")
        self.assertEqual(AUDIT.make_url("index.html", "/editor/shared-editing-core.js"), "")
        self.assertEqual(AUDIT.make_url("index.html", "/editor"), "")
        self.assertEqual(AUDIT.make_url("index.html", "/github-editor/"), "")
        # Prefix matching must not hide ordinary public routes.
        self.assertEqual(AUDIT.make_url("index.html", "/editorial/"),
                         "https://awakenology.space/editorial/")

    def test_ignores_external_and_non_http_schemes(self):
        self.assertEqual(AUDIT.make_url("index.html", "https://example.com/a.png"), "")
        self.assertEqual(AUDIT.make_url("index.html", "mailto:test@example.com"), "")
        self.assertEqual(AUDIT.make_url("index.html", "#section"), "")

if __name__ == "__main__":
    unittest.main()
