"""Run the isolated PoC against pinned checked-out, real source pages."""
from pathlib import Path
from html_transformer import transform
from page_rules import rules_for
from parity_validator import validate, validate_metadata

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = {
    "/": ("index.html", "7f980bc8a382e0c00bd8c550b95210a56f3dd826"),
    "/English/": ("English/index.html", "59973d7dcc1dff7b979ad424bd6e4aa2191de90b"),
    "/Japanese/": ("Japanese/index.html", "5f9e17385932ef160fd395e92e5e6e868a25e2f7"),
    "/本源全視点vs個我単一視点/": ("本源全視点vs個我単一視点/index.html", "6c2c161716987d1662764d97422de6aaf19257f8"),
    "/Chinese/": ("Chinese/index.html", "aaa841648fed2f1828aa2d15c76599fd16a84eb3"),
    "/search/": ("search/index.html", "46f2c58649a305df6c660d65d8014c59347f3980"),
    "/ask/": ("ask/index.html", "e78865a2896455f602550def70af35353b4374bf"),
    "/Contact/": ("Contact/index.html", "dfa05c03447c2d6b89af21b37e46bd3280bc8195"),
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
