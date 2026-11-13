"""Offline classification tests for public HTML migration inputs."""
import unittest
from check_full_inventory import classify_public_html_paths,validate_public_html_manifest

class PublicHtmlClassificationTests(unittest.TestCase):
 def test_roswell_index_is_supported_and_private_pages_are_excluded(self):
  transformable,excluded=classify_public_html_paths([
   "index.html","Roswell/index.html","editor/index.html",
   "editor/generator.html","editor/html-generator.html","api/contact/index.html",
   "Internal/New-Article/index.html","internal/new-article/index.html","New-Article/index.html","404.html"])
  self.assertEqual(set(transformable),{"index.html","Roswell/index.html"})
  self.assertIn("editor/index.html",excluded)
  self.assertIn("api/contact/index.html",excluded)
  self.assertIn("Internal/New-Article/index.html",excluded)
  self.assertIn("internal/new-article/index.html",excluded)
  self.assertIn("New-Article/index.html",excluded)
  self.assertNotIn("api/contact/index.html",transformable)

 def test_deleted_roswell_pdf_rendering_is_unclassified_if_reintroduced(self):
  with self.assertRaisesRegex(AssertionError,"Unclassified public HTML file"):
   classify_public_html_paths(["index.html","Roswell/index.html","Roswell/Roswell.html"])

 def test_worker_only_api_routes_never_enter_static_html_manifest(self):
  for route in ("/api/contact","/api/contact/","/api/editor/session"):
   with self.subTest(route=route), self.assertRaisesRegex(AssertionError,"Worker-only API routes"):
    validate_public_html_manifest([route])
  self.assertTrue(validate_public_html_manifest(["/Contact/"]))

 def test_unknown_public_html_fails_closed(self):
  with self.assertRaisesRegex(AssertionError,"Unclassified public HTML file"):
   classify_public_html_paths(["index.html","Other/report.html"])

if __name__=="__main__": unittest.main()
