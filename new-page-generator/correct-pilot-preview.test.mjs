import test from "node:test";
import assert from "node:assert/strict";
import {correctPilotPreview} from "./correct-pilot-preview.mjs";

test("left-aligns only the two owner-identified headings", () => {
  const html = '<p style="margin-left:24pt;text-indent:12pt">1）界是什麼？</p><p style="margin-left:18pt">2）其他標題</p><p>3）界與界的關係？</p>';
  const out = correctPilotPreview(html);
  assert.match(out, /1）界是什麼？/);
  assert.match(out, /margin-left:0;padding-left:0;text-indent:0;text-align:left/);
  assert.match(out, /2）其他標題/);
  assert.match(out, /margin-left:18pt/);
  assert.match(out, /3）界與界的關係？/);
  assert.equal((out.match(/text-align:left/g) || []).length, 2);
});

test("brightens dark neutral hex text but preserves coloured emphasis", () => {
  const out = correctPilotPreview('<span style="color:#111111">English</span><span style="color:#ff0000">Red emphasis</span><span style="color:#0000ff">Blue emphasis</span>');
  assert.match(out, /color:var\(--fg\)/);
  assert.match(out, /color:#ff0000/);
  assert.match(out, /color:#0000ff/);
});

test("leaves unrelated HTML unchanged", () => {
  const html = '<p style="color:#eeeeee">Already bright</p><p>ordinary paragraph</p>';
  assert.equal(correctPilotPreview(html), html);
});

test("does not alter background-color while correcting text colour", () => {
  const html = '<p style="background-color:#111111;color:#111111">English</p>';
  const out = correctPilotPreview(html);
  assert.match(out, /background-color:#111111/);
  assert.match(out, /color:var\(--fg\)/);
});
