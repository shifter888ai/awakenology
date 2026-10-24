# Static HTML build-parity PoC (non-deployed)

This branch is isolated from the performance routing branch and production. Its purpose is to validate moving deterministic HTMLRewriter output to build time.

## Gates
1. Snapshot source HTML and current Worker-rendered HTML for each fixture.
2. Match title, description, canonical, OG, robots, favicon, footer, theme scripts, language classes and Chinese toggle.
3. Preserve the article subtree byte-for-byte, including images, inline styling and ordering.
4. Run the transformation twice and require identical output.
5. Confirm Editor/Generator authentication and noindex behavior separately.
6. Run existing content-integrity and live SEO audits before any routing change.

No Worker routing or deployment change is authorized by this PoC.