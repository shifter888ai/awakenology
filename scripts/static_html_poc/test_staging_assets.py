"""Offline regression tests for staging asset path resolution."""
import unittest

from build_staging import local_asset_references


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


if __name__ == "__main__":
    unittest.main()
