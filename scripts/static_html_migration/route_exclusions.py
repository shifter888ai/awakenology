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
    "internal/",
    "new-article/",
    "ai-search/",
    "search/",
    "ask/",
)

# This legacy PDF-to-HTML rendering is an alternate document representation,
# not a canonical index route. Preserve it as a public legacy file, but do not
# feed it to the static-route transformer.
EXCLUDED_HTML_PATHS = {
    "roswell/roswell.html",
}


def is_excluded_html_path(path):
    """Return whether a tracked HTML path is private, draft, tooling, or a non-route artifact."""
    normalized = path.replace("\\", "/").casefold()
    return normalized in EXCLUDED_HTML_PATHS or normalized.startswith(EXCLUDED_HTML_PREFIXES)
