"""Guard the Word Generator's cleanup and generated metadata pipeline."""
import unittest
from pathlib import Path

SOURCE = (Path(__file__).resolve().parents[1] / "editor" / "generator.html").read_text(encoding="utf-8")


class GeneratorCleanupTests(unittest.TestCase):
    def test_cleanup_runs_after_word_formatting_restoration(self):
        self.assertIn(
            "await restoreWordFormatting(buffer,article);\n  cleanGeneratedArticle(article);",
            SOURCE,
        )
        self.assertIn("if(article.textContent!==before", SOURCE)
        self.assertIn("Unsupported Word HTML residue remains", SOURCE)

    def test_generated_metadata_is_refreshed_before_preview(self):
        call = "if(suppliedTitle||!isExisting)updateGeneratedMetadata(parsed,article,suppliedTitle);"
        self.assertIn(call, SOURCE)
        self.assertIn("""set('meta[property="og:description"]',summary)""", SOURCE)
        self.assertLess(SOURCE.index(call), SOURCE.index("generatedHtml='<!doctype html>"))

    def test_embedded_image_uses_its_final_published_asset_for_og_image(self):
        self.assertIn("if(title.value.trim()||baselineSha256==='NEW'){", SOURCE)
        self.assertIn('meta[property="og:image"]', SOURCE)
        self.assertIn("https://awakenology.space", SOURCE)


if __name__ == "__main__":
    unittest.main()
