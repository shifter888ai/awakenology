import test from "node:test";
import assert from "node:assert/strict";
import { renderStaticShell } from "./static-shell.mjs";

const fixture = () => ({
  language: "zh-Hant",
  title: '繁體中文 & "Article"',
  description: "Description <safe>",
  route: "/繁體中文/",
  alternates: { en: "/English-Article/", ja: "/日本語記事/", "zh-Hant": "/繁體中文/" },
  approvedHeader: '<header class="site-header">Reviewed header</header>',
  approvedFooter: '<footer class="site-footer">© 2017 Awakenology</footer>',
  reviewedArticleHtml: "<p>Preserved article</p>",
  integrityApproved: true
});
test("renders complete static document with escaped metadata and language alternates", () => {
  const html = renderStaticShell(fixture());
  assert.match(html, /<html lang="zh-Hant">/);
  assert.match(html, /繁體中文 &amp; &quot;Article&quot;/);
  assert.match(html, /Description &lt;safe&gt;/);
  assert.match(html, /hreflang="en"/);
  assert.match(html, /hreflang="ja"/);
  assert.match(html, /hreflang="zh-Hant"/);
  assert.match(html, /<article class="article"><p>Preserved article<\/p><\/article>/);
});
test("blocks missing integrity approval", () => {
  const input = fixture(); input.integrityApproved = false;
  assert.throws(() => renderStaticShell(input), /integrity approval/);
});
test("blocks incomplete translations", () => {
  const input = fixture(); delete input.alternates.ja;
  assert.throws(() => renderStaticShell(input), /alternate-language/);
});
test("blocks unsafe routes", () => {
  const input = fixture(); input.route = "/../private/";
  assert.throws(() => renderStaticShell(input), /metadata/);
});
test("blocks missing reviewed shell component", () => {
  const input = fixture(); input.approvedFooter = "";
  assert.throws(() => renderStaticShell(input), /Approved shell components/);
});
