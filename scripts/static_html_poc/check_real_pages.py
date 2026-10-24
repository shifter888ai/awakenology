"""Run the isolated PoC against five checked-out, real source pages."""
from pathlib import Path
from html_transformer import transform
from page_rules import rules_for
from parity_validator import validate, validate_metadata

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = {
    "/": ("index.html", "2308340cc91e8119fa276a9ff033e7ee9eb64d52"),
    "/English/": ("English/index.html", "4a94b52348f3783999d48e9e1e4fa95a11a1bb64"),
    "/Japanese/": ("Japanese/index.html", "b3cac68d40b7cefd89070b4eb3d726f4a4529b8a"),
    "/Chinese/": ("Chinese/index.html", "de774f1818b324e1a315bec415353c55ca4201a7"),
    "/ai-search/": ("ai-search/index.html", "9bb335d6ef466e1e21e1547694377bbddb92e764"),
}

def main():
    for route, (path, baseline_git_blob_sha) in FIXTURES.items():
        source = (ROOT / path).read_text(encoding="utf-8")
        # Git's SHA-1 blob format, so changed fixtures fail closed.
        import hashlib
        blob = source.encode("utf-8")
        actual = hashlib.sha1(b"blob " + str(len(blob)).encode() + bytes([0]) + blob).hexdigest()
        if actual != baseline_git_blob_sha:
            raise AssertionError(f"Fixture changed: {path}: {actual}")
        result = transform(source, route)
        validate(source, result)
        if result != transform(result, route):
            raise AssertionError(f"Non-idempotent: {path}")
        rules = rules_for(route)
        validate_metadata(result, canonical=rules.canonical, noindex=rules.noindex)
        print(f"PASS {path}: content, images, markup, metadata, idempotence")
    print("5/5 real-page preliminary fixtures passed; Worker-rendered parity NOT tested.")

if __name__ == "__main__":
    main()
