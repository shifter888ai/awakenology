import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "consolidate_audit_reports.py"
SPEC = importlib.util.spec_from_file_location("consolidate_audit_reports", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

class ConsolidateAuditReportsTests(unittest.TestCase):
    def test_source_seo_warning_is_separated_from_live_failure(self):
        reports = {
            "seo-metadata-report.csv": [{"path":"A/index.html","flags":"missing-description;duplicate-title"}],
            "seo-runtime-report.csv": [{"url":"https://awakenology.space/A/","errors":""}],
            "site-integrity-report.csv": [],
            "live-link-asset-report.csv": [],
            "anchor-accessibility-report.csv": [],
        }
        issues = AUDIT.build_issues(reports)
        self.assertEqual(len(issues), 2)
        self.assertTrue(all(row["status"] == "source-only" for row in issues))
        self.assertTrue(all(row["source_report"] == "seo-source" for row in issues))

    def test_live_http_failure_is_high_severity(self):
        reports = {
            "seo-metadata-report.csv": [],
            "seo-runtime-report.csv": [],
            "site-integrity-report.csv": [],
            "live-link-asset-report.csv": [{"result":"HTTP_ERROR","http_status":"404","url":"https://awakenology.space/missing/","referenced_by_count":"3","error":""}],
            "anchor-accessibility-report.csv": [],
        }
        issues = AUDIT.build_issues(reports)
        self.assertEqual(issues[0]["severity"], "high")
        self.assertEqual(issues[0]["status"], "live-failure")

    def test_duplicate_findings_are_collapsed_with_occurrence_count(self):
        reports = {
            "seo-metadata-report.csv": [],
            "seo-runtime-report.csv": [],
            "site-integrity-report.csv": [
                {"status":"BROKEN","source":"a.html","reference":"/missing/","target":"missing/index.html"},
                {"status":"BROKEN","source":"a.html","reference":"/missing/","target":"missing/index.html"},
            ],
            "live-link-asset-report.csv": [],
            "anchor-accessibility-report.csv": [],
        }
        issues = AUDIT.build_issues(reports)
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]["occurrences"], 1) # same normalized issue is one unique row

    def test_missing_reports_are_visible_and_strict_mode_is_optional(self):
        reports = {name: None for name in AUDIT.INPUTS.values()}
        issues = AUDIT.build_issues(reports)
        self.assertEqual(len(issues), len(AUDIT.INPUTS))
        self.assertTrue(all(row["status"] == "report-missing" for row in issues))

if __name__ == "__main__":
    unittest.main()
