import test from "node:test";
import assert from "node:assert/strict";
import { publicHtmlMode } from "./public-html-mode.mjs";
for (const value of [undefined, null, "", "runtime"]) test("runtime default: " + String(value), () => assert.equal(publicHtmlMode(value), "runtime"));
for (const value of ["static", "STATIC", "preview", "1", false]) test("reject unapproved: " + String(value), () => assert.throws(() => publicHtmlMode(value), /Unapproved/));
