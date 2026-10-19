import test from "node:test";
import assert from "node:assert/strict";
import { compareDocxSourceToHtml } from "./compare-docx-output.mjs";
const source = text => ({ ok: true, paragraphs: [{ index: 0, text, sourceLocation: { part: "word/document.xml", start: 42, end: 100 } }] });
test("accepts exact source characters across inline formatting and HTML entities", () => {
  const result = compareDocxSourceToHtml(source("什麽 & 日本語  English"), "<p>什麽 <strong>&amp;</strong> 日本語  English</p>");
  assert.equal(result.ok, true, result.errors.join("; "));
});
test("rejects missing text, changed variants, and changed whitespace", () => {
  for (const html of ["<p>什麼</p>", "<p>什麽 </p>", "<p>什</p>"]) {
    const result = compareDocxSourceToHtml(source("什麽"), html);
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /text mismatch/);
  }
});
test("reports original source paragraph for first difference", () => {
  const result = compareDocxSourceToHtml(source("Original"), "<p>OriginaX</p>");
  assert.match(result.errors.join(" "), /source paragraph 1, XML offset 42/);
});
test("rejects unreviewed HTML and absent source map", () => {
  assert.equal(compareDocxSourceToHtml(null, "<p>x</p>").ok, false);
  assert.equal(compareDocxSourceToHtml(source("x"), "<script>x</script>").ok, false);
});
test("accepts text spanning multiple source paragraphs without inventing separator characters", () => {
  const map = { ok: true, paragraphs: [
    { index: 0, text: "First", sourceLocation: { start: 1, end: 5 } },
    { index: 1, text: "Second", sourceLocation: { start: 6, end: 12 } }
  ] };
  assert.equal(compareDocxSourceToHtml(map, "<p>First</p><p>Second</p>").ok, true);
});


test("requires source text-wrapping breaks to remain at the exact character offset", () => {
  const map = { ok: true, paragraphs: [{
    index: 0, text: "AB", sourceLocation: { start: 1, end: 20 },
    content: [
      { type: "text", text: "A" },
      { type: "lineBreak", breakType: "textWrapping" },
      { type: "text", text: "B" }
    ]
  }] };
  assert.equal(compareDocxSourceToHtml(map, "<p>A<br>B</p>").ok, true);
  const missing = compareDocxSourceToHtml(map, "<p>AB</p>");
  assert.equal(missing.ok, false);
  assert.match(missing.errors.join(" "), /line-break mismatch/);
  const relocated = compareDocxSourceToHtml(map, "<p><br>AB</p>");
  assert.equal(relocated.ok, false);
  assert.match(relocated.errors.join(" "), /line-break mismatch/);
});

test("detects extra HTML line breaks even when all text characters match", () => {
  const result = compareDocxSourceToHtml(source("AB"), "<p>A<br>B</p>");
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /line-break mismatch/);
});


test("requires original DOCX images to remain at exact text offsets",()=>{
 const map={ok:true,paragraphs:[{
  index:0,text:"AB",sourceLocation:{start:1,end:20},
  content:[{type:"text",text:"A",textOffset:0,markerOrder:0},{type:"image",relationshipId:"rId7",textOffset:1,markerOrder:1},{type:"text",text:"B",textOffset:1,markerOrder:2}]
 }]};
 assert.equal(compareDocxSourceToHtml(map,'<p>A<img src="/assets/a.png" alt="">B</p>').ok,true);
 const moved=compareDocxSourceToHtml(map,'<p><img src="/assets/a.png" alt="">AB</p>');
 assert.equal(moved.ok,false);
 assert.match(moved.errors.join(" "),/image-position mismatch/);
 const missing=compareDocxSourceToHtml(map,"<p>AB</p>");
 assert.match(missing.errors.join(" "),/image-position mismatch/);
});
