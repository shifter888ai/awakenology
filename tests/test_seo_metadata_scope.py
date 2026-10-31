"""Regression tests for private-tool scope in the source SEO inventory."""
import unittest

from scripts import audit_seo_metadata as audit


class SeoMetadataScopeTests(unittest.TestCase):
    def test_editor_and_generator_pages_are_not_public_seo_pages(self):
        for path in ("editor/index.html", "editor/generator.html",
                     "editor/html-generator.html", "github-editor/index.html"):
            self.assertEqual(audit.page_scope(path), "special-editor")
        self.assertEqual(audit.page_scope("editorial/index.html"), "normal")
        self.assertEqual(audit.page_scope("English/index.html"), "normal")

    def test_private_tool_metadata_does_not_raise_public_seo_flags(self):
        by_path = {row["path"]: row for row in audit.build_rows()}
        for path in ("editor/generator.html", "editor/html-generator.html",
                     "github-editor/index.html"):
            self.assertEqual(by_path[path]["scope"], "special-editor")
            self.assertNotIn("missing-canonical", by_path[path]["flags"])
            self.assertNotIn("missing-description", by_path[path]["flags"])


if __name__ == "__main__":
    unittest.main()
