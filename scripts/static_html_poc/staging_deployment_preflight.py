#!/usr/bin/env python3
"""Read-only preflight for a future isolated staging deployment. No Wrangler invocation."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
PROD = ROOT / "wrangler.jsonc"
STAGING = ROOT / "scripts/static_html_poc/staging-plan.json"
def validate(prod, plan):
    errors=[]
    if prod.get("name") != "awakenology": errors.append("unexpected production Worker name")
    if prod.get("main") != "./worker.js": errors.append("production Worker entry changed")
    if plan.get("worker_name") in ("", None, prod.get("name")): errors.append("staging name absent or equals production")
    if not plan.get("worker_name", "").startswith("awakenology-static-stage-"): errors.append("staging name lacks isolated prefix")
    if plan.get("deploy_enabled") is not False: errors.append("deployment must remain disabled")
    if plan.get("routes") != [] or plan.get("custom_domains") != []: errors.append("staging must have no routes or custom domains")
    if plan.get("copy_production_secrets") is not False: errors.append("production secrets must not be copied")
    if plan.get("private_editor_enabled") is not False: errors.append("private Editor must not be enabled on staging")
    if plan.get("indexing_allowed") is not False: errors.append("staging must not be indexable")
    if plan.get("required_approval") != "separate explicit staging deployment approval": errors.append("explicit approval gate missing")
    return errors
def main():
    prod=json.loads(PROD.read_text(encoding="utf-8"))
    plan=json.loads(STAGING.read_text(encoding="utf-8"))
    errors=validate(prod,plan)
    report={"status":"BLOCKED" if errors else "PREFLIGHT_PASS_NOT_DEPLOYED","errors":errors,"plan":plan}
    (ROOT/"static-html-staging-deployment-preflight.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":report["status"],"errors":errors},indent=2))
    if errors: raise SystemExit(1)
if __name__=="__main__": main()
