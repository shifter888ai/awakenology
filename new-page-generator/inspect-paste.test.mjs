import test from "node:test";
import assert from "node:assert/strict";
import { inspectPastedHtml } from "./inspect-paste.mjs";

function element(tagName, attributes = {}, childNodes = []) {
  const attrs = Object.entries(attributes).map(([name, value]) => ({ name, value }));
  return {
    nodeType: 1, tagName: tagName.toUpperCase(), attributes: attrs, childNodes,
    getAttribute(name) { return attrs.find(item => item.name === name)?.value ?? null; }
  };
}
function parserForLink(html) {
  const href = /href="([^"]*)"/i.exec(html)?.[1] ?? "";
  const text = { nodeType: 3, textContent: "Link" };
  return { parseFromString() {
    return { head: { childNodes: [] }, body: { childNodes: [element("p", {}, [element("a", { href }, [text])])] } };
  }};
}
test("rejects obfuscated and unsupported URL schemes in pasted links", () => {
  for (const href of ["javascript:alert(1)", "java\nscript:alert(1)", "data:text/html,boom", "blob:https://example.com/id", "ftp://example.com/file", "//example.com/path"]) {
    const html = '<p><a href="' + href + '">Link</a></p>';
    const result = inspectPastedHtml(html, parserForLink(html));
    assert.equal(result.ok, false, href);
    assert.ok(result.errors.some(error => error.includes("unsafe URL")), result.errors.join("; "));
  }
});
test("allows ordinary relative, HTTPS, mailto and telephone links", () => {
  for (const href of ["/guide/page/", "../page/", "#section", "https://example.com/", "mailto:help@example.com", "tel:+123456789"]) {
    const html = '<p><a href="' + href + '">Link</a></p>';
    const result = inspectPastedHtml(html, parserForLink(html));
    assert.equal(result.ok, true, href + ": " + result.errors.join("; "));
  }
});

test("image sources allow HTTP(S) only and still require alt text", () => {
  const makeParser = (src, alt = "Illustration") => ({ parseFromString() {
    const text = { nodeType: 3, textContent: "Caption" };
    return { head: { childNodes: [] }, body: { childNodes: [
      element("p", {}, [text]), element("img", { src, alt }, [])
    ] } };
  }});
  for (const src of ["javascript:alert(1)", "data:image/png;base64,AA==", "blob:https://example.com/id", "//example.com/image.png"]) {
    const html = '<p>Caption</p><img src="' + src + '" alt="Illustration">';
    const result = inspectPastedHtml(html, makeParser(src));
    assert.equal(result.ok, false, src);
    assert.ok(result.errors.some(error => error.includes("unsafe URL")), result.errors.join("; "));
  }
  const safeHtml = '<p>Caption</p><img src="https://example.com/image.png" alt="Illustration">';
  const safe = inspectPastedHtml(safeHtml, makeParser("https://example.com/image.png"));
  assert.equal(safe.ok, true, safe.errors.join("; "));
});


test("allows standard document wrappers for explicit HTML-file mode only",()=>{
 const html='<!doctype html><html><head><meta charset="utf-8"><title>Article</title></head><body><p>Article body</p></body></html>';
 const parser={parseFromString:()=>({head:{childNodes:[element("title",{},[{nodeType:3,textContent:"Article"}]),element("meta",{charset:"utf-8"},[])]},body:{childNodes:[element("p",{},[{nodeType:3,textContent:"Article body"}])]}})};
 const pasted=inspectPastedHtml(html,parser);
 assert.equal(pasted.ok,false,"full document wrappers remain blocked for fragment paste");
 const file=inspectPastedHtml(html,parser,{allowDocumentShell:true});
 assert.equal(file.ok,true,file.errors.join("; "));
});

test("HTML-file mode still blocks embedded stylesheets and scripts",()=>{
 const html='<html><head><style>p{color:red}</style><script>run()</script></head><body><p>Article</p></body></html>';
 const parser={parseFromString:()=>({head:{childNodes:[element("style",{},[])]},body:{childNodes:[element("p",{},[{nodeType:3,textContent:"Article"}])]}})};
 const result=inspectPastedHtml(html,parser,{allowDocumentShell:true});
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(error=>error.includes("Embedded CSS")));
 assert.ok(result.errors.some(error=>error.includes("unsupported element <script>")));
});


test("accepts explicit Word numbering and paragraph-mark provenance attributes",()=>{
 const attrs={
  "data-word-num-id":"7","data-word-abstract-num-id":"2","data-word-level":"0",
  "data-word-num-format":"decimal","data-word-num-text":"%1.","data-word-num-start":"3",
  "data-word-indent-left":"720","data-word-indent-hanging":"360",
  "data-word-mark-font-ascii":"Arial","data-word-mark-lang-val":"en-US"
 };
 const html='<ol start="3"><li '+Object.entries(attrs).map(([key,value])=>key+'="'+value+'"').join(" ")+'>List item</li></ol>';
 const text={nodeType:3,textContent:"List item"};
 const li=element("li",attrs,[text]), ol=element("ol",{start:"3"},[li]);
 const parser={parseFromString:()=>({head:{childNodes:[]},body:{childNodes:[ol]}})};
 const result=inspectPastedHtml(html,parser);
 assert.equal(result.ok,true,result.errors.join("; "));
});
