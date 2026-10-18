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
