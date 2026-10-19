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

test("generated shell defaults to dark mode and includes one accessible theme toggle", () => {
  const html = renderStaticShell(fixture());
  assert.match(html, /--bg:#0D0F12/);
  assert.match(html, /data-aw-theme="dark"/);
  assert.match(html, /class="theme-toggle"/);
  assert.match(html, /aria-label="Switch to light theme"/);
  assert.equal((html.match(/class="theme-toggle"/g) ?? []).length, 1);
});
test("generated shell includes responsive article styling and return-to-top control", () => {
  const html = renderStaticShell(fixture());
  assert.match(html, /@media\(max-width:640px\)/);
  assert.match(html, /\.article img\{max-width:100%;height:auto\}/);
  assert.match(html, /class="return-top"/);
  assert.match(html, /window\.scrollTo\(\{top:0,behavior:"smooth"\}\)/);
});
test("generated shell requires a real header so the theme toggle cannot disappear silently", () => {
  const input = fixture(); input.approvedHeader = "<div>not a header</div>";
  assert.throws(() => renderStaticShell(input), /header element/);
});
