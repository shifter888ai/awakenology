"""Offline regression tests for the production deployment approval gate."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "deploy.yml"
LIVE_AUDIT_WORKFLOW = ROOT / ".github" / "workflows" / "live-seo-runtime-audit.yml"


class ProductionDeployApprovalPolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = WORKFLOW.read_text(encoding="utf-8")
        cls.live_audit_source = LIVE_AUDIT_WORKFLOW.read_text(encoding="utf-8")

    def test_production_deploy_has_no_automatic_push_trigger(self):
        self.assertIn("workflow_dispatch:", self.source)
        self.assertNotIn("\n  push:", self.source)

    def test_deploy_requires_explicit_true_confirmation(self):
        self.assertIn("confirm_production_deploy:", self.source)
        self.assertIn("default: false", self.source)
        self.assertIn("type: boolean", self.source)
        self.assertIn("if: ${{ github.event_name == 'workflow_dispatch' && inputs.confirm_production_deploy == true }}", self.source)

    def test_production_deploys_are_serialized_without_gating_policy_tests(self):
        deploy_block = self.source.split("  deploy:", 1)[1]
        self.assertIn("group: awakenology-production-deploy", deploy_block)
        self.assertIn("cancel-in-progress: false", deploy_block)
        self.assertNotIn("concurrency:", self.source.split("jobs:", 1)[0])

    def test_deployment_policy_tests_run_on_relevant_pull_requests(self):
        self.assertIn("pull_request:", self.source)
        self.assertIn(".github/workflows/live-seo-runtime-audit.yml", self.source)
        self.assertIn("policy-test:", self.source)
        self.assertIn("if: github.event_name == 'pull_request'", self.source)
        self.assertIn("python -m unittest discover -s tests -p 'test_deploy_workflow_policy.py' -v", self.source)

    def test_policy_only_changes_skip_live_production_audit(self):
        self.assertIn("!tests/test_deploy_workflow_policy.py", self.live_audit_source)
        self.assertIn("!.github/workflows/live-seo-runtime-audit.yml", self.live_audit_source)

    def test_cloudflare_deploy_action_is_retained(self):
        self.assertIn("cloudflare/wrangler-action@v4", self.source)
        self.assertIn("secrets.CLOUDFLARE_API_TOKEN", self.source)
        self.assertIn("secrets.CLOUDFLARE_ACCOUNT_ID", self.source)


if __name__ == "__main__":
    unittest.main()
