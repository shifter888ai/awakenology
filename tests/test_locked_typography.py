from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKER = (ROOT / "worker.js").read_text(encoding="utf-8")


def test_shared_language_typography_defaults_are_locked():
    rules = (
        'html:lang(en) body{font-family:Arial,sans-serif}',
        'html:lang(zh) body{font-family:"Microsoft YaHei",sans-serif}',
        'html:lang(ja) body{font-family:"MS PGothic",sans-serif}',
        'html:lang(en) .article{font-family:Arial,sans-serif}',
        'html:lang(zh) .article{font-family:"Microsoft YaHei",sans-serif}',
        'html:lang(ja) .article{font-family:"MS PGothic",sans-serif}',
    )
    for rule in rules:
        assert rule in WORKER, f"Missing locked typography rule: {rule}"


def test_previous_language_fallback_stacks_do_not_return():
    obsolete = (
        '"PingFang TC"',
        '"Noto Sans TC"',
        '"Yu Gothic"',
        '"Hiragino Kaku Gothic ProN"',
        '"Noto Sans JP"',
    )
    for family in obsolete:
        assert family not in WORKER, f"Unexpected fallback font restored: {family}"
