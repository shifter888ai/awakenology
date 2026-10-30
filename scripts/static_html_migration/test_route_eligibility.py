"""Offline negative tests for the report-only route eligibility gate."""
import unittest
from route_eligibility import classify, parse_sitemap, validate_route

SITE = "https://awakenology.space"

def xml(*paths):
    return ('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
            ''.join(f'<url><loc>{SITE}{path}</loc></url>' for path in paths) +
            '</urlset>').encode()

class RouteEligibilityTests(unittest.TestCase):
    def setUp(self):
        self.config = {"schema": 1, "mode": "report-only", "routes": []}
        self.tracked = ["index.html", "Chinese/index.html", "New-Article/index.html",
                        "ai-search/index.html", "editor/index.html", "editor/generator.html", "404.html"]
        self.sitemap = {"/", "/Chinese/"}

    def test_report_only_candidates_and_exclusions(self):
        result = classify(self.tracked, self.sitemap, self.config)
        self.assertEqual(result["eligible_candidates"], ["/", "/Chinese/"])
        self.assertFalse(result["activated"])
        self.assertEqual(result["proposed_allowlist"], [])
        self.assertEqual(len(result["excluded_tracked_html"]), 5)

    def test_explicit_candidate_is_still_report_only(self):
        self.config["routes"] = ["/Chinese/"]
        self.assertEqual(classify(self.tracked, self.sitemap, self.config)["proposed_allowlist"], ["/Chinese/"])

    def test_missing_sitemap_source_fails(self):
        with self.assertRaisesRegex(ValueError, "lack tracked HTML"):
            classify(self.tracked, self.sitemap | {"/Missing/"}, self.config)

    def test_unknown_candidate_fails(self):
        self.config["routes"] = ["/Missing/"]
        with self.assertRaisesRegex(ValueError, "not an eligible"):
            classify(self.tracked, self.sitemap, self.config)

    def test_private_and_dynamic_routes_fail(self):
        for route in ("/editor/", "/github-editor/", "/New-Article/", "/ai-search/",
                      "/api/", "/oauth/", "/Editor/", "/404/"):
            with self.subTest(route=route), self.assertRaises(ValueError):
                validate_route(route)

    def test_ambiguous_routes_fail(self):
        for route in ("/foo//bar/", "/foo/../bar/", "/foo/./", "/%65ditor/",
                      "/foo/?x=1", "/foo/#frag", "foo/", "/foo", "/foo\\bar/"):
            with self.subTest(route=route), self.assertRaises(ValueError):
                validate_route(route)

    def test_unicode_route_is_allowed(self):
        self.assertEqual(validate_route("/大揭露7/"), "/大揭露7/")

    def test_bad_mode_fails(self):
        self.config["mode"] = "static"
        with self.assertRaisesRegex(ValueError, "report-only"):
            classify(self.tracked, self.sitemap, self.config)

    def test_missing_config_field_fails(self):
        del self.config["routes"]
        with self.assertRaisesRegex(ValueError, "schema mismatch"):
            classify(self.tracked, self.sitemap, self.config)

    def test_duplicate_allowlist_fails(self):
        self.config["routes"] = ["/", "/"]
        with self.assertRaisesRegex(ValueError, "duplicate-free"):
            classify(self.tracked, self.sitemap, self.config)

    def test_non_list_allowlist_fails(self):
        self.config["routes"] = "/"
        with self.assertRaisesRegex(ValueError, "duplicate-free"):
            classify(self.tracked, self.sitemap, self.config)

    def test_sitemap_parses_unicode_url(self):
        self.assertEqual(parse_sitemap(xml("/", "/%E5%A4%A7%E6%8F%AD%E9%9C%B27/")), {"/", "/大揭露7/"})

    def test_sitemap_duplicate_decoded_route_fails(self):
        with self.assertRaisesRegex(ValueError, "Duplicate decoded"):
            parse_sitemap(xml("/Chinese/", "/Chinese/"))

    def test_sitemap_noindex_route_fails(self):
        with self.assertRaisesRegex(ValueError, "ineligible"):
            parse_sitemap(xml("/ai-search/"))

    def test_sitemap_empty_fails(self):
        with self.assertRaisesRegex(ValueError, "no URL"):
            parse_sitemap(b'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')

    def test_sitemap_other_host_fails(self):
        with self.assertRaisesRegex(ValueError, "Noncanonical"):
            parse_sitemap(xml("/").replace(b"awakenology.space", b"other.example"))

if __name__ == "__main__":
    unittest.main()
