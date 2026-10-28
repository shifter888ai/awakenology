"""Offline tests for bounded live-audit sampling; no production requests."""
import unittest

from scripts.audit_live_seo import DOMAIN, select_sample_urls
from scripts.audit_live_links_assets import sample_urls


class LiveAuditSamplingTests(unittest.TestCase):
    def test_metadata_sample_keeps_home_and_ai_search(self):
        urls = [
            DOMAIN + "/",
            DOMAIN + "/English/",
            DOMAIN + "/Japanese/",
            DOMAIN + "/Chinese/",
            DOMAIN + "/ai-search/",
            DOMAIN + "/other/",
        ]
        sample = select_sample_urls(urls, 4)
        self.assertEqual(len(sample), 4)
        self.assertIn(DOMAIN + "/", sample)
        self.assertIn(DOMAIN + "/ai-search/", sample)

    def test_metadata_sample_is_deterministic_and_bounded(self):
        urls = [DOMAIN + f"/route-{i:03d}/" for i in range(30)]
        first = select_sample_urls(urls, 7)
        self.assertEqual(first, select_sample_urls(urls, 7))
        self.assertEqual(len(first), 7)
        self.assertTrue(set(first).issubset(set(urls)))

    def test_zero_limit_means_full_metadata_inventory(self):
        urls = [DOMAIN + "/", DOMAIN + "/ai-search/"]
        self.assertEqual(select_sample_urls(urls, 0), urls)

    def test_live_resource_sample_is_sorted_unique_and_bounded(self):
        urls = [f"https://awakenology.space/asset-{i:03d}.png" for i in range(40)]
        sample = sample_urls(urls + urls, 9)
        self.assertEqual(len(sample), 9)
        self.assertEqual(sample, sorted(set(sample)))
        self.assertEqual(sample, sample_urls(urls, 9))

    def test_zero_limit_means_full_resource_inventory(self):
        urls = ["https://example.com/b", "https://example.com/a"]
        self.assertEqual(sample_urls(urls, 0), sorted(urls))


if __name__ == "__main__":
    unittest.main()
