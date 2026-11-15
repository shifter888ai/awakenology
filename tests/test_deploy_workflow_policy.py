"""Offline regression tests for the production deployment approval gate."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "deploy.yml"


class ProductionDeployApprovalPolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = WORKFLOW.read_text(encoding="utf-8")

    def test_production_deploy_has_no_automatic_push_trigger(self):
        self.assertIn("workflow_dispatch:", self.source)
        self.assertNotIn("\n  push:", self.source)

    def test_deploy_requires_explicit_true_confirmation(self):
        self.assertIn("confirm_production_deploy:", self.source)
        self.assertIn("default: false", self.source)
        self.assertIn("type: boolean", self.source)
        self.assertIn("if: ${{ inputs.confirm_production_deploy == true }}", self.source)

    def test_cloudflare_deploy_action_is_retained(self):
        self.assertIn("cloudflare/wrangler-action@v4", self.source)
        self.assertIn("secrets.CLOUDFLARE_API_TOKEN", self.source)
        self.assertIn("secrets.CLOUDFLARE_ACCOUNT_ID", self.source)


if __name__ == "__main__":
    unittest.main()
