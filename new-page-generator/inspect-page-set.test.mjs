import test from "node:test";
import assert from "node:assert/strict";
import { inspectPageSet, verifyRenderedInventory } from "./inspect-page-set.mjs";

const pageSet = () => ({ pages: Object.fromEntries(["en","ja","zh-Hant"].map((lang, i) => [lang, {
  title: lang, mode: i === 0 ? "docx" : "paste", source: "source-" + lang, route: "/" + lang + "/"
}])) });
test("DOCX is explicitly blocked pending real extraction", () => {
  const result = inspectPageSet(pageSet(), {
    en: { inventory: [{ type: "text", path: "/0", value: "pretend DOCX" }] },
    ja: {}, "zh-Hant": {}
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /DOCX extraction not implemented/);
});
test("missing input is blocking", () => {
  const result = inspectPageSet(pageSet(), {});
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /input payload missing/);
});
test("failed source cannot pass output comparison", () => {
  assert.equal(verifyRenderedInventory({ inventory: [], errors: ["unsafe"] }, []).ok, false);
});
test("identical inspected and rendered inventories pass", () => {
  const inventory = [{ type: "text", path: "/0", value: "中文 日本語 English" }];
  assert.equal(verifyRenderedInventory({ inventory, errors: [] }, structuredClone(inventory)).ok, true);
});
