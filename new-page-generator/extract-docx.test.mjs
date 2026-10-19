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
test("reject malformed drawings instead of silently dropping them", async () => assert.match((await extractDocx(await fixture("<w:drawing/>"))).errors.join(" "), /DOCX image adapter/));

test("rejects superscript, baseline shifts, and hidden text until formatting is mapped", async () => {
  const result = await extractDocx(await fixture('<w:rPr><w:vertAlign w:val="superscript"/><w:position w:val="4"/><w:vanish/></w:rPr><w:t>Styled</w:t>'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /run effects or hidden text/);
  assert.equal(result.html, null);
});
test("rejects section and pagination layout until page flow is mapped", async () => {
  const result = await extractDocx(await fixture('<w:pPr><w:keepNext/><w:pageBreakBefore/></w:pPr><w:t>Page flow</w:t>'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /pagination, direction, or section layout/);
  assert.equal(result.html, null);
});
test("rejects even simple Word tables until cell and paragraph structure is mapped", async () => {
  const result = await extractDocx(await fixture('<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /Word table structure/);
  assert.equal(result.html, null);
});


test("reject font-family and font-size metadata until rendered mapping is lossless", async () => {
  const fonts = await extractDocx(await fixture('<w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Yu Gothic"/><w:sz w:val="24"/></w:rPr><w:t>Styled</w:t>'));
  assert.equal(fonts.ok, false);
  assert.match(fonts.errors.join(" "), /font family/);
  assert.match(fonts.errors.join(" "), /font size/);
  assert.equal(fonts.html, null);
});
test("reject complex-script and language metadata until rendered mapping is lossless", async () => {
  const result = await extractDocx(await fixture('<w:rPr><w:lang w:eastAsia="ja-JP"/><w:bCs/><w:iCs/><w:caps/></w:rPr><w:t>文字</w:t>'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /language metadata/);
  assert.match(result.errors.join(" "), /complex-script bold or italic/);
  assert.match(result.errors.join(" "), /capitalization/);
});
test("distinguishes unsupported paragraph spacing from run character spacing", async () => {
  const result = await extractDocx(await fixture('<w:pPr><w:spacing w:before="120" w:after="120"/></w:pPr><w:rPr><w:spacing w:val="20"/></w:rPr><w:t>Spaced</w:t>'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /character spacing/);
  assert.match(result.errors.join(" "), /paragraph or line spacing/);
});
test("reject style and paragraph layout metadata rather than flattening it", async () => {
  const result = await extractDocx(await fixture('<w:pPr><w:pStyle w:val="Heading1"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:ind w:left="720"/><w:jc w:val="center"/></w:pPr><w:t>Heading</w:t>'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /style inheritance/);
  assert.match(result.errors.join(" "), /numbering or list semantics/);
  assert.match(result.errors.join(" "), /indentation or alignment/);
  assert.equal(result.html, null);
});

test("extract simple text from valid package", async () => {
  const result = await extractDocx(await fixture("<w:t>English 日本語 繁體中文</w:t>"));
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.match(result.html, /English 日本語 繁體中文/);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.sourceMap.paragraphs[0].text, "English 日本語 繁體中文");
  assert.equal(result.sourceMap.paragraphs[0].sourceLocation.part, "word/document.xml");
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

test("reject document XML containing invalid UTF-8", async () => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("word/_rels/document.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
  zip.file("word/document.xml", Buffer.from([0x3c, 0x77, 0x3a, 0x74, 0x3e, 0xc3, 0x28, 0x3c, 0x2f, 0x77, 0x3a, 0x74, 0x3e]));
  const input = await zip.generateAsync({ type: "nodebuffer" });
  const result = await extractDocx(input);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /not valid UTF-8/);
  assert.equal(result.html, null);
});

test("integrate an inline image and expose its verified asset record", async () => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("word/_rels/document.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>');
  zip.file("word/media/image1.png", Buffer.from("image fixture bytes"));
  zip.file("word/document.xml", '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:t>Before</w:t></w:r><w:r><w:drawing><wp:inline><wp:extent cx="914400" cy="914400"/><wp:docPr id="1" name="Picture" descr="Fixture illustration"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="Picture"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r><w:r><w:t>After</w:t></w:r></w:p></w:body></w:document>');
  const result = await extractDocx(await zip.generateAsync({ type: "nodebuffer" }));
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.match(result.html, /Before/);
  assert.match(result.html, /After/);
  assert.match(result.html, /assets\/docx-[a-f0-9]{16}\.png/);
  assert.match(result.html, /Fixture illustration/);
  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0].sha256.length, 64);
  assert.equal(result.sourceMap.imageReferences.length, 1);
  assert.equal(result.sourceMap.imageReferences[0].relationshipId, result.assets[0].relationshipId);
});

test("rejects inherited font and language metadata even when document runs are plain", async () => {
 const zip=await JSZip.loadAsync(await fixture("<w:t>Plain-looking text</w:t>"));
 zip.file("word/styles.xml", '<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>');
 const result=await extractDocx(await zip.generateAsync({type:"nodebuffer"}));
 assert.equal(result.ok,false);
 assert.equal(result.html,null);
 assert.match(result.errors.join(" "),/inherited Word feature: explicit font family/);
 assert.match(result.errors.join(" "),/inherited Word feature: explicit language metadata/);
});
test("rejects inherited paragraph spacing even without direct paragraph spacing", async () => {
 const zip=await JSZip.loadAsync(await fixture("<w:t>Plain-looking text</w:t>"));
 zip.file("word/styles.xml", '<w:styles><w:style w:type="paragraph" w:styleId="Normal"><w:pPr><w:spacing w:after="120"/></w:pPr></w:style></w:styles>');
 const result=await extractDocx(await zip.generateAsync({type:"nodebuffer"}));
 assert.equal(result.ok,false);
 assert.equal(result.html,null);
 assert.match(result.errors.join(" "),/inherited Word feature: paragraph or line spacing/);
});
