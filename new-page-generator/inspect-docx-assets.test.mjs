import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { inspectDocxAssets } from "./inspect-docx-assets.mjs";

async function fixture({ document = "", rels = "", types = "" } = {}) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", types || '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/></Types>');
  zip.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${document}</w:body></w:document>`);
  zip.file("word/_rels/document.xml.rels", rels || '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
  return zip;
}
const inline = (rid = "rId1", descr = "A diagram") => `<w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="Picture 1" descr="${descr}"/><a:graphic><a:graphicData><a:blip r:embed="${rid}"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
const relation = (target = "media/image1.png", id = "rId1") => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/></Relationships>`;

test("extracts inline image bytes, checksum, order, output path and alt text", async () => {
  const zip = await fixture({ document: inline(), rels: relation() });
  zip.file("word/media/image1.png", Buffer.from("fixture image bytes"));
  const result = await inspectDocxAssets(await zip.generateAsync({ type: "nodebuffer" }));
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0].sourceOrder, 1);
  assert.equal(result.assets[0].relationshipId, "rId1");
  assert.equal(result.assets[0].outputPath, `assets/docx-${result.assets[0].sha256.slice(0, 16)}.png`);
  assert.equal(result.assets[0].altText, "A diagram");
  assert.equal(result.assets[0].byteLength, 19);
  assert.match(result.assets[0].sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.assets[0].bytes, Buffer.from("fixture image bytes"));
});

test("extracts floating image bytes and preserves anchor placement for visual review", async () => {
  const anchor = '<w:p><w:r><w:drawing><wp:anchor distL="114300" distR="114300" behindDoc="0" allowOverlap="1"><wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:wrapSquare/><wp:docPr id="28" name="Picture 1" descr="Floating diagram"/><a:graphic><a:graphicData><a:blip r:embed="rId1"/></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>';
  const zip = await fixture({ document: anchor, rels: relation() });
  zip.file("word/media/image1.png", Buffer.from("floating image bytes"));
  const result = await inspectDocxAssets(await zip.generateAsync({ type: "nodebuffer" }));
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0].placement.kind, "floating");
  assert.equal(result.assets[0].placement.requiresVisualReview, true);
  assert.equal(result.assets[0].placement.anchorAttributes.behindDoc, "0");
  assert.equal(result.assets[0].placement.anchorAttributes.distL, "114300");
  assert.equal(result.assets[0].placement.docPr.id, "28");
  assert.match(result.assets[0].placement.horizontalPosition, /relativeFrom="column"/);
  assert.match(result.assets[0].placement.verticalPosition, /relativeFrom="paragraph"/);
  assert.match(result.assets[0].placement.wrap, /wp:wrapSquare/);
  assert.deepEqual(result.assets[0].bytes, Buffer.from("floating image bytes"));
});

test("blocks external image relationships", async () => {
  const zip = await fixture({ document: inline(), rels: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://example.com/image.png" TargetMode="External"/></Relationships>' });
  const result = await inspectDocxAssets(await zip.generateAsync({ type: "nodebuffer" }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /Externally linked image|outside the DOCX package/);
});

test("blocks missing relationship and missing media part", async () => {
  const missingRelationship = await inspectDocxAssets(await (await fixture({ document: inline("missing") })).generateAsync({ type: "nodebuffer" }));
  assert.equal(missingRelationship.ok, false);
  assert.match(missingRelationship.errors.join(" "), /missing relationship ID|relationship missing/);

  const zip = await fixture({ document: inline(), rels: relation() });
  const missingMedia = await inspectDocxAssets(await zip.generateAsync({ type: "nodebuffer" }));
  assert.equal(missingMedia.ok, false);
  assert.match(missingMedia.errors.join(" "), /media part is missing/);
});

test("blocks a drawing image reference outside inline drawings", async () => {
  const result = await inspectDocxAssets(await (await fixture({ document: '<a:blip r:embed="rId1"/>' })).generateAsync({ type: "nodebuffer" }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /outside a recognized inline or floating drawing/);
});

test("rejects invalid input", async () => {
  assert.equal((await inspectDocxAssets(Buffer.from("bad"))).ok, false);
  assert.equal((await inspectDocxAssets(null)).ok, false);
});

test("blocks inline drawings that are shapes rather than images", async () => {
  const zip = await fixture({ document: "<w:p><w:r><w:drawing><wp:inline><wp:docPr id=\"1\" name=\"Shape\"/><a:graphic><a:graphicData/></a:graphic></wp:inline></w:drawing></w:r></w:p>" });
  const result = await inspectDocxAssets(await zip.generateAsync({ type: "nodebuffer" }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /contains no recognized image/);
});
