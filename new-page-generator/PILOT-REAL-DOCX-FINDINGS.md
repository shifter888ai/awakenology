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
