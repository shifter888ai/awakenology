import test from "node:test";
import assert from "node:assert/strict";
import { generateReviewedPageSet } from "./generate-reviewed-page-set.mjs";

const pageSet = { pages: Object.fromEntries(["en", "ja", "zh-Hant"].map((lang, i) => [lang, {
  title: lang, mode: "paste", source: "fixture", route: ["/English/example/", "/Japanese/example/", "/Chinese/example/"][i]
}])) };

test("missing input blocks the whole set before rendering", async () => {
  const result = await generateReviewedPageSet({ pageSet, inputs: {}, outputs: {} });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "source-inspection");
  assert.deepEqual(result.pages, {});
});
test("missing parser blocks paste input instead of emitting pages", async () => {
  const inputs = Object.fromEntries(["en", "ja", "zh-Hant"].map(lang => [lang, { html: "<p>Text</p>" }]));
  const outputs = Object.fromEntries(["en", "ja", "zh-Hant"].map(lang => [lang, {}]));
  const result = await generateReviewedPageSet({ pageSet, inputs, outputs });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "source-inspection");
  assert.deepEqual(result.pages, {});
});
test("incomplete route set blocks before rendering", async () => {
  const broken = structuredClone(pageSet);
  delete broken.pages["zh-Hant"];
  const result = await generateReviewedPageSet({ pageSet: broken, inputs: {}, outputs: {} });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "source-inspection");
});

function mockParser() {
  return {
    parseFromString(html) {
      const match = /<p>([\s\S]*?)<\/p>/i.exec(html);
      const text = match ? match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : "";
      const p = { nodeType: 1, tagName: "P", attributes: [], childNodes: [{ nodeType: 3, textContent: text }] };
      return { body: { childNodes: [p] } };
    }
  };
}
function completeInputs() {
  return Object.fromEntries(["en", "ja", "zh-Hant"].map(lang => [lang, { html: "<p>Text</p>", parser: mockParser() }]));
}
function completeOutputs(html = "<p>Text</p>") {
  return Object.fromEntries(["en", "ja", "zh-Hant"].map(lang => [lang, {
    title: lang, description: "Fixture description", parser: mockParser(),
    approvedHeader: "<header>Approved header</header>",
    approvedFooter: "<footer>Approved footer</footer>",
    reviewedArticleHtml: html
  }]));
}

test("complete page set is generated from parsed HTML inventories", async () => {
  const result = await generateReviewedPageSet({ pageSet, inputs: completeInputs(), outputs: completeOutputs() });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.stage, "review-ready-static-output");
  assert.match(result.pages.en.html, /<article class="article"><p>Text<\/p><\/article>/);
});
test("rendered text changes block the whole page set", async () => {
  const result = await generateReviewedPageSet({ pageSet, inputs: completeInputs(), outputs: completeOutputs("<p>Changed</p>") });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "content-integrity");
  assert.deepEqual(result.pages, {});
  assert.ok(result.errors.some(error => /changed/.test(error)));
});
test("missing rendered parser blocks output instead of trusting caller inventory", async () => {
  const outputs = completeOutputs();
  for (const lang of ["en", "ja", "zh-Hant"]) delete outputs[lang].parser;
  const result = await generateReviewedPageSet({ pageSet, inputs: completeInputs(), outputs });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "content-integrity");
  assert.deepEqual(result.pages, {});
});
