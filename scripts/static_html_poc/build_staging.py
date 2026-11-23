
"""Build supported public HTML into temporary staging; known blockers are not transformed."""
import hashlib
import json
import posixpath
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlparse

from bs4 import BeautifulSoup
from check_full_inventory import public_sources, ROOT, validate_public_html_manifest
from html_transformer import transform
from page_rules import rules_for
from parity_validator import validate, validate_metadata

REPORT = ROOT / "static-html-staging-report.json"
PRIVATE_PREFIXES = (
    "api/", "editor/", "github-editor/", "scripts/", "tests/", "docs/",
    ".github/", "internal/", "new-article/",
)
ASSET_ATTRS = {
    "img": "src",
    "script": "src",
    "source": "src",
    "video": "src",
    "audio": "src",
    "iframe": "src",
}
CSS_URL = re.compile(
    r"""url\(\s*(?:(['"])(.*?)\1|([^)]*?))\s*\)""",
    re.IGNORECASE,
)
CSS_IMPORT = re.compile(
    r"""@import\s+(?:url\(\s*)?(?:(['"])(.*?)\1|([^) \t\r\n;]+))\s*\)?""",
    re.IGNORECASE,
)


def tracked_files():
    raw = subprocess.check_output(
        ["git", "ls-files", "-z"], cwd=ROOT
    ).decode("utf-8")
    return {path for path in raw.split("\0") if path}


def srcset_urls(value):
    """Yield candidate URLs without splitting commas inside data URLs."""
    index = 0
    length = len(value)
    while index < length:
        while index < length and (value[index].isspace() or value[index] == ","):
            index += 1
        if index >= length:
            break

        start = index
        while index < length and not value[index].isspace():
            index += 1

        token = value[start:index]
        trailing_commas = len(token) - len(token.rstrip(","))
        candidate = token.rstrip(",")
        if candidate:
            yield candidate

        # A trailing comma already terminated this candidate; otherwise skip
        # its optional width/density descriptors up to the next delimiter.
        if trailing_commas:
            continue
        while index < length and value[index] != ",":
            index += 1
        if index < length:
            index += 1


def css_references(css):
    """Return local-reference candidates from CSS url() and @import syntax."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)
    imports = []
    for match in CSS_IMPORT.finditer(css):
        value = (match.group(2) if match.group(1) else match.group(3) or "").strip()
        if value:
            imports.append(value)

    import_values = set(imports)
    refs = [(value, "css-import") for value in imports]
    for match in CSS_URL.finditer(css):
        value = (match.group(2) if match.group(1) else match.group(3) or "").strip()
        if value and value not in import_values:
            refs.append((value, "css-url"))
    return refs


def resolve_reference(value, route, tracked):
    """Resolve one URL against an HTML route or CSS directory."""
    value = value.strip()
    parsed = urlparse(value)
    if parsed.scheme or parsed.netloc or value.startswith(
        ("data:", "blob:", "#")
    ):
        return "skip", None, set(), set()

    path = unquote(parsed.path).replace("\\", "/")
    if not path:
        return "skip", None, set(), set()

    directory_reference = path.endswith("/")
    raw_candidate = (
        path.lstrip("/")
        if path.startswith("/")
        else posixpath.join(route.lstrip("/"), path)
    )
    candidate = posixpath.normpath(raw_candidate)
    if candidate == ".." or candidate.startswith("../"):
        return "escape", candidate, set(), set()

    options = {candidate}
    if directory_reference:
        options.add(posixpath.join(candidate, "index.html"))
    elif not posixpath.splitext(candidate)[1]:
        options.update(
            {
                posixpath.join(candidate, "index.html"),
                candidate + ".html",
            }
        )
    matches = options.intersection(tracked)
    return "ok", candidate, options, matches


def check_reference(tag, attribute, value, tracked, route):
    status, candidate, options, matches = resolve_reference(value, route, tracked)
    if status == "skip" or matches:
        return []
    if status == "escape":
        return [{
            "route": route,
            "tag": tag,
            "attribute": attribute,
            "value": value,
            "error": "path escapes site root",
        }]
    return [{
        "route": route,
        "tag": tag,
        "attribute": attribute,
        "value": value,
        "checked": sorted(options),
    }]


def local_asset_references(html, tracked, route):
    """Check HTML assets, srcset candidates, and inline CSS references."""
    soup = BeautifulSoup(html, "html.parser")
    refs = []
    inline_css = []

    for tag in soup.find_all(True):
        attribute = ASSET_ATTRS.get(tag.name)
        if attribute and tag.get(attribute):
            refs.append((tag.name, attribute, tag.get(attribute)))

        if tag.get("srcset"):
            refs.extend(
                (tag.name, "srcset", value)
                for value in srcset_urls(tag["srcset"])
            )

        if tag.name == "link" and tag.get("href"):
            rel = {str(item).lower() for item in (tag.get("rel") or [])}
            if rel.intersection(
                {"stylesheet", "icon", "apple-touch-icon", "preload", "manifest"}
            ):
                refs.append((tag.name, "href", tag["href"]))

        if tag.get("style"):
            inline_css.append(tag["style"])
        if tag.name == "style":
            inline_css.append(tag.get_text())

    for css in inline_css:
        refs.extend(
            ("style", kind, value)
            for value, kind in css_references(css)
        )

    failures = []
    for tag, attribute, value in refs:
        failures.extend(
            check_reference(tag, attribute, value, tracked, route)
        )
    return failures


def stylesheet_paths(html, tracked, route):
    """Find tracked local stylesheets linked by a staged HTML document."""
    soup = BeautifulSoup(html, "html.parser")
    found = set()
    for link in soup.find_all("link", href=True):
        rel = {str(item).lower() for item in (link.get("rel") or [])}
        is_stylesheet = "stylesheet" in rel or (
            "preload" in rel and str(link.get("as", "")).lower() == "style"
        )
        if not is_stylesheet:
            continue

        status, _, _, matches = resolve_reference(link["href"], route, tracked)
        if status != "ok":
            continue
        found.update(
            path for path in matches if path.lower().endswith(".css")
        )
    return sorted(found)


def local_css_references(css, tracked, source_path):
    """Check url() and @import references relative to a stylesheet's directory."""
    directory = posixpath.dirname(source_path)
    route = "/" + directory.strip("/") + "/" if directory else "/"
    failures = []
    for value, kind in css_references(css):
        failures.extend(
            check_reference("css", kind, value, tracked, route)
        )
    return failures


