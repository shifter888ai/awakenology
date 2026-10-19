import test from "node:test";
import assert from "node:assert/strict";
import { reviewPasteInventory } from "./review-paste-inventory.mjs";
const el = (tag, attributes) => [{ type: "element", path: "/0", tag, attributes }];
test("allows approved red/blue styling", () => assert.equal(reviewPasteInventory(el("SPAN", [["style", "color:#1769c2;font-weight:bold"]])).ok, true));
test("rejects event handlers", () => assert.equal(reviewPasteInventory(el("A", [["onclick", "alert(1)"]])).ok, false));
test("rejects javascript links", () => assert.equal(reviewPasteInventory(el("A", [["href", "javascript:alert(1)"]])).ok, false));
test("rejects remote and traversal image paths", () => {
  assert.equal(reviewPasteInventory(el("IMG", [["src", "https://example.com/image.png"]])).ok, false);
  assert.equal(reviewPasteInventory(el("IMG", [["src", "/../private.png"]])).ok, false);
});
test("rejects CSS expressions and URLs", () => assert.equal(reviewPasteInventory(el("SPAN", [["style", "color:expression(alert(1))"]])).ok, false));
test("rejects unsupported attribute on otherwise valid element", () => assert.equal(reviewPasteInventory(el("P", [["href", "/English/"]])).ok, false));


test("allows verified Word list provenance and paragraph/run typography",()=>{
 const result=reviewPasteInventory([
  {type:"element",path:"/0",tag:"OL",attributes:[["start","3"],["type","I"]]},
  {type:"element",path:"/0/0",tag:"LI",attributes:[["style","margin-left:36pt;text-indent:-18pt"],["data-word-num-id","7"],["data-word-num-format","decimal"],["data-word-mark-font-east-asia","Yu Gothic"]]},
  {type:"element",path:"/0/0/0",tag:"SPAN",attributes:[["style",'font-weight:bold;font-size:12pt;font-family:"Yu Gothic";letter-spacing:1pt'],["data-word-font-east-asia","Yu Gothic"],["data-word-lang-east-asia","ja-JP"]]}
 ]);
 assert.equal(result.ok,true,result.errors.join("; "));
});

test("still rejects unsupported CSS and unapproved provenance attributes",()=>{
 assert.equal(reviewPasteInventory(el("LI",[["style","position:fixed"],["data-word-unknown","x"]])).ok,false);
});


test("allows explicitly supported pixel-based inline layout",()=>{
 const result=reviewPasteInventory(el("P",[["style","font-size:16px;margin-left:12px;line-height:20px"]]));
 assert.equal(result.ok,true,result.errors.join("; "));
});
