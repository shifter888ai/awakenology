import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHtmlInventory } from "./normalize-html-inventory.mjs";

test("normalizes text, elements, formatting, links, assets and child order", () => {
  const inventory = [
    { type: "element", path: "/0", tag: "P", attributes: [] },
    { type: "text", path: "/0/0", value: "Exact " },
    { type: "element", path: "/0/1", tag: "STRONG", attributes: [] },
    { type: "text", path: "/0/1/0", value: "bold" },
    { type: "element", path: "/1", tag: "A", attributes: [["href","https://example.org"],["title","source"]] },
    { type: "text", path: "/1/0", value: "link" },
    { type: "element", path: "/2", tag: "IMG", attributes: [["src","assets/pic.png"],["alt","Diagram"]] }
  ];
  const result = normalizeHtmlInventory(inventory, { language: "en", sourceMode: "html-paste", sourcePart: "pasted-html" });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.deepEqual(result.blocks[0].orderedChildren, ["n1","n2"]);
  assert.equal(result.blocks[2].formatting[0].kind, "bold");
  assert.equal(result.blocks[2].type, "text");
  assert.deepEqual(result.blocks[4].links, [{ href: "https://example.org", title: "source" }]);
  assert.deepEqual(result.blocks[6].assets, [{ src: "assets/pic.png", alt: "Diagram" }]);
  assert.equal(result.blocks[1].text, "Exact ");
});

test("rejects missing location, unsupported language and malformed inventory", () => {
  assert.equal(normalizeHtmlInventory([], { language: "en", sourceMode: "html-paste", sourcePart: "paste" }).ok, false);
  assert.equal(normalizeHtmlInventory([{ type: "text", path: "/0", value: "x" }], { language: "fr", sourceMode: "html-paste", sourcePart: "paste" }).ok, false);
  assert.equal(normalizeHtmlInventory([{ type: "element", path: "/0", tag: "P", attributes: [["href"]] }], { language: "en", sourceMode: "html-paste", sourcePart: "paste" }).ok, false);
});

test("does not pretend generated HTML paths are original DOCX XML offsets", () => {
  const result = normalizeHtmlInventory([{ type: "text", path: "/0", value: "sample" }], { language: "ja", sourceMode: "docx", sourcePart: "converted-html" });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.deepEqual(result.blocks[0].sourceLocation, { part: "converted-html", path: "/0" });
  assert.equal("start" in result.blocks[0].sourceLocation, false);
});


test("retains ordered-list starts and Word numbering provenance in normalized blocks",()=>{
 const inventory=[
  {type:"element",path:"/0",tag:"OL",attributes:[["start","3"],["type","I"]]},
  {type:"element",path:"/0/0",tag:"LI",attributes:[["data-word-num-id","7"],["data-word-level","0"]]},
  {type:"text",path:"/0/0/0",value:"Third item"}
 ];
 const result=normalizeHtmlInventory(inventory,{language:"en",sourceMode:"docx",sourcePart:"converted-html"});
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.ok(result.blocks[0].formatting.some(item=>item.kind==="list-start"&&item.value==="3"));
 assert.ok(result.blocks[0].formatting.some(item=>item.kind==="list-marker-type"&&item.value==="I"));
 assert.ok(result.blocks[1].formatting.some(item=>item.kind==="word-metadata"&&item.property==="data-word-num-id"&&item.value==="7"));
});
