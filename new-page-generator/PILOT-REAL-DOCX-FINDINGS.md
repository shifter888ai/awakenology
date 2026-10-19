# Original trilingual DOCX pilot — observed CI blockers

Source: `temp/多重時空是什麽 - 繁體 - Copy.docx`
Size: 501967 bytes
SHA-256: `b9b8e15366fbbdb2e4d921335315c26ce56c6eb83678f8a1306b7c5cc8116ea1`
Evidence: [CI job summary](https://github.com/shifter888ai/awakenology/actions/runs/39197545423).

## Observed results
- sourceMap: BLOCKED — unsupported or ambiguous text construct.
- assets: BLOCKED — floating `wp:anchor` drawings; drawing not recognized as inline; image reference outside recognized inline drawing.
- imagePlacement: BLOCKED — same image errors plus source-map blocker.
- richContent: BLOCKED — source-map blocker.
- conversion: BLOCKED — explicit Word text color and floating drawings/image adapter.
- `pilotApproved`: false. CI execution success is **not** a fidelity pass.

## Required next engineering work
1. Diagnose source-map unsupported constructs with **tag names and counts**, without silently discarding text.
2. Resolve floating drawing anchors and their actual placement and ordering, or retain a manual-review gate. Do not convert anchors to inline images by assumption.
3. Map explicit OOXML text colors losslessly; preserve red/blue, including inherited styles when present.
4. Rerun source/rich/image/conversion diagnostics on the unchanged uploaded file.
5. Only after every applicable integrity check passes, review EN/JP/Traditional Chinese boundaries, source images, and language-specific endings. Never synthesize missing endings.

No page generation, PR, merge, or deployment is authorized by this audit.

## Verified detailed OOXML diagnostic (CI run 39198114594)
- One `<w:br w:type="textWrapping"/>` in zero-based paragraph 124 (paragraph 125), after `------`; no text after the break in that paragraph. Preserve it as a break, not silently drop or concatenate it. Source-map currently fails closed on all `w:br`.
- Three drawings: two `wp:inline`, one `wp:anchor`. The anchor is in zero-based paragraph 21 (paragraph 22), relationship `rId4`, `wp:docPr id="28" name="Picture 1"`, with wrapping. Horizontal positioning: relative to column, offset 0; vertical: relative to paragraph, offset 0. `distL` and `distR` are each 114300 EMU; `behindDoc=0`, `allowOverlap=1`. Preserve this metadata and require visual placement review rather than coercing it into inline flow.
- Explicit color `333333` occurs 192 times. It is not evidence that red/blue elsewhere may be discarded; preserve all color semantics and validate rendered output against source.
- These are observations from the unchanged source; diagnostic CI success does not mean the extraction or conversion passed. [Detailed run](https://github.com/shifter888ai/awakenology/actions/runs/39198114594).

### Next implementation acceptance criteria
1. Add a tested source-map representation of text-wrapping breaks with source offsets and order, while continuing to reject unsupported tabs, carriage returns, and non-text-wrapping break types.
2. Add an explicit anchor inventory and placement-review status for `rId4`, with no automatic inline fallback; keep the generation gate closed until reviewed.
3. Validate color handling and exact text/image order in each of the three languages, rerunning the real pilot in CI after each change.
