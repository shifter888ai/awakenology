from pathlib import Path
import os
import tempfile
import unittest

from build import build, read_document


ROOT = Path(__file__).parent
REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "fixtures" / "sample-article.md"


class MarkdownPublishPocTests(unittest.TestCase):
    def test_fixture_generates_semantic_html_and_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "preview" / "index.html"
            original = FIXTURE.read_bytes()
            build(FIXTURE, output)
            rendered = output.read_text(encoding="utf-8")
            self.assertEqual(FIXTURE.read_bytes(), original, "source must not be modified")
            self.assertIn('<html lang="en">', rendered)
            self.assertIn("<title>Markdown Publishing Test</title>", rendered)
            self.assertIn('name="description"', rendered)
            self.assertIn('<article class="article">', rendered)
            self.assertIn("<strong>Markdown source</strong>", rendered)
            self.assertIn("<table>", rendered)
            self.assertIn('<a href="https://awakenology.space">Awakenology</a>', rendered)
            self.assertIn('<pre><code class="language-text">', rendered)
            self.assertNotIn("## Content integrity", rendered)

    def test_missing_required_metadata_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "invalid.md"
            source.write_text("---\ntitle: Test\n---\nBody\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "description"):
                read_document(source)

    def test_unsupported_metadata_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "invalid.md"
            source.write_text(
                "---\ntitle: Test\ndescription: Test\nlang: en\nunknown: nope\n---\nBody\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "Unsupported metadata"):
                read_document(source)

    def test_duplicate_metadata_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "invalid.md"
            source.write_text(
                "---\ntitle: First\ntitle: Second\ndescription: Test\nlang: en\n---\nBody\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "Duplicate metadata"):
                read_document(source)

    def test_raw_script_html_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "unsafe.md"
            source.write_text(
                "---\ntitle: Test\ndescription: Test\nlang: en\n---\n<script>alert(1)</script>\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "unsupported or unsafe markup"):
                build(source, Path(temp) / "preview" / "index.html")

    def test_javascript_link_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "unsafe.md"
            source.write_text(
                "---\ntitle: Test\ndescription: Test\nlang: en\n---\n[click](javascript:alert%281%29)\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "unsupported or unsafe markup"):
                build(source, Path(temp) / "preview" / "index.html")

    def test_output_inside_repository_is_rejected(self):
        output = REPO_ROOT / "should-not-be-created-by-markdown-poc.html"
        with self.assertRaisesRegex(ValueError, "outside the repository tree"):
            build(FIXTURE, output)
        self.assertFalse(output.exists(), "blocked output must not be created")

    def test_source_cannot_be_overwritten(self):
        original = FIXTURE.read_bytes()
        with self.assertRaisesRegex(ValueError, "must not overwrite the source"):
            build(FIXTURE, FIXTURE)
        self.assertEqual(FIXTURE.read_bytes(), original)

    def test_preexisting_output_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "existing.html"
            original = b"keep this file unchanged"
            output.write_bytes(original)
            with self.assertRaisesRegex(ValueError, "must not already exist"):
                build(FIXTURE, output)
            self.assertEqual(output.read_bytes(), original)

    def test_hard_link_alias_to_source_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "source-alias.md"
            try:
                os.link(FIXTURE, output)
            except (OSError, NotImplementedError):
                self.skipTest("hard links are unavailable on this filesystem")
            original = FIXTURE.read_bytes()
            with self.assertRaisesRegex(ValueError, "must not already exist"):
                build(FIXTURE, output)
            self.assertEqual(FIXTURE.read_bytes(), original)
            self.assertEqual(output.read_bytes(), original)

    def test_symlink_resolving_into_repository_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "output.html"
            output.symlink_to(REPO_ROOT / "docs" / "markdown-publishing-poc.md")
            with self.assertRaisesRegex(ValueError, "outside the repository tree"):
                build(FIXTURE, output)


if __name__ == "__main__":
    unittest.main()
