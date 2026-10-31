from pathlib import Path
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
            self.assertIn("<pre><code class=\"language-text\">", rendered)
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

    def test_symlink_resolving_into_repository_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "output.html"
            output.symlink_to(REPO_ROOT / "docs" / "markdown-publishing-poc.md")
            with self.assertRaisesRegex(ValueError, "outside the repository tree"):
                build(FIXTURE, output)


if __name__ == "__main__":
    unittest.main()
