"""Shared source-path exclusions for isolated static HTML artifacts.

Keep the diagnostic builder and inventory verifier on one fail-closed policy.
"""
EXCLUDED_HTML_PREFIXES = (
    "editor/",
    "github-editor/",
    "scripts/",
    "tests/",
    "docs/",
    ".github/",
    "new-article/",
    "ai-search/",
)


def is_excluded_html_path(path):
    """Return whether a tracked HTML path is private, draft, or tooling."""
    normalized = path.replace("\\", "/").casefold()
    return normalized.startswith(EXCLUDED_HTML_PREFIXES)
