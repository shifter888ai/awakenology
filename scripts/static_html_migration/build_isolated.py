"""Build isolated public HTML artifacts from main using the frozen PoC transformer.

Run from the source checkout with POC_SCRIPTS pointing to a separate checkout.
No tracked source files or deployed Worker files are modified.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
POC = Path(os.environ["POC_SCRIPTS"]).resolve()
sys.path.insert(0, str(POC))
from html_transformer import transform
from page_rules import rules_for
from parity_validator import validate, validate_metadata

OUT = ROOT / "static-html-isolated-output"
EXCLUDED = ("editor/", "github-editor/", "scripts/", "tests/", "docs/", ".github/")
paths = sorted(filter(None, subprocess.check_output(
    ["git", "ls-files", "-z", "--", "*.html"], cwd=ROOT
).decode("utf-8").split("\0")))
report = {"scope": "source-only isolated build; no live Worker or browser equivalence", "routes": [], "failures": []}
for path in paths:
    if path.startswith(EXCLUDED) or path == "404.html":
        continue
    if path != "index.html" and not path.endswith("/index.html"):
        report["failures"].append({"path": path, "error": "Unclassified public HTML"})
        continue
    route = "/" if path == "index.html" else "/" + path[:-len("index.html")]
    try:
        raw = (ROOT / path).read_bytes()
        source = raw.decode("utf-8")
        built = transform(source, route)
        validate(source, built)
        rules = rules_for(route)
        validate_metadata(built, canonical=rules.canonical, noindex=rules.noindex)
        if built != transform(source, route) or built != transform(built, route):
            raise AssertionError("Non-reproducible or non-idempotent output")
        target = OUT / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(built.encode("utf-8"))
        report["routes"].append({"path": path, "route": route,
            "source_sha256": hashlib.sha256(raw).hexdigest(),
            "built_sha256": hashlib.sha256(built.encode("utf-8")).hexdigest()})
    except Exception as exc:
        report["failures"].append({"path": path, "error": str(exc)})
OUT.mkdir(exist_ok=True)
(OUT / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
if not report["routes"] or report["failures"]:
    raise SystemExit(f"Isolated build blocked: {len(report['failures'])} failures")
print(f"Isolated build passed: {len(report['routes'])} public HTML routes; not deployable")
