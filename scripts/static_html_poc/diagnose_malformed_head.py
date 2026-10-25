"""Diagnose known malformed source head tags without modifying source articles.

These two source documents have an unterminated hreflang=en link immediately
followed by another <link, then a doubled closing >. Record this explicitly:
the full-inventory integrity gate must continue to fail closed until a
separately reviewed source-metadata repair or proven parser-safe fix lands.
"""
from pathlib import Path
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
        assert head[en:next_link].endswith('"'), path
        assert head[next_link:].find('">>') != -1, path
        print(f"CONFIRMED {path}: malformed hreflang metadata in head; article source left untouched")
    print("Two metadata defects documented; full-route integrity failures remain release blockers.")


if __name__ == "__main__":
    main()
