import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from scripts.audit_seo_metadata import build_rows


HTML = """<!doctype html>
<html lang="en"><head>
<title>Example page</title>
<meta name="description" content="An example page.">
<link rel="canonical" href="https://awakenology.space/English/">
</head><body><main>Content</main></body></html>
"""


class SeoMetadataInventoryScopeTests(unittest.TestCase):
    def test_excludes_tooling_html_but_keeps_public_and_special_routes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            files = {
                "English/index.html": HTML,
                "404.html": HTML,
                "editor/index.html": HTML,
                "docs/example.html": "<html><head></head><body>docs</body></html>",
                "scripts/static_html_poc/assets/theme.html": "<html><head></head><body>fixture</body></html>",
                "source/static-html-isolated-output/index.html": "<html><head></head><body>build output</body></html>",
                "tests/fixture.html": "<html><head></head><body>test fixture</body></html>",
                ".github/fixture.html": "<html><head></head><body>workflow fixture</body></html>",
            }
            for relative, content in files.items():
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")

            rows = build_rows(root)
            by_path = {row["path"]: row for row in rows}

            self.assertEqual(
                set(by_path),
                {"English/index.html", "404.html", "editor/index.html"},
            )
            self.assertEqual(by_path["404.html"]["scope"], "special-404")
            self.assertEqual(by_path["editor/index.html"]["scope"], "special-editor")
            self.assertEqual(by_path["English/index.html"]["scope"], "normal")


if __name__ == "__main__":
    unittest.main()
