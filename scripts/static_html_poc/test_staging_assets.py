"""Offline regression tests for staging HTML/CSS asset references."""
import unittest

from build_staging import (
    css_import_paths,
    local_asset_references,
    local_css_references,
    srcset_urls,
    stylesheet_paths,
)


class LocalAssetReferenceTests(unittest.TestCase):
    def test_nested_parent_reference_resolves_inside_site_root(self):
        failures = local_asset_references(
            '<img src="../../gallery/cover.jpg">',
            {"gallery/cover.jpg"},
            "/Chinese/sub/",
        )
        self.assertEqual(failures, [])

    def test_nested_parent_directory_reference_resolves_index(self):
        failures = local_asset_references(
            '<iframe src="../../gallery/">',
            {"gallery/index.html"},
            "/Chinese/sub/",
        )
        self.assertEqual(failures, [])

    def test_parent_reference_that_escapes_site_root_is_rejected(self):
        failures = local_asset_references(
            '<img src="../../../outside.png">',
            {"outside.png"},
            "/Chinese/sub/",
        )
        self.assertEqual(len(failures), 1)
        self.assertEqual(failures[0]["error"], "path escapes site root")

    def test_percent_encoded_parent_segments_are_normalized_before_check(self):
        failures = local_asset_references(
            '<img src="..%2F..%2F..%2Foutside.png">',
            {"outside.png"},
            "/Chinese/sub/",
        )
        self.assertEqual(len(failures), 1)
        self.assertEqual(failures[0]["error"], "path escapes site root")

    def test_srcset_checks_every_candidate_and_ignores_data_uri_commas(self):
        failures = local_asset_references(
            '<img srcset="/gallery/a.jpg 1x, '
            'data:image/svg+xml,%3Csvg%3E 2x, /gallery/missing.jpg 3x">',
            {"gallery/a.jpg"},
            "/",
        )
        self.assertEqual(len(failures), 1)
        self.assertEqual(failures[0]["value"], "/gallery/missing.jpg")
        self.assertEqual(failures[0]["attribute"], "srcset")

    def test_srcset_candidates_without_descriptors_are_split(self):
        self.assertEqual(
            list(srcset_urls("/gallery/a.jpg, /gallery/b.jpg")),
            ["/gallery/a.jpg", "/gallery/b.jpg"],
        )

    def test_inline_style_and_style_block_urls_are_checked(self):
        html = (
            '<div style="background:url(../img/inline.png)"></div>'
            '<style>.hero{background-image:url("/img/hero.png")}</style>'
        )
        failures = local_asset_references(
            html,
            {"img/inline.png", "img/hero.png"},
            "/pages/",
        )
        self.assertEqual(failures, [])

    def test_linked_stylesheet_is_discovered_relative_to_page_route(self):
        paths = stylesheet_paths(
            '<link rel="stylesheet" href="../../css/site.css">',
            {"css/site.css"},
            "/pages/nested/",
        )
        self.assertEqual(paths, ["css/site.css"])

    def test_external_stylesheet_urls_and_imports_resolve_from_css_directory(self):
        css = (
            "body{background:url('../img/bg.png')}"
            "@import 'theme.css';"
        )
        tracked = {"img/bg.png", "css/theme.css"}
        self.assertEqual(
            local_css_references(css, tracked, "css/site.css"),
            [],
        )
        self.assertEqual(
            css_import_paths(css, tracked, "css/site.css"),
            ["css/theme.css"],
        )

    def test_imported_css_url_scheme_is_checked_and_root_escape_rejected(self):
        failures = local_css_references(
            ".x{background:url('../../../outside.png')}",
            {"outside.png"},
            "css/site.css",
        )
        self.assertEqual(len(failures), 1)
        self.assertEqual(failures[0]["error"], "path escapes site root")

    def test_css_comments_do_not_create_false_asset_references(self):
        failures = local_css_references(
            "/* url('/missing/comment.png') */ .x{background:url('/img/ok.png')}",
            {"img/ok.png"},
            "css/site.css",
        )
        self.assertEqual(failures, [])


if __name__ == "__main__":
    unittest.main()
