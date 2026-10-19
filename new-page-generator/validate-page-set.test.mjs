import test from "node:test";
import assert from "node:assert/strict";
import { validatePageSet } from "./validate-page-set.mjs";

const valid = () => ({ pages: {
  en: { title: "English", mode: "docx", source: "english.docx", route: "/Example-English/" },
  ja: { title: "日本語", mode: "paste", source: "Japanese supplied HTML", route: "/日本語記事/" },
  "zh-Hant": { title: "繁體中文", mode: "docx", source: "chinese.docx", route: "/繁體中文/" }
} });

test("complete page set passes", () => assert.equal(validatePageSet(valid()).ok, true));
test("missing translation blocks", () => {
  const input = valid(); delete input.pages.ja;
  assert.match(validatePageSet(input).errors.join(" "), /Missing required language: ja/);
});
test("duplicate routes block", () => {
  const input = valid(); input.pages.ja.route = input.pages.en.route;
  assert.match(validatePageSet(input).errors.join(" "), /duplicate route/);
});
test("unsafe routes block", () => {
  const input = valid(); input.pages.en.route = "/../secret/";
  assert.equal(validatePageSet(input).ok, false);
});
test("unsupported mode blocks", () => {
  const input = valid(); input.pages.en.mode = "translate";
  assert.equal(validatePageSet(input).ok, false);
});
test("missing source blocks", () => {
  const input = valid(); input.pages.en.source = " ";
  assert.equal(validatePageSet(input).ok, false);
});


test("Markdown is an accepted explicit source mode",()=>{
 const input=valid(); input.pages.en.mode="markdown"; input.pages.en.source="english.md";
 assert.equal(validatePageSet(input).ok,true);
});
