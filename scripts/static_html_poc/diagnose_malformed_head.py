"""Regression guard for repaired SoC alternate-link metadata; article bodies untouched."""
from check_real_pages import ROOT

AFFECTED = (
    "SoC-AssessPoints-3-Spiritual-Connection-Area/index.html",
    "SoC-AssessPoints-4-Thought-Expansion-Area/index.html",
)


def main():
    for path in AFFECTED:
        raw = (ROOT / path).read_text(encoding="utf-8")
        head, sep, body = raw.partition("</head>")
        assert sep and "<article" in body and "<main" in body, path
        assert head.count('hreflang="en"') == 1, path
        assert head.count('hreflang="x-default"') == 1, path
        en = head.index('hreflang="en"')
        next_link = head.index("<link", en)
        assert head[en:next_link].endswith('">'), path
        assert '">><link rel="alternate" hreflang="ja"' not in head, path
        xdefault = head.index('hreflang="x-default"')
        ja_link = head.index("<link", xdefault)
        assert head[xdefault:ja_link].endswith('">'), path
        print(f"PASS {path}: alternate links are delimited correctly")
    print("Two metadata repairs verified; full-route content gate still required.")


if __name__ == "__main__":
    main()
