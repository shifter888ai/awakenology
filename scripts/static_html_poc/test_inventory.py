
"""Offline classification tests for public HTML migration inputs."""
import unittest
from check_full_inventory import KNOWN_STANDALONE_HTML,classify_public_html_paths,validate_public_html_manifest

class PublicHtmlClassificationTests(unittest.TestCase):
 def test_roswell_index_is_supported_and_pdf_rendering_remains_standalone(self):
  transformable,excluded,blocked,standalone=classify_public_html_paths([
   "index.html","Roswell/index.html","Roswell/Roswell.html","editor/index.html",
   "editor/generator.html","editor/html-generator.html","api/contact/index.html","404.html"])
  self.assertEqual(set(transformable),{"index.html","Roswell/index.html"})
  self.assertIn("editor/index.html",excluded)
  self.assertIn("api/contact/index.html",excluded)
  self.assertNotIn("api/contact/index.html",transformable)
  self.assertEqual(blocked,[])
  self.assertEqual([x["path"] for x in standalone],["Roswell/Roswell.html"])
  self.assertEqual(standalone[0]["source_git_blob_sha"],KNOWN_STANDALONE_HTML["Roswell/Roswell.html"]["source_git_blob_sha"])

 def test_worker_only_api_routes_never_enter_static_html_manifest(self):
  for route in ("/api/contact","/api/contact/","/api/editor/session"):
   with self.subTest(route=route), self.assertRaisesRegex(AssertionError,"Worker-only API routes"):
    validate_public_html_manifest([route])
  self.assertTrue(validate_public_html_manifest(["/Contact/"]))

 def test_unknown_standalone_public_html_fails_closed(self):
  with self.assertRaisesRegex(AssertionError,"Unclassified public HTML file"):
   classify_public_html_paths(["index.html","Other/report.html"])

 def test_roswell_pdf_rendering_remains_explicitly_standalone(self):
  self.assertIn("not an index route",KNOWN_STANDALONE_HTML["Roswell/Roswell.html"]["reason"])
  self.assertEqual(KNOWN_STANDALONE_HTML["Roswell/Roswell.html"]["source_git_blob_sha"],"8c61758277760518346d95cbb1dcab465f7a0c28")

if __name__=="__main__": unittest.main()
