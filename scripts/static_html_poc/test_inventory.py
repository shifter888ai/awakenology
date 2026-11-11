
"""Offline classification tests for public HTML migration inputs."""
import unittest
from check_full_inventory import KNOWN_BLOCKED_ROUTES,KNOWN_STANDALONE_HTML,classify_public_html_paths

class PublicHtmlClassificationTests(unittest.TestCase):
 def test_roswell_route_is_reported_blocked_not_transformed(self):
  transformable,excluded,blocked,standalone=classify_public_html_paths([
   "index.html","Roswell/index.html","Roswell/Roswell.html","editor/index.html",
   "editor/generator.html","editor/html-generator.html","404.html"])
  self.assertEqual(transformable,["index.html"])
  self.assertIn("editor/index.html",excluded)
  self.assertEqual([x["path"] for x in blocked],["Roswell/index.html"])
  self.assertEqual([x["route"] for x in blocked],["/Roswell/"])
  self.assertEqual([x["path"] for x in standalone],["Roswell/Roswell.html"])
  self.assertEqual(blocked[0]["source_git_blob_sha"],KNOWN_BLOCKED_ROUTES["Roswell/index.html"]["source_git_blob_sha"])
  self.assertEqual(standalone[0]["source_git_blob_sha"],KNOWN_STANDALONE_HTML["Roswell/Roswell.html"]["source_git_blob_sha"])

 def test_unknown_standalone_public_html_fails_closed(self):
  with self.assertRaisesRegex(AssertionError,"Unclassified public HTML file"):
   classify_public_html_paths(["index.html","Other/report.html"])

 def test_roswell_sources_have_distinct_explicit_classifications(self):
  self.assertIn("no <article> or <main>",KNOWN_BLOCKED_ROUTES["Roswell/index.html"]["reason"])
  self.assertIn("not an index route",KNOWN_STANDALONE_HTML["Roswell/Roswell.html"]["reason"])

if __name__=="__main__": unittest.main()
