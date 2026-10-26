"""Guard against accidentally dropping Generator cleanup and metadata safeguards."""
from pathlib import Path

SOURCE = (Path(__file__).resolve().parents[1] / "editor" / "generator.html").read_text(encoding="utf-8")

def test_cleanup_is_called_after_word_restoration():
    assert "await restoreWordFormatting(buffer,article);\n   cleanGeneratedArticle(article);" in SOURCE
    assert "if(article.textContent!==before" in SOURCE
    assert "Unsupported Word HTML residue remains" in SOURCE

def test_metadata_is_refreshed_before_preview():
    assert "updateGeneratedMetadata(parsed,article,suppliedTitle);" in SOURCE
    assert "set('meta[property=\"og:description\"]',summary)" in SOURCE
