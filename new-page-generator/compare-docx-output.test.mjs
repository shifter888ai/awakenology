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
