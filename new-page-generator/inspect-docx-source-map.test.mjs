import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { inspectDocxSourceMap } from "./inspect-docx-source-map.mjs";

async function fixture(body) {
  const zip = new JSZip();
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}
test("maps original paragraph order, exact text and run offsets", async () => {
  const source = await fixture('<w:p><w:r><w:t xml:space="preserve">English </w:t></w:r><w:r><w:t>日本語 &amp; 繁體</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r></w:p>');
  const result = await inspectDocxSourceMap(source);
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.deepEqual(result.paragraphs.map(p=>p.text), ["English 日本語 & 繁體","Second"]);
  assert.equal(result.paragraphs[0].textRuns.length, 2);
  assert.ok(result.paragraphs[0].sourceLocation.end > result.paragraphs[0].sourceLocation.start);
  assert.ok(result.paragraphs[1].sourceLocation.start >= result.paragraphs[0].sourceLocation.end);
});
test("maps image relationship to its original paragraph location", async () => {
  const result = await inspectDocxSourceMap(await fixture('<w:p><w:r><w:drawing><wp:inline><a:blip r:embed="rId7"/></wp:inline></w:drawing></w:r></w:p>'));
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.imageReferences[0].relationshipId, "rId7");
  assert.equal(result.imageReferences[0].paragraphIndex, 0);
});
test("blocks ambiguous text constructs", async () => {
  const result = await inspectDocxSourceMap(await fixture('<w:p><w:hyperlink r:id="rId2"><w:r><w:t>linked</w:t></w:r></w:hyperlink></w:p>'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /unsupported or ambiguous/);
});
test("blocks invalid input and missing source paragraphs", async () => {
  assert.equal((await inspectDocxSourceMap(Buffer.from("bad"))).ok, false);
  assert.equal((await inspectDocxSourceMap(await fixture(""))).ok, false);
});


test("blocks external and internal hyperlinks until targets are mapped", async () => {
  const external = await inspectDocxSourceMap(await fixture('<w:p><w:hyperlink r:id="rIdExt"><w:r><w:t>external</w:t></w:r></w:hyperlink></w:p>'));
  assert.equal(external.ok, false);
  assert.match(external.errors.join(" "), /unsupported or ambiguous/);
  const internal = await inspectDocxSourceMap(await fixture('<w:p><w:hyperlink w:anchor="section-2"><w:r><w:t>internal</w:t></w:r></w:hyperlink></w:p>'));
  assert.equal(internal.ok, false);
  assert.match(internal.errors.join(" "), /unsupported or ambiguous/);
});

test("maps explicit text-wrapping breaks in source order", async () => {
  const result = await inspectDocxSourceMap(await fixture('<w:p><w:r><w:t>Before</w:t><w:br w:type="textWrapping"/><w:t>After</w:t></w:r></w:p>'));
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.deepEqual(result.paragraphs[0].content.map(x => x.type), ["text", "lineBreak", "text"]);
  assert.equal(result.paragraphs[0].content[1].breakType, "textWrapping");
  assert.equal(result.paragraphs[0].text, "BeforeAfter");
});
test("blocks tabs, carriage returns, and non-text-wrapping breaks", async () => {
  for (const construct of ['<w:tab/>', '<w:cr/>', '<w:br w:type="page"/>']) {
    const result = await inspectDocxSourceMap(await fixture('<w:p><w:r><w:t>Before</w:t>'+construct+'<w:t>After</w:t></w:r></w:p>'));
    assert.equal(result.ok, false, construct);
  }
});
