"""Run the isolated PoC against pinned checked-out, real source pages."""
from pathlib import Path
from html_transformer import transform
from page_rules import rules_for
from parity_validator import validate, validate_metadata

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = {
    "/": ("index.html", "2308340cc91e8119fa276a9ff033e7ee9eb64d52"),
    "/English/": ("English/index.html", "a635db1748fcd83e580c33c30595fca9a1fbdbf6"),
    "/Japanese/": ("Japanese/index.html", "9e15acf25bc0cc1ada36cc07ae3ec07c752be906"),
    "/Chinese/": ("Chinese/index.html", "98edbd8e2580988d2faf8bf32e9ba33f00b2eccf"),
    "/search/": ("search/index.html", "be3eb018cb7e98ccaf30b26ce000d503ad00fdd7"),
    "/ask/": ("ask/index.html", "8e27a33704a0d59c553f378c8aec5b22d50b1273"),
    "/大揭露2/": ("大揭露2/index.html", "508ecaa0fdda1252d20b9f788e52b494b7b1c9a8"),
    "/與退化派對話8/": ("與退化派對話8/index.html", "bc62b6b2266c4b826a12168237294062352a4d53"),
    "/What-Is-Hypnosis/": ("What-Is-Hypnosis/index.html", "dfd2e93bdfc9ce51d05e59423f071cc98a3d8220"),
    "/アインシュタイン協議百年催眠実験/": ("アインシュタイン協議百年催眠実験/index.html", "29cfb52a5143ceb42f966b9c525d5340de9b8095"),
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
