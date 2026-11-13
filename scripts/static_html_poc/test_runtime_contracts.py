"""Offline regression tests for pull-request runtime-contract mode."""
import io
import json
import os
import tempfile
from contextlib import redirect_stdout
from pathlib import Path
from unittest import TestCase, mock

import check_runtime_contracts as runtime


class RuntimeContractModeTests(TestCase):
    def test_pull_request_mode_is_source_only_and_never_probes_http(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            report_path = Path(temp_dir) / "runtime-contract-report.json"
            with (
                mock.patch.dict(os.environ, {"GITHUB_EVENT_NAME": "pull_request"}),
                mock.patch.object(runtime, "REPORT", str(report_path)),
                mock.patch.object(runtime, "probe", side_effect=AssertionError("HTTP probe must not run")),
                redirect_stdout(io.StringIO()),
            ):
                runtime.main()

            report = json.loads(report_path.read_text(encoding="utf-8"))
            self.assertEqual(report["mode"], "pull_request source-only; no HTTP requests")
            self.assertEqual(report["http_baseline_matrix"], [])
            self.assertEqual(report["checks_passed"], report["checks_total"])
            self.assertEqual(report["checks_total"], 6)


if __name__ == "__main__":
    import unittest
    unittest.main()
