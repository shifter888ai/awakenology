import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { extractDocx } from "./extract-docx.mjs";

async function fixture(body) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("word/_rels/document.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r>${body}</w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}
test("reject non-ZIP input", async () => assert.match((await extractDocx(Buffer.from("bad"))).errors.join(" "), /corrupt/));
test("reject tracked deletion", async () => assert.match((await extractDocx(await fixture("<w:del><w:r><w:delText>lost</w:delText></w:r></w:del>"))).errors.join(" "), /tracked deletion/));
test("reject explicit Word colors rather than drop them", async () => assert.match((await extractDocx(await fixture('<w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>Red</w:t>'))).errors.join(" "), /text color/));
test("reject drawings pending asset pipeline", async () => assert.match((await extractDocx(await fixture("<w:drawing/>"))).errors.join(" "), /drawings\/images/));
test("extract simple text from valid package", async () => {
  const result = await extractDocx(await fixture("<w:t>English 日本語 繁體中文</w:t>"));
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.match(result.html, /English 日本語 繁體中文/);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test("reject empty and non-Buffer inputs", async () => {
  assert.equal((await extractDocx(Buffer.alloc(0))).ok, false);
  assert.equal((await extractDocx("not a buffer")).ok, false);
});
test("reject oversized input before ZIP parsing", async () => {
  const input = Buffer.alloc(25 * 1024 * 1024 + 1);
  const result = await extractDocx(input);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /input limit/);
  assert.equal(result.html, null);
});
