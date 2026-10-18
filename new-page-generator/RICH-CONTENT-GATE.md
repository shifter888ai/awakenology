# Rich-content review gate

The offline review coordinator accepts optional paired `sourceRichInventory` and `renderedRichInventory` for each language output. If either is supplied, both are required and `compareRichContent` must pass. This does **not** imply that inventories are extracted independently or trustworthy merely because a caller supplies them. Never treat caller-authored identical inventories as evidence of source fidelity.

Before this can become a mandatory approval gate, derive source runs and images from original DOCX OOXML with source locations, and derive rendered runs and images from the actual parsed output HTML. Do not copy one inventory to the other. Preserve exact text, bold, italic, underline, color, href, image asset path, paragraph placement, order and alt text. Unsupported or ambiguous constructs block review.

The existing rendered text/content inventory gate remains active. This branch is non-publishing. The actual trilingual pilot cannot be certified while original DOCX bytes are unavailable.