def css_import_paths(css, tracked, source_path):
    """Return tracked CSS files imported by this stylesheet for recursive checks."""
    directory = posixpath.dirname(source_path)
    route = "/" + directory.strip("/") + "/" if directory else "/"
    found = set()
    for value, kind in css_references(css):
        if kind != "css-import":
            continue
        status, _, _, matches = resolve_reference(value, route, tracked)
        if status == "ok":
            found.update(
                path for path in matches if path.lower().endswith(".css")
            )
    return sorted(found)


def main():
    paths, excluded = public_sources()
    tracked = tracked_files()
    built_routes = []
    asset_failures = []
    scanned_stylesheets = set()

    with tempfile.TemporaryDirectory(
        prefix="awakenology-static-staging-"
    ) as temp:
        output = Path(temp)
        for source_path in paths:
            route = (
                "/"
                if source_path == "index.html"
                else "/" + source_path[:-len("index.html")]
            )
            source = (ROOT / source_path).read_text(encoding="utf-8")
            built = transform(source, route)
            validate(source, built)
            rules = rules_for(route)
            validate_metadata(
                built, canonical=rules.canonical, noindex=rules.noindex
            )

            target = output / source_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(built, encoding="utf-8", newline="")
            if target.read_text(encoding="utf-8") != built:
                raise AssertionError(
                    f"staged file differs after write/read: {source_path}"
                )
            if transform(source, route) != built or transform(built, route) != built:
                raise AssertionError(
                    f"build is non-deterministic or non-idempotent: {source_path}"
                )

            asset_failures.extend(
                local_asset_references(built, tracked, route)
            )
            pending_css = stylesheet_paths(built, tracked, route)
            while pending_css:
                css_path = pending_css.pop()
                if css_path in scanned_stylesheets:
                    continue
                scanned_stylesheets.add(css_path)
                try:
                    css = (ROOT / css_path).read_text(encoding="utf-8")
                except OSError as exc:
                    asset_failures.append({
                        "route": route,
                        "tag": "css",
                        "attribute": "read",
                        "value": css_path,
                        "error": f"stylesheet read failed: {exc}",
                    })
                    continue
                asset_failures.extend(
                    local_css_references(css, tracked, css_path)
                )
                pending_css.extend(
                    css_import_paths(css, tracked, css_path)
                )

            built_routes.append({
                "route": route,
                "source": source_path,
                "output": source_path,
                "bytes": len(built.encode("utf-8")),
                "sha256": hashlib.sha256(
                    built.encode("utf-8")
                ).hexdigest(),
            })

        staged_html = sorted(
            path.relative_to(output).as_posix()
            for path in output.rglob("*.html")
        )
        staged_routes = [
            "/" if path == "index.html"
            else "/" + path[:-len("index.html")]
            for path in staged_html
        ]
        validate_public_html_manifest(staged_routes)
        if staged_html != sorted(paths):
            raise AssertionError(
                "staging output route set differs from supported public source route set"
            )

        forbidden = [
            path for path in staged_html
            if path.casefold().startswith(PRIVATE_PREFIXES)
            or path.casefold() == "404.html"
        ]
        if forbidden:
            raise AssertionError(
                f"private or excluded HTML entered staging output: {forbidden}"
            )
        if any(
            path.casefold().startswith(("editor/", "github-editor/"))
            for path in staged_html
        ):
            raise AssertionError(
                "Editor/Generator HTML leaked into public staging output"
            )

        report = {
            "scope": (
                "temporary staging build of supported public index routes only; "
                "unclassified public HTML fails closed; no deployment, routing, "
                "headers or runtime behavior changed"
            ),
            "public_source_routes": len(paths),
            "transformed_source_routes": len(paths),
            "staged_html_routes": len(staged_html),
            "excluded_html": excluded,
            "temporary_output_cleaned": True,
            "non_html_assets_copied": False,
            "worker_only_route_prefixes_excluded": ["/api/"],
            "supported_route_build_complete": (
                not asset_failures and len(staged_html) == len(paths)
            ),
            "asset_check": (
                "HTML src/srcset, linked stylesheets, inline CSS url()/@import, "
                "and recursively imported CSS references checked against tracked "
                "repository files; remote/data URLs excluded"
            ),
            "scanned_stylesheets": len(scanned_stylesheets),
            "local_asset_failures": asset_failures,
            "routes": built_routes,
        }

    REPORT.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if asset_failures:
        raise SystemExit(
            f"{len(asset_failures)} local asset references failed; "
            "report written; no deployment authorized"
        )
    print(
        f"PASS: {len(staged_html)}/{len(paths)} supported public index routes staged; "
        f"{len(scanned_stylesheets)} linked CSS files checked."
    )


if __name__ == "__main__":
    main()
