
"""Offline inventory for the non-deployed static HTML PoC."""
import hashlib
import json
import subprocess
from pathlib import Path
from bs4 import BeautifulSoup
from check_real_pages import ROOT
from html_transformer import transform
from page_rules import rules_for
from parity_validator import validate, validate_metadata, fingerprint

PRIVATE_PREFIXES=("editor/","github-editor/","scripts/","tests/","docs/",".github/")
PRIVATE_NAMES={"404.html"}
REPORT=ROOT/"static-html-full-inventory-report.json"
KNOWN_BLOCKED_ROUTES={
 "Roswell/index.html":{
  "route":"/Roswell/",
  "source_git_blob_sha":"840860c1392aa236558dd23871ab9840f070a8c5",
  "reason":"Legacy Alien Interview HTML has no <article> or <main> content scope; keep source bytes unchanged and exclude from PoC transformation."
 }
}
KNOWN_STANDALONE_HTML={
 "Roswell/Roswell.html":{
  "source_git_blob_sha":"4480744a5f4b12ba3ec0cfd53f842b2b633673ed",
  "reason":"Standalone PDF-derived HTML resource, not an index route or canonical sitemap route; preserve unchanged and exclude from page transformation."
 }
}

def git_blob_sha(blob):
 return hashlib.sha1(b"blob "+str(len(blob)).encode("ascii")+bytes([0])+blob).hexdigest()

def classify_public_html_paths(paths):
 transformable,excluded,blocked,standalone=[],[],[],[]
 for path in sorted(filter(None,paths)):
  if path.startswith(PRIVATE_PREFIXES) or path in PRIVATE_NAMES: excluded.append(path)
  elif path in KNOWN_BLOCKED_ROUTES: blocked.append({"path":path,**KNOWN_BLOCKED_ROUTES[path]})
  elif path in KNOWN_STANDALONE_HTML: standalone.append({"path":path,**KNOWN_STANDALONE_HTML[path]})
  elif path=="index.html" or path.endswith("/index.html"): transformable.append(path)
  else: raise AssertionError(f"Unclassified public HTML file: {path}")
 if not transformable or "index.html" not in transformable: raise AssertionError("Public route inventory is empty or missing homepage")
 required={"editor/index.html","editor/generator.html","editor/html-generator.html"}
 if not required.issubset(set(excluded)): raise AssertionError("Expected private editor/generator files absent from exclusions")
 return transformable,excluded,blocked,standalone

def public_sources():
 raw=subprocess.check_output(["git","ls-files","-z","--","*.html"],cwd=ROOT).decode("utf-8").split("\\0")
 transformable,excluded,blocked,standalone=classify_public_html_paths(raw)
 for record in blocked+standalone:
  actual=git_blob_sha((ROOT/record["path"]).read_bytes())
  if actual!=record["source_git_blob_sha"]:
   raise AssertionError(f"Known Roswell source changed; review classification: {record['path']}: {actual}")
 blocked_source=BeautifulSoup((ROOT/"Roswell/index.html").read_text(encoding="utf-8"),"html.parser")
 if blocked_source.select_one("article.article, .article, main") is not None:
  raise AssertionError("Roswell source now has a content scope; review and reclassify it")
 sitemap=(ROOT/"sitemap.xml").read_text(encoding="utf-8")
 if blocked and "https://awakenology.space/Roswell/" not in sitemap:
  raise AssertionError("Known blocked /Roswell/ route is no longer in the canonical sitemap")
 if standalone and "https://awakenology.space/Roswell/Roswell.html" in sitemap:
  raise AssertionError("Roswell/Roswell.html became a sitemap route; review classification")
 return transformable,excluded,blocked,standalone

def main():
 paths,excluded,blocked,standalone=public_sources()
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
 report={"scope":"offline source/build validation of supported public index routes; known blockers and standalone HTML are reported, not transformed; no Worker or browser parity claim",
  "public_index_routes":len(paths)+len(blocked),"transformed_routes":len(routes),"blocked_routes":blocked,"standalone_html":standalone,
  "excluded_html":excluded,"migration_ready":not failures and not blocked and not standalone,"routes":routes,"failures":failures}
 REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\\n",encoding="utf-8")
 if failures: raise SystemExit(f"{len(failures)} of {len(paths)} supported public routes failed; report written; no deployment authorized")
 print(f"PASS: {len(routes)}/{len(paths)} supported routes validated; {len(blocked)} known public route blocker(s) and {len(standalone)} standalone HTML resource(s) remain explicitly untransformed.")

if __name__=="__main__": main()
