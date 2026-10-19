import test from "node:test";
import assert from "node:assert/strict";
import { inspectPastedHtml } from "./inspect-paste.mjs";

function element(tagName, attributes = {}, childNodes = []) {
  const attrs = Object.entries(attributes).map(([name, value]) => ({ name, value }));
  return {
    nodeType: 1, tagName: tagName.toUpperCase(), attributes: attrs, childNodes,
    getAttribute(name) { return attrs.find(item => item.name === name)?.value ?? null; }
  };
}
function parserForLink(html) {
  const href = /href="([^"]*)"/i.exec(html)?.[1] ?? "";
  const text = { nodeType: 3, textContent: "Link" };
  return { parseFromString() {
    return { head: { childNodes: [] }, body: { childNodes: [element("p", {}, [element("a", { href }, [text])])] } };
  }};
}
test("rejects obfuscated and unsupported URL schemes in pasted links", () => {
  for (const href of ["javascript:alert(1)", "java\nscript:alert(1)", "data:text/html,boom", "blob:https://example.com/id", "ftp://example.com/file", "//example.com/path"]) {
    const html = '<p><a href="' + href + '">Link</a></p>';
    const result = inspectPastedHtml(html, parserForLink(html));
    assert.equal(result.ok, false, href);
    assert.ok(result.errors.some(error => error.includes("unsafe URL")), result.errors.join("; "));
  }
});
test("allows ordinary relative, HTTPS, mailto and telephone links", () => {
  for (const href of ["/guide/page/", "../page/", "#section", "https://example.com/", "mailto:help@example.com", "tel:+123456789"]) {
    const html = '<p><a href="' + href + '">Link</a></p>';
    const result = inspectPastedHtml(html, parserForLink(html));
    assert.equal(result.ok, true, href + ": " + result.errors.join("; "));
  }
});
