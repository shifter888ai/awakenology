# Runtime-default integration gate

The existing Worker validates the optional public HTML mode just before its existing public asset fetch. Missing, empty and explicit runtime values preserve the existing HTMLRewriter path. Static and unknown modes are rejected, not enabled. There is no static-serving branch, allowlist or cutover in this batch. Editor and Generator routing remain before the gate. Production configuration, DNS and deployment workflow are unchanged.

Rollback: revert this gate commit. Future static serving requires separate tests for allowlisted public routes, content hashes, headers, live parity and operational rollback, plus explicit activation approval.
