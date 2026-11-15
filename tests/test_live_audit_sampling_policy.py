"""Offline regression tests for the live-audit sampling policy."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "live-seo-runtime-audit.yml"


class WorkflowSamplingPolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = WORKFLOW.read_text(encoding="utf-8")

    def test_full_audit_requires_explicit_manual_opt_in(self):
        condition = "FULL_LIVE_AUDIT: ${{ github.event_name == 'workflow_dispatch' && inputs.run_full_audit == true }}"
        self.assertEqual(self.source.count(condition), 4)
        self.assertNotIn("github.event_name == 'schedule'", self.source)
        self.assertIn("run_full_audit:", self.source)
        self.assertIn("default: false", self.source)
        self.assertIn("type: boolean", self.source)

    def test_daily_schedule_uses_bounded_sample_commands(self):
        self.assertIn("schedule:", self.source)
        self.assertIn('cron: "17 3 * * *"', self.source)
        for command in (
            "python3 scripts/audit_live_links_assets.py --max-urls 100",
            "python3 scripts/audit_live_seo.py --max-routes 12",
            "python3 scripts/audit_browser_smoke.py --max-routes 6 --screenshots",
            "python3 scripts/audit_browser_accessibility.py --max-routes 12",
        ):
            self.assertIn(command, self.source)

    def test_full_scan_commands_remain_available_after_opt_in(self):
        for command in (
            "python3 scripts/audit_live_links_assets.py",
            "python3 scripts/audit_live_seo.py",
            "python3 scripts/audit_browser_smoke.py --screenshots",
            "python3 scripts/audit_browser_accessibility.py",
        ):
            self.assertIn(command, self.source)


if __name__ == "__main__":
    unittest.main()
