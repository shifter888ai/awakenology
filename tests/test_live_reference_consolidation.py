"""Regression tests for live-reference consolidation."""
import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "consolidate_audit_reports.py"
SPEC = importlib.util.spec_from_file_location("consolidate_audit_reports", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

def blank_reports():
    return {filename: [] for filename in AUDIT.INPUTS.values()}

class LiveReferenceConsolidationTests(unittest.TestCase):
    def test_redirects_are_retained_as_reviewable_warnings(self):
        reports = blank_reports()
        reports["live-link-asset-report.csv"] = [{
            "url": "https://awakenology.space/old-route",
            "result": "REDIRECT",
            "http_status": "200",
            "final_url": "https://awakenology.space/new-route/",
            "referenced_by_count": "4",
        }]
        issues = AUDIT.build_issues(reports)
        match = next(row for row in issues if row["source_report"] == "live-reference")
        self.assertEqual(match["severity"], "warning")
        self.assertEqual(match["status"], "redirect-review")
        self.assertIn("https://awakenology.space/new-route/", match["detail"])
        self.assertIn("4 source file(s)", match["detail"])

    def test_http_failures_remain_high_severity(self):
        reports = blank_reports()
        reports["live-link-asset-report.csv"] = [{
            "url": "https://awakenology.space/missing.png",
            "result": "HTTP_ERROR",
            "http_status": "404",
            "referenced_by_count": "2",
        }]
        issues = AUDIT.build_issues(reports)
        match = next(row for row in issues if row["source_report"] == "live-reference")
        self.assertEqual(match["severity"], "high")
        self.assertEqual(match["status"], "live-failure")

    def test_html_asset_fallback_is_visible_in_issue_register(self):
        reports = blank_reports()
        reports["live-link-asset-report.csv"] = [{
            "url": "https://awakenology.space/gallery/missing.png",
            "kind": "asset",
            "result": "CONTENT_TYPE_MISMATCH",
            "http_status": "200",
            "content_type": "text/html; charset=utf-8",
            "final_url": "https://awakenology.space/gallery/missing.png",
            "referenced_by_count": "7",
        }]
        issues = AUDIT.build_issues(reports)
        match = next(row for row in issues if row["source_report"] == "live-reference")
        self.assertEqual(match["severity"], "high")
        self.assertEqual(match["status"], "asset-content-review")
        self.assertIn("text/html", match["detail"])
        self.assertIn("7 source file(s)", match["detail"])

    def test_transient_request_failure_is_not_reported_as_http_404(self):
        reports = blank_reports()
        reports["live-link-asset-report.csv"] = [{
            "url": "https://awakenology.space/sometimes",
            "result": "REQUEST_ERROR",
            "http_status": "",
            "error": "TimeoutError",
            "referenced_by_count": "1",
        }]
        issues = AUDIT.build_issues(reports)
        match = next(row for row in issues if row["source_report"] == "live-reference")
        self.assertEqual(match["severity"], "warning")
        self.assertIn("TimeoutError", match["detail"])

if __name__ == "__main__":
    unittest.main()
