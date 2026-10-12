#!/usr/bin/env python3
"""Consolidate Awakenology audit CSVs into one deduplicated, prioritized issue register.

The consolidator is intentionally read-only: it never edits pages or suppresses source
findings merely because the Worker may repair them at runtime.
"""
import argparse
import csv
import hashlib
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUTS = {
    "seo-source": "seo-metadata-report.csv",
    "seo-runtime": "seo-runtime-report.csv",
    "local-reference": "site-integrity-report.csv",
    "live-reference": "live-link-asset-report.csv",
    "anchor-accessibility": "anchor-accessibility-report.csv",
    "browser-smoke": "browser-smoke-report.csv",
    "browser-accessibility": "browser-accessibility-report.csv",
}
REGISTER = ROOT / "audit-issue-register.csv"
SUMMARY = ROOT / "audit-summary.md"

def read_rows(path):
    if not path.exists():
        return None
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))

def issue(source, severity, category, location, detail, status="finding", recommendation=""):
    identity = "|".join((source, category, location, detail))
    fingerprint = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:12]
    return {"fingerprint": fingerprint, "source_report": source, "severity": severity,
            "category": category, "location": location, "status": status,
            "detail": detail, "recommended_action": recommendation}

def build_issues(reports):
    issues = []
    for source, filename in INPUTS.items():
        rows = reports.get(filename)
        if rows is None:
            issues.append(issue(source, "warning", "missing-report", filename,
                                "Expected report was not generated.",
                                "report-missing", "Inspect the preceding audit step and restore report generation."))
            continue
        if source == "seo-source":
            for row in rows:
                flags = [f for f in row.get("flags", "").split(";") if f]
                for flag in flags:
                    sev = "warning"
                    if flag.startswith(("missing-title", "missing-description", "missing-canonical")):
                        sev = "high"
                    issues.append(issue(source, sev, "seo-source:" + flag, row.get("path", ""),
                        "Source HTML metadata inventory flagged " + flag + ".",
                        "source-only", "Compare source metadata with Worker-delivered metadata before editing HTML."))
        elif source == "seo-runtime":
            for row in rows:
                errors = [e for e in row.get("errors", "").split(";") if e]
                for error in errors:
                    sev = "high" if error.startswith(("http-status", "missing-title", "missing-description", "missing-lang", "missing-canonical")) else "warning"
                    issues.append(issue(source, sev, "seo-runtime:" + error, row.get("url", row.get("path", "")),
                        "Production metadata/runtime check reported " + error + ".",
                        "live-failure", "Verify the delivered page and Worker behavior before changing source files."))
        elif source == "local-reference":
            for row in rows:
                status = row.get("status", "")
                if status not in {"BROKEN", "READ_ERROR"}:
                    continue
                sev = "high" if status == "BROKEN" else "warning"
                issues.append(issue(source, sev, "local-reference:" + status,
                    row.get("source", "") + " -> " + row.get("reference", ""),
                    "Local reference check: " + status + "; target=" + row.get("target", ""),
                    "local-failure", "Confirm the intended route or asset, then repair the reference or restore the missing file."))
        elif source == "live-reference":
            for row in rows:
                result = row.get("result", "")
                if result not in {"HTTP_ERROR", "REQUEST_ERROR", "REDIRECT", "CONTENT_TYPE_MISMATCH"}:
                    continue
                status = row.get("http_status", "")
                if result == "REDIRECT":
                    sev = "warning"
                    detail = "Production URL redirects to " + (row.get("final_url", "") or "an unspecified final URL")
                    action = "Review whether the redirect is intentional; update internal references to the final canonical URL when safe."
                    issue_status = "redirect-review"
                elif result == "CONTENT_TYPE_MISMATCH":
                    sev = "high"
                    detail = "Expected asset returned " + (row.get("content_type", "") or "an unspecified content type") + " (HTTP " + (str(status) or "unknown") + ")"
                    action = "Inspect the final URL and delivered body; verify whether an HTML fallback is hiding a missing asset before changing source."
                    issue_status = "asset-content-review"
                else:
                    sev = "high" if str(status).startswith(("4", "5")) else "warning"
                    detail = "Production request returned " + (str(status) or "no HTTP status")
                    if row.get("error"):
                        detail += "; " + row.get("error", "")
                    action = "Check the URL, hosting response, and referring source files; retry transient network errors before editing."
                    issue_status = "live-failure"
                issues.append(issue(source, sev, "live-reference:" + result,
                    row.get("url", ""),
                    detail + "; referenced by " + row.get("referenced_by_count", "unknown") + " source file(s).",
                    issue_status, action))
        elif source == "browser-smoke":
            for row in rows:
                check = row.get("check", "unknown")
                status = row.get("status", "")
                if check == "console-error" and status == "info":
                    continue
                sev = "high" if check in {"page-http-status", "browser-navigation-error", "same-host-http-error"} else "warning"
                location = row.get("url", "") + (" [" + row.get("viewport", "") + "]" if row.get("viewport") else "")
                issues.append(issue(source, sev, "browser:" + check, location,
                    row.get("detail", check), "browser-finding",
                    "Reproduce in a browser and confirm the live DOM/network behavior before editing source."))
        elif source == "browser-accessibility":
            for row in rows:
                check = row.get("check", "unknown")
                sev = row.get("severity", "warning")
                if sev not in {"high", "warning", "info"}:
                    sev = "warning"
                location = row.get("url", "") + (" [" + row.get("viewport", "") + "]" if row.get("viewport") else "")
                issues.append(issue(source, sev, "rendered-accessibility:" + check, location,
                    row.get("detail", check), "accessibility-finding",
                    "Inspect the rendered page and keyboard behavior; preserve original article wording and image intent."))
        elif source == "anchor-accessibility":
            for row in rows:
                category = row.get("issue", "unknown")
                sev = row.get("severity", "warning")
                location = row.get("source", "") + (" -> " + row.get("reference", "") if row.get("reference") else "")
                issues.append(issue(source, sev, "anchor-accessibility:" + category, location,
                    row.get("detail", category), "needs-triage",
                    "Check the live DOM and intended behavior; fix verified defects without rewriting article content."))
    # Merge duplicate findings from the same source/category/location while retaining occurrence counts.
    merged = {}
    for row in issues:
        key = (row["source_report"], row["category"], row["location"], row["detail"])
        if key not in merged:
            merged[key] = dict(row, occurrences=1)
        else:
            merged[key]["occurrences"] += 1
            if row["severity"] == "high":
                merged[key]["severity"] = "high"
    result = list(merged.values())
    result.sort(key=lambda r: ({"critical":0,"high":1,"warning":2,"info":3}.get(r["severity"], 4),
                               r["source_report"], r["location"], r["category"]))
    return result

