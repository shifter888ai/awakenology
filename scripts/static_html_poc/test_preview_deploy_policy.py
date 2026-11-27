"""Offline policy tests for the isolated static-preview deployment workflow."""
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = (ROOT / ".github/workflows/deploy-static-preview.yml").read_text(encoding="utf-8")


class PreviewDeployPolicyTests(unittest.TestCase):
    def test_preview_deploy_is_manual_only(self):
        match = re.search(r"(?ms)^on:\n(?P<triggers>.*?)(?=^\S|\Z)", WORKFLOW)
        self.assertIsNotNone(match, "workflow trigger block must be present")
        triggers = match.group("triggers")
        self.assertRegex(triggers, r"(?m)^  workflow_dispatch:$")
        self.assertNotRegex(triggers, r"(?m)^  (push|pull_request|schedule):")

    def test_preview_deploy_requires_explicit_boolean_confirmation(self):
        self.assertRegex(
            WORKFLOW,
            r"(?ms)^  workflow_dispatch:\n    inputs:\n      confirm_preview_deploy:\n"
            r"        description: .+\n        required: true\n"
            r"        type: boolean\n        default: false$",
        )
        self.assertRegex(
            WORKFLOW,
            r"(?m)^    if: github\.event_name == 'workflow_dispatch' "
            r"&& inputs\.confirm_preview_deploy == true$",
        )

    def test_only_the_isolated_preview_configuration_is_deployed(self):
        self.assertIn("command: deploy --config wrangler.preview.jsonc", WORKFLOW)
        self.assertNotIn("wrangler.toml", WORKFLOW)
        self.assertNotIn("wrangler.jsonc", WORKFLOW)
        self.assertIn("awakenology-static-preview-521.shifter888.workers.dev", WORKFLOW)


if __name__ == "__main__":
    unittest.main()
