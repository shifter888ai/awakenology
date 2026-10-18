import test from "node:test";
import assert from "node:assert/strict";
import { validateNormalizedBlocks } from "./normalized-source-model.mjs";

const block = overrides => ({
  id: "en-p1",
  language: "en",
  sourceMode: "docx",
  sourceLocation: { part: "word/document.xml", start: 10, end: 20 },
  type: "paragraph",
  orderedChildren: [],
  text: "Keep this exact text.",
  formatting: [],
  links: [],
  assets: [],
  issues: [],
  ...overrides
});

test("accepts a fully located loss-aware block", () => {
  assert.deepEqual(validateNormalizedBlocks([block()]), { ok: true, errors: [] });
});

test("rejects duplicate IDs, missing source location and invalid language", () => {
  const result = validateNormalizedBlocks([
    block({ language: "zh-CN", sourceLocation: null }),
    block({ id: "en-p1" })
  ]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /unsupported language/);
  assert.match(result.errors.join(" "), /sourceLocation is required/);
  assert.match(result.errors.join(" "), /duplicate id/);
});

test("requires exact text and explicit formatting/link/asset/issue arrays", () => {
  const result = validateNormalizedBlocks([block({ text: undefined, formatting: null, links: null, assets: null, issues: null })]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /exact text string/);
  assert.match(result.errors.join(" "), /must all be arrays/);
});

test("unresolved warning/error/blocking issues prevent approval", () => {
  for (const severity of ["warning", "error", "blocking"]) {
    const result = validateNormalizedBlocks([block({
      issues: [{ code: "unsupported-style", severity, message: "Style mapping uncertain", sourceLocation: { part: "word/document.xml", start: 11 } }]
    })]);
    assert.equal(result.ok, false, severity);
    assert.match(result.errors.join(" "), /unresolved/);
  }
});

test("resolved issues and informational notes are accepted", () => {
  const result = validateNormalizedBlocks([block({
    issues: [
      { code: "reviewed-style", severity: "warning", message: "Checked by reviewer", sourceLocation: { part: "word/document.xml" }, resolved: true },
      { code: "note", severity: "info", message: "Source contains a blank line", sourceLocation: { part: "word/document.xml" } }
    ]
  })]);
  assert.equal(result.ok, true, result.errors.join("; "));
});

test("checks child references and source offsets", () => {
  const result = validateNormalizedBlocks([
    block({ orderedChildren: ["missing-child"], sourceLocation: { part: "word/document.xml", start: 20, end: 10 } })
  ]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /sourceLocation.end/);
  assert.match(result.errors.join(" "), /does not exist/);
});
