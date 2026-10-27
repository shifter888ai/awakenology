"""Offline regression tests for the isolated inventory gate (no network/deploy)."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import verify_inventory as gate


def sha(data):
    return hashlib.sha256(data).hexdigest()


class InventoryGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.out = self.root / "static-html-isolated-output"
        self.out.mkdir()
        self.source = b"<html>source</html>"
        self.built = b"<html>built</html>"
        (self.root / "index.html").write_bytes(self.source)
        (self.out / "index.html").write_bytes(self.built)
        self.rows = [{
            "path": "index.html", "route": "/",
            "source_sha256": sha(self.source), "built_sha256": sha(self.built)
        }]
        self.paths = b"index.html\0"
        self.write_manifest()

    def write_manifest(self):
        (self.out / "manifest.json").write_text(
            json.dumps({"failures": [], "routes": self.rows}), encoding="utf-8"
        )

    def verify(self):
        with patch.object(gate, "ROOT", self.root), patch.object(gate, "OUT", self.out), \
             patch.object(gate.subprocess, "check_output", return_value=self.paths):
            gate.verify()

    def test_valid_artifact_passes(self):
        self.verify()

    def test_missing_route_rejected(self):
        self.rows = []
        self.write_manifest()
        with self.assertRaisesRegex(AssertionError, "inventory mismatch"):
            self.verify()

    def test_duplicate_route_rejected(self):
        self.rows.append(dict(self.rows[0]))
        self.write_manifest()
        with self.assertRaisesRegex(AssertionError, "inventory mismatch"):
            self.verify()

    def test_wrong_source_hash_rejected(self):
        self.rows[0]["source_sha256"] = "0" * 64
        self.write_manifest()
        with self.assertRaisesRegex(AssertionError, "Source hash mismatch"):
            self.verify()

    def test_wrong_output_hash_rejected(self):
        self.rows[0]["built_sha256"] = "0" * 64
        self.write_manifest()
        with self.assertRaisesRegex(AssertionError, "Output hash mismatch"):
            self.verify()

    def test_missing_generated_html_rejected(self):
        (self.out / "index.html").unlink()
        with self.assertRaises((AssertionError, FileNotFoundError)):
            self.verify()

    def test_unlisted_generated_html_rejected(self):
        (self.out / "extra.html").write_text("unexpected", encoding="utf-8")
        with self.assertRaisesRegex(AssertionError, "Generated HTML inventory mismatch"):
            self.verify()

    def test_reported_build_failure_rejected(self):
        (self.out / "manifest.json").write_text(
            json.dumps({"failures": ["deliberate"], "routes": self.rows}), encoding="utf-8"
        )
        with self.assertRaisesRegex(AssertionError, "manifest reports failures"):
            self.verify()


if __name__ == "__main__":
    unittest.main()
