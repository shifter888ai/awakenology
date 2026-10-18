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
