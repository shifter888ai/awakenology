
"""Offline inventory for the non-deployed static HTML PoC."""
import hashlib
import json
import subprocess
from pathlib import Path
from check_real_pages import ROOT
from html_transformer import transform
from page_rules import rules_for
from parity_validator import validate, validate_metadata, fingerprint

PRIVATE_PREFIXES=("api/","editor/","github-editor/","scripts/","tests/","docs/",".github/","internal/","new-article/")
PRIVATE_NAMES={"404.html"}
REPORT=ROOT/"static-html-full-inventory-report.json"
WORKER_ONLY_ROUTE_PREFIXES=("/api/",)

def validate_public_html_manifest(routes):
 forbidden=sorted(route for route in routes if route=="/api" or route.startswith(WORKER_ONLY_ROUTE_PREFIXES))
 if forbidden:
  raise AssertionError("Worker-only API routes cannot enter the static public HTML manifest: "+", ".join(forbidden))
 return True

def classify_public_html_paths(paths):
 transformable,excluded=[],[]
 for path in sorted(filter(None,paths)):
  normalized=path.replace("\\","/").casefold()
  if normalized.startswith(PRIVATE_PREFIXES) or normalized in {name.casefold() for name in PRIVATE_NAMES}: excluded.append(path)
  elif path=="index.html" or path.endswith("/index.html"): transformable.append(path)
  else: raise AssertionError(f"Unclassified public HTML file: {path}")
 if not transformable or "index.html" not in transformable: raise AssertionError("Public route inventory is empty or missing homepage")
 required={"editor/index.html","editor/generator.html","editor/html-generator.html","Internal/New-Article/index.html"}
 if not required.issubset(set(excluded)): raise AssertionError("Expected private editor/generator files absent from exclusions")
 return transformable,excluded

def public_sources():
 raw=subprocess.check_output(["git","ls-files","-z","--","*.html"],cwd=ROOT).decode("utf-8").split("\0")
 return classify_public_html_paths(raw)

def main():
 paths,excluded=public_sources()
 routes,failures=[],[]
 for path in paths:
  route="/" if path=="index.html" else "/"+path[:-len("index.html")]
  source=(ROOT/path).read_bytes().decode("utf-8")
  built=None
  try:
   built=transform(source,route); validate(source,built)
   rules=rules_for(route); validate_metadata(built,canonical=rules.canonical,noindex=rules.noindex)
   if built!=transform(source,route) or built!=transform(built,route): raise AssertionError("Non-reproducible or non-idempotent build")
   routes.append({"path":path,"route":route,"source_sha256":hashlib.sha256(source.encode("utf-8")).hexdigest(),
    "built_sha256":hashlib.sha256(built.encode("utf-8")).hexdigest(),"canonical":rules.canonical,"noindex":rules.noindex})
   print(f"PASS {path}",flush=True)
  except Exception as error:
   detail={"path":path,"route":route,"error":str(error)}
   if built is not None and "Content integrity failure" in str(error):
    from difflib import SequenceMatcher
    a,b=fingerprint(source),fingerprint(built)
    for field in ("text","markup"):
     left,right=a[field],b[field]
     first=next(((tag,i,j,x,y) for tag,i,j,x,y in SequenceMatcher(None,left,right,autojunk=False).get_opcodes() if tag!="equal"),None)
     if first:
      tag,i,j,x,y=first
      detail[field+"_first_difference"]={"kind":tag,"source_context":left[max(0,i-90):min(len(left),j+90)],
       "built_context":right[max(0,x-90):min(len(right),y+90)],"source_length":len(left),"built_length":len(right)}
   failures.append(detail); print(f"FAIL {path}: {error}",flush=True)
 validate_public_html_manifest([item["route"] for item in routes])
 report={"scope":"offline source/build validation of supported public index routes; unclassified public HTML fails closed; no Worker or browser parity claim",
  "public_index_routes":len(paths),"transformed_routes":len(routes),
  "excluded_html":excluded,"supported_route_build_complete":not failures and len(routes)==len(paths),"routes":routes,"failures":failures}
 REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\\n",encoding="utf-8")
 if failures: raise SystemExit(f"{len(failures)} of {len(paths)} supported public routes failed; report written; no deployment authorized")
 print(f"PASS: {len(routes)}/{len(paths)} supported public index routes validated.")

if __name__=="__main__": main()
