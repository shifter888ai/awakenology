import test from "node:test";
import assert from "node:assert/strict";
import { validateInventory, compareInventories } from "./content-inventory.mjs";

const fixture = () => [
  { type: "element", path: "/0", tag: "P", attributes: [] },
  { type: "text", path: "/0/0", value: "繁體中文 日本語 English  " },
  { type: "element", path: "/1", tag: "STRONG", attributes: [] },
  { type: "text", path: "/1/0", value: "Red & blue" },
  { type: "asset", path: "/2", sha256: "a".repeat(64), alt: "Image" }
];
test("identical ordered inventories pass", () => assert.equal(compareInventories(fixture(), fixture()).ok, true));
test("loss of one space blocks", () => {
  const out = fixture(); out[1].value = out[1].value.trimEnd();
  assert.equal(compareInventories(fixture(), out).ok, false);
});
test("formatting loss blocks despite identical text", () => {
  const out = fixture(); out[2].tag = "SPAN";
  assert.equal(compareInventories(fixture(), out).ok, false);
});
test("asset change blocks", () => {
  const out = fixture(); out[4].sha256 = "b".repeat(64);
  assert.equal(compareInventories(fixture(), out).ok, false);
});
test("reordering blocks", () => {
  const out = fixture(); [out[1], out[3]] = [out[3], out[1]];
  assert.equal(compareInventories(fixture(), out).ok, false);
});
test("empty inventory blocks", () => assert.equal(validateInventory([]).ok, false));
test("missing checksum blocks", () => {
  const out = fixture(); delete out[4].sha256;
  assert.equal(validateInventory(out).ok, false);
});
