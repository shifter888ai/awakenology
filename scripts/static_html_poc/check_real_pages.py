"""Run the isolated PoC against pinned checked-out, real source pages."""
from pathlib import Path
from html_transformer import transform
from page_rules import rules_for
from parity_validator import validate, validate_metadata

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = {
    # Refreshed 2026-11-27 after the Chinese TOC entry was added on main.
    # The Chinese page's body content is unchanged; only its TOC gained one link.
    "/": ("index.html", "7f980bc8a382e0c00bd8c550b95210a56f3dd826"),
    "/English/": ("English/index.html", "ccb9d50351bc35b6b2d52943de3b4b909dc1b8e9"),
    "/Japanese/": ("Japanese/index.html", "6efb4d987ae9bab589155fbc7320fa1c7750469c"),
    "/Chinese/": ("Chinese/index.html", "ca13484aae78a8dc2dd3ccf833ea39ec414f121c"),
    "/search/": ("search/index.html", "46f2c58649a305df6c660d65d8014c59347f3980"),
    "/ask/": ("ask/index.html", "e78865a2896455f602550def70af35353b4374bf"),
    "/大揭露2/": ("大揭露2/index.html", "508ecaa0fdda1252d20b9f788e52b494b7b1c9a8"),
    "/與退化派對話8/": ("與退化派對話8/index.html", "bc62b6b2266c4b826a12168237294062352a4d53"),
    "/What-Is-Hypnosis/": ("What-Is-Hypnosis/index.html", "dfd2e93bdfc9ce51d05e59423f071cc98a3d8220"),
    "/アインシュタイン協議百年催眠実験/": ("アインシュタイン協議百年催眠実験/index.html", "29cfb52a5143ceb42f966b9c525d5340de9b8095"),
}


def main():
    import hashlib
    import difflib

    for route, (path, baseline_git_blob_sha) in FIXTURES.items():
        # Hash raw repository bytes: read_text() normalizes legacy CRLF.
        blob = (ROOT / path).read_bytes()
        source = blob.decode("utf-8")
        # Git's SHA-1 blob format, so changed fixtures fail closed.
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
            diff = difflib.unified_diff(
                result.splitlines(), second.splitlines(),
                fromfile=f"{path}:first-pass", tofile=f"{path}:second-pass",
                lineterm="", n=2,
            )
            print("\n".join(list(diff)[:100]))
            raise AssertionError(f"Non-idempotent: {path}")
        rules = rules_for(route)
        validate_metadata(result, canonical=rules.canonical, noindex=rules.noindex)
        print(f"PASS {path}: content, images, markup, metadata, reproducibility, idempotence")
    print(f"{len(FIXTURES)}/{len(FIXTURES)} real-page source fixtures passed; live Worker parity is checked separately.")


if __name__ == "__main__":
    main()
