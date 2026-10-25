"""Run the isolated PoC against pinned checked-out, real source pages."""
from pathlib import Path
from html_transformer import transform
from page_rules import rules_for
from parity_validator import validate, validate_metadata

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = {
    "/": ("index.html", "2308340cc91e8119fa276a9ff033e7ee9eb64d52"),
    "/English/": ("English/index.html", "4a94b52348f3783999d48e9e1e4fa95a11a1bb64"),
    "/Japanese/": ("Japanese/index.html", "b3cac68d40b7cefd89070b4eb3d726f4a4529b8a"),
    "/Chinese/": ("Chinese/index.html", "daf2be37bc85af3d77064c262a1c4045559ea3a7"),
    "/ai-search/": ("ai-search/index.html", "9bb335d6ef466e1e21e1547694377bbddb92e764"),
    "/大揭露2/": ("大揭露2/index.html", "d9bc3b04e240264c62caba1f2864307eab4aa21a"),
    "/與退化派對話8/": ("與退化派對話8/index.html", "bc62b6b2266c4b826a12168237294062352a4d53"),
    "/What-Is-Hypnosis/": ("What-Is-Hypnosis/index.html", "8639f0376b704e8f3e6aed1328fd4df4bfe1abef"),
    "/アインシュタイン協議百年催眠実験/": ("アインシュタイン協議百年催眠実験/index.html", "ae7755914dde8b02b66c1dd6970059a6a3991d03"),
}

def main():
    for route, (path, baseline_git_blob_sha) in FIXTURES.items():
        # Hash raw repository bytes: read_text() normalizes legacy CRLF.
        blob = (ROOT / path).read_bytes()
        source = blob.decode("utf-8")
        # Git's SHA-1 blob format, so changed fixtures fail closed.
        import hashlib
        # Keep original bytes for Git blob fingerprint.
        actual = hashlib.sha1(b"blob " + str(len(blob)).encode() + bytes([0]) + blob).hexdigest()
        if actual != baseline_git_blob_sha:
            raise AssertionError(f"Fixture changed: {path}: {actual}")
        result = transform(source, route)
        validate(source, result)
        independent = transform(source, route)
        if result.encode("utf-8") != independent.encode("utf-8"):
            raise AssertionError(f"Non-reproducible build output: {path}")
        second = transform(result, route)
        if result != second:
            import difflib
            diff = difflib.unified_diff(
                result.splitlines(), second.splitlines(),
                fromfile=f"{path}:first-pass", tofile=f"{path}:second-pass",
                lineterm="", n=2,
            )
            print("\\n".join(list(diff)[:100]))
            raise AssertionError(f"Non-idempotent: {path}")
        rules = rules_for(route)
        validate_metadata(result, canonical=rules.canonical, noindex=rules.noindex)
        print(f"PASS {path}: content, images, markup, metadata, reproducibility, idempotence")
    print(f"{len(FIXTURES)}/{len(FIXTURES)} real-page source fixtures passed; live Worker parity is checked separately.")

if __name__ == "__main__":
    main()
