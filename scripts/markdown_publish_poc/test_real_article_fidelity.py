"""Regression tests for source-vs-generated article body text comparison."""
import unittest

from real_article_fidelity import text_diff_summary, visible_text


class RealArticleFidelityTextTests(unittest.TestCase):
    def test_generated_shell_title_is_excluded_from_body_comparison(self):
        source = (
            '<article class="article">'
            '<p>Original article title line</p>'
            '<h2>Section heading</h2>'
            '<p>Body text</p>'
            '</article>'
        )
        generated = (
            '<article class="article">'
            '<h1>Metadata-derived page title</h1>'
            '<p>Original article title line</p>'
            '<h2>Section heading</h2>'
            '<p>Body text</p>'
            '</article>'
        )
        self.assertEqual(
            visible_text(source),
            visible_text(generated, skip_shell_title=True),
        )

    def test_source_article_h1_is_preserved_after_shell_title_is_removed(self):
        source = (
            '<article class="article">'
            '<h1>Original content heading</h1>'
            '<p>Body text</p>'
            '</article>'
        )
        generated = (
            '<article class="article">'
            '<h1>Metadata-derived page title</h1>'
            '<h1>Original content heading</h1>'
            '<p>Body text</p>'
            '</article>'
        )
        self.assertEqual(
            visible_text(source),
            visible_text(generated, skip_shell_title=True),
        )

    def test_whitespace_normalization_collapses_runs(self):
        markup = '<article class="article"><p>A   B' + chr(10) + 'C</p></article>'
        self.assertEqual(visible_text(markup), "A B C")

    def test_text_diff_summary_identifies_a_missing_fragment(self):
        summary = text_diff_summary("before|missing phrase|after", "before||after")
        self.assertEqual(summary["segment_count"], 1)
        self.assertFalse(summary["truncated"])
        segment = summary["segments"][0]
        self.assertEqual(segment["operation"], "delete")
        self.assertEqual(segment["source_fragment"], "missing phrase")
        self.assertEqual(segment["output_fragment"], "")

    def test_default_diff_summary_includes_more_than_ten_segments(self):
        source = "|".join(f"source-{index}" for index in range(12))
        output = "|".join(f"output-{index}" for index in range(12))
        summary = text_diff_summary(source, output)
        self.assertGreater(summary["segment_count"], 10)
        self.assertEqual(len(summary["segments"]), summary["segment_count"])
        self.assertFalse(summary["truncated"])

    def test_missing_generated_shell_title_fails_closed(self):
        generated = '<article class="article"><p>Body text</p></article>'
        with self.assertRaisesRegex(ValueError, "missing its title H1"):
            visible_text(generated, skip_shell_title=True)


if __name__ == "__main__":
    unittest.main()
