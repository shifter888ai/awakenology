import test from "node:test";
import assert from "node:assert/strict";
import { countXmlTag } from "./pilot-xml-diagnostics.mjs";

test("counts qualified XML tags with whitespace, slash, and closing-angle boundaries", () => {
  const xml = '<w:br/><w:br w:type="textWrapping"/><w:br >x</w:br><w:break/><w:bridge/>';
  assert.equal(countXmlTag(xml, "w:br"), 3);
  assert.equal(countXmlTag('<wp:anchor/><wp:anchor x="1"><wp:anchorish/>', "wp:anchor"), 2);
  assert.equal(countXmlTag('<w:color/><w:colour/>', "w:color"), 1);
});
test("rejects invalid XML tag counter inputs", () => {
  assert.throws(() => countXmlTag(null, "w:br"), TypeError);
  assert.throws(() => countXmlTag("<w:br/>", "w:br.*"), TypeError);
});