def write_outputs(issues, report_status):
    fields = ["fingerprint","severity","source_report","category","location","status","occurrences","detail","recommended_action"]
    with REGISTER.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for row in issues:
            writer.writerow({k: row.get(k, "") for k in fields})
    severities = Counter(row["severity"] for row in issues)
    sources = Counter(row["source_report"] for row in issues)
    lines = [
        "# Awakenology audit summary", "",
        "Generated automatically from the available source, runtime, link/asset, and accessibility reports.",
        "This register is a triage aid, not an automatic declaration that every finding is a confirmed defect.", "",
        "## Report coverage", "",
    ]
    for name, state in report_status.items():
        lines.append(f"- **{name}**: {state}")
    lines += ["", "## Findings", "",
              f"- Total deduplicated findings: **{len(issues)}**",
              f"- High severity: **{severities.get('high', 0)}**",
              f"- Warnings: **{severities.get('warning', 0)}**",
              f"- Informational: **{severities.get('info', 0)}**", "",
              "## Findings by report", ""]
    for name in INPUTS:
        lines.append(f"- **{name}**: {sources.get(name, 0)}")
    lines += ["", "## Triage rules", "",
              "1. Confirm that a finding is real in the source or delivered page before editing.",
              "2. A source SEO warning is not automatically a production defect; the Worker may repair it.",
              "3. Prioritize confirmed production failures, broken internal routes, and missing assets referenced by many pages.",
              "4. Treat accessibility heuristics as prompts for review, not a complete WCAG assessment.",
              "5. Preserve article text, translations, original emphasis, images, and intentional legacy routes.",
              "6. Do not enable merge-blocking strict mode until the baseline has been reviewed and expected redirects/exceptions documented.", ""]
    SUMMARY.write_text("\n".join(lines), encoding="utf-8")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict-reports", action="store_true",
                    help="fail if any expected input report is missing")
    args = ap.parse_args()
    reports, status = {}, {}
    for source, filename in INPUTS.items():
        rows = read_rows(ROOT / filename)
        reports[filename] = rows
        status[source] = f"{len(rows)} rows" if rows is not None else "MISSING"
    issues = build_issues(reports)
    write_outputs(issues, status)
    counts = Counter(row["severity"] for row in issues)
    missing = [name for name, state in status.items() if state == "MISSING"]
    print("Reports: " + ", ".join(f"{k}={v}" for k,v in status.items()))
    print(f"Deduplicated findings: {len(issues)}; high={counts.get('high',0)}; warnings={counts.get('warning',0)}")
    print(f"Register: {REGISTER.name}; summary: {SUMMARY.name}")
    return 1 if args.strict_reports and missing else 0

if __name__ == "__main__":
    raise SystemExit(main())
