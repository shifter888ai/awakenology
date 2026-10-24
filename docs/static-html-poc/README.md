# Static HTML build-parity PoC (non-deployed)

This draft branch is isolated from production. It explores moving deterministic HTMLRewriter output to build time. It is **not Worker-equivalent and must not be merged or deployed** as a routing change.

## Verified preliminary checks (five fixtures)

The fixtures are the homepage, English, Japanese, Chinese, and AI Search. The isolated unit tests and real-page source-content/markup/image/idempotence checks passed. The live comparison reported matching *signatures* for those five pages; it does not compare complete HTML bytes, browser behavior, or visual output. The existing Content Integrity Gate, Sitemap route parity, SEO metadata inventory, and Live SEO runtime audit also passed at commit `dc85dd1`.

## Remaining release blockers

1. Expand route coverage beyond five fixtures, including representative article pages, nested and Unicode routes, and excluded/private paths. Compare against the current Worker behavior rather than extrapolating from the five examples.
2. Make live Worker parity a **required** CI gate for any release candidate. The current workflow marks the diagnostic step `continue-on-error: true`; a green workflow alone therefore does not prove live parity.
3. Compare complete rendered DOM/head/body semantics and run browser-level tests for theme, return-to-top, Chinese conversion, language/navigation links, image URLs, accessibility and responsive layouts. A signature match alone is insufficient.
4. Validate article subtree preservation, including inline colors, bold text, images, ordering and original content, across a broader sample. The current BeautifulSoup serialization fingerprint is not a literal source-byte comparison.
5. Separately verify that the Private Editor, Word Generator and HTML Generator remain authenticated/private where applicable and excluded from SEO indexing and public crawls. Confirm AI Search retains its intended noindex/no-canonical behavior.
6. Demonstrate build reproducibility, idempotence, fail-closed behavior, rollback and a measurable performance benefit before proposing any production routing change.
7. Re-run all checks against the then-current `main` after unrelated content merges; the branch's existing fixture snapshot is not proof of parity with future production changes.

## Current PoC gates

- Unit tests: `python -m unittest discover -s scripts/static_html_poc -p 'test_*.py' -v`
- Source fixtures: `python scripts/static_html_poc/check_real_pages.py`
- Live five-page signature diagnostic: `python scripts/static_html_poc/check_live_parity.py`
- Existing repository integrity and SEO workflows.

No Worker routing or deployment change is authorized by this PoC.
