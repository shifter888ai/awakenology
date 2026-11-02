"""Verify isolated artifact inventory and hashes; no production requests."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "static-html-isolated-output"
EXCLUDED = ("editor/", "github-editor/", "scripts/", "tests/", "docs/", ".github/")
SCOPE = "source-only isolated build; no live Worker or browser equivalence"

def digest(data):
    return hashlib.sha256(data).hexdigest()

def verify():
    paths = subprocess.check_output(
        ["git", "ls-files", "-z", "--", "*.html"], cwd=ROOT
    ).decode("utf-8").split("\0")
    expected = sorted(p for p in paths if p and not p.startswith(EXCLUDED) and p != "404.html")
    # The diagnostic must be self-contained: never accept linked files or directories.
    if OUT.is_symlink() or any(p.is_symlink() for p in OUT.rglob("*")):
        raise AssertionError("Symlink in isolated artifact")
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("scope") != SCOPE:
        raise AssertionError("Build manifest scope mismatch")
    if not isinstance(manifest.get("failures"), list):
        raise AssertionError("Build manifest missing failures list")
    if manifest["failures"]:
        raise AssertionError("Build manifest reports failures")
    rows = manifest["routes"]
    actual = [row["path"] for row in rows]
    if actual != expected or len(actual) != len(set(actual)):
        raise AssertionError("Public route inventory mismatch")
    for row in rows:
        path = row["path"]
        route = "/" if path == "index.html" else "/" + path[:-len("index.html")]
        if row["route"] != route:
            raise AssertionError(f"Route mismatch: {path}")
        if digest((ROOT / path).read_bytes()) != row["source_sha256"]:
            raise AssertionError(f"Source hash mismatch: {path}")
        if digest((OUT / path).read_bytes()) != row["built_sha256"]:
            raise AssertionError(f"Output hash mismatch: {path}")
    emitted = sorted(str(p.relative_to(OUT)) for p in OUT.rglob("*.html"))
    if emitted != expected:
        raise AssertionError("Generated HTML inventory mismatch")
    print(f"PASS: {len(expected)} public routes and artifact hashes; no deployment")

if __name__ == "__main__":
    verify()
