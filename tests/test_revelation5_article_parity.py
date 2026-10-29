"""Exact source-level Article 5 text/image parity against pre-cleanup fixture."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
class Revelation5ParityTests(unittest.TestCase):
 def test_revelation5_original_text_and_images(self):
     source = (ROOT / "大揭露5" / "index.html").read_text(encoding="utf-8")
     match = re.search(r'<article class="article">[\s\S]*?</article>', source)
     assert match, "Article body missing"
     article = match.group()
     text = re.sub(r'<[^>]*>', '', re.sub(r'<!--[\s\S]*?-->', '', article))
     images = re.findall(r'<img\b[^>]*>', article, flags=re.I)
     expected = json.loads((ROOT / "tests/fixtures/revelation5_article_parity.json").read_text(encoding="utf-8"))
     assert text == expected["article_text"], "Article 5 text or whitespace changed"
     normalized_images = [re.sub(r'\s+alt="[^"]*"', "", image) for image in images]
     assert normalized_images == expected["image_tags"], "Article 5 image source/style attributes changed"
     assert all(re.search(r'\salt="[^"]*"', image) for image in images), "Article 5 images must have alt text"
     assert not re.search(r'<!--\[if|<!--\[endif\]-->|</?font\b|<o:p>\s*</o:p>', article, flags=re.I)
