"""Route rules for a non-deployed build parity experiment."""
from dataclasses import dataclass
from urllib.parse import quote

SITE = "https://awakenology.space"
LANGUAGE_INDEX = {"/English/": "en", "/Japanese/": "ja", "/Chinese/": "zh-Hant"}
NOINDEX = {"/ai-search/"}

@dataclass(frozen=True)
class PageRules:
    route: str
    canonical: str | None
    language: str | None
    noindex: bool
    is_language_index: bool

def rules_for(route: str) -> PageRules:
    if not route.startswith("/") or "?" in route or "#" in route or "//" in route:
        raise ValueError("Expected normalized route")
    normalized = route if route == "/" or route.endswith(("/", ".html")) else route + "/"
    canonical = None if route in NOINDEX else SITE + quote(normalized, safe="/%")
    return PageRules(route, canonical, LANGUAGE_INDEX.get(route), route in NOINDEX, route in LANGUAGE_INDEX)
