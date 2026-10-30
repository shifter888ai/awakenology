# Phase 7: reproducible offline package audit

This step emits a JSON digest manifest for every tracked public HTML route, source SHA-256, generated SHA-256 and byte size, with local asset reference checks and explicit private-route exclusions. It never overwrites public HTML, emits no deployable HTML bundle, and does not deploy a staging Worker. Compare manifests from the same commit to verify repeatability; a different commit requires source/content review. The report is a preparation artifact, not proof of HTTP/runtime equivalence or rollback.

Next blocker: create a separately approved isolated staging Worker and collect real staging HTTP/browser evidence, followed by a staging rollback rehearsal. Production traffic, Editor and Generator remain unchanged.
