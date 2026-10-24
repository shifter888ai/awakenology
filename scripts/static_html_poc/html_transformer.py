"""Conservative metadata-only prototype; NOT Worker-equivalent.

This module is deliberately not wired into deployment. BeautifulSoup serialization
can change legacy article markup; the full transformer must preserve article subtrees
and pass the parity gates before it can be enabled.
"""
from bs4 import BeautifulSoup
from page_rules import rules_for

def transform(source: str, route: str) -> str:
    rules = rules_for(route)
    soup = BeautifulSoup(source, "html.parser")
    if not soup.html or not soup.head or not soup.body:
        raise ValueError("Incomplete HTML document")
    if rules.language:
        soup.html["lang"] = rules.language
    canonical = soup.head.select('link[rel="canonical"]')
    if rules.canonical:
        if canonical:
            canonical[0]["href"] = rules.canonical
            for duplicate in canonical[1:]:
                duplicate.decompose()
        else:
            soup.head.append(soup.new_tag("link", rel="canonical", href=rules.canonical))
    else:
        for link in canonical:
            link.decompose()
    if rules.noindex:
        robots = soup.head.select('meta[name="robots"]')
        if robots:
            robots[0]["content"] = "noindex,follow"
            for duplicate in robots[1:]:
                duplicate.decompose()
        else:
            soup.head.append(soup.new_tag("meta", attrs={"name": "robots", "content": "noindex,follow"}))
    return str(soup)
