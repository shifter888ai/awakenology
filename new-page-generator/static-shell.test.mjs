import test from "node:test";
import assert from "node:assert/strict";
import { renderStaticShell } from "./static-shell.mjs";

const fixture = () => ({
  language: "zh-Hant",
  title: '繁體中文 & "Article"',
  description: "Description <safe>",
  route: "/繁體中文/",
  alternates: { en: "/English-Article/", ja: "/日本語記事/", "zh-Hant": "/繁體中文/" },
  approvedHeader: '<header class="site-header"><div class="header-inner"><a class="brand" href="/">Awakenology</a><nav class="nav"><a href="/English/">English</a><a href="/Japanese/">日本語</a><a href="/Chinese/">中文</a><a href="/ai-search/">Search / Ask</a></nav></div></header>',
  approvedFooter: '<footer class="site-footer"><div class="footer-links"><a href="mailto:contact@awakenology.org">Contact</a><a href="/Disclaimer/">Disclaimer</a></div><span>© 2017 Awakenology</span></footer>',
  reviewedArticleHtml: "<p>Preserved article</p>",
  integrityApproved: true
});
test("renders complete static document with escaped metadata and language alternates", () => {
  const html = renderStaticShell(fixture());
  assert.match(html, /<html lang="zh-Hant" data-aw-theme="dark">/);
  assert.match(html, /繁體中文 &amp; &quot;Article&quot;/);
  assert.match(html, /Description &lt;safe&gt;/);
  assert.match(html, /hreflang="en"/);
  assert.match(html, /hreflang="ja"/);
  assert.match(html, /hreflang="zh-Hant"/);
  assert.match(html, /<article class="article"><p>Preserved article<\/p><\/article>/);
  assert.doesNotMatch(html, /<main><h1>/, "shell must not duplicate the article title");
  assert.match(html, /href="\/English\/">English/);
  assert.match(html, /href="\/Japanese\/">日本語/);
  assert.match(html, /href="\/Chinese\/">中文/);
  assert.match(html, /href="\/ai-search\/">Search \/ Ask/);
  assert.match(html, /mailto:contact@awakenology\.org/);
  assert.match(html, /href="\/Disclaimer\/">Disclaimer/);
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
  assert.match(html, /addEventListener\("pointerup"/, "mobile touch/pointer activation is explicitly handled");
  assert.match(html, /touch-action:manipulation/);
  assert.match(html, /class="review-banner"/);
});
test("generated shell requires a real header with brand and navigation", () => {
  const input = fixture(); input.approvedHeader = '<header class="site-header">Header only</header>';
  assert.throws(() => renderStaticShell(input), /brand and navigation/);
});
test("generated shell requires the complete footer links", () => {
  const input = fixture(); input.approvedFooter = '<footer class="site-footer">Copyright only</footer>';
  assert.throws(() => renderStaticShell(input), /Contact and Disclaimer/);
});
