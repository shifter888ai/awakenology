import { mkdir, writeFile } from "node:fs/promises";
import { renderStaticShell } from "./static-shell.mjs";

const header = '<header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="Awakenology home"><svg class="brand-symbol" viewBox="0 0 100 100" role="img" aria-label="Circled A" style="transform:rotate(5deg);transform-origin:center"><path d="M17 80 A44 44 0 1 1 26.7 87.3" fill="none" stroke="currentColor" stroke-width="7.5"/><path d="M27 87 L50 20 L72 77 L58 59 Q52 54 46 55" fill="none" stroke="currentColor" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Awakenology</span></a><nav class="nav" aria-label="Site navigation"><a href="/English/">English</a><a href="/Japanese/">日本語</a><a href="/Chinese/">中文</a><a href="/ai-search/">Search / Ask</a></nav></div></header>';
const footer = '<footer class="footer"><div class="footer-inner"><span class="footer-links"><a class="contact-icon" href="mailto:contact@awakenology.org" aria-label="Contact" title="Contact">✉</a><a class="reddit-icon" href="https://www.reddit.com/r/EscapeReincarnation/" aria-label="Reddit: Escape Reincarnation"><img src="/assets/reddit-one.svg" alt=""></a><a class="reddit-icon" href="https://www.reddit.com/r/EscapePrisonPlanet/" aria-label="Reddit: Escape Prison Planet"><img src="/assets/reddit-two.svg" alt=""></a><a class="reddit-icon" href="https://www.reddit.com/user/Lower-Lingonberry-40/" aria-label="Reddit profile"><img src="/assets/reddit-three.svg" alt=""></a><a class="disclaimer-icon" href="/Disclaimer/" aria-label="Disclaimer" title="Disclaimer">ⓘ</a></span><span>© 2017 Awakenology</span></div></footer>';
const article = '<aside class="preview-note" role="note"><strong>LAYOUT PREVIEW ONLY</strong><p>This page contains sample text to review the generated shell, responsive layout, theme toggle, and footer. It is not a converted article and is not approved for publication.</p></aside><h2>Sample section heading</h2><p>This is sample English text used to check reading width, line height, wrapping, and spacing on desktop and mobile screens.</p><p><strong>Bold text</strong>, <em>italic text</em>, <a href="/English/">an internal link</a>, and a long unbroken string for overflow testing: awaketest-awaketest-awaketest-awaketest-awaketest.</p><p>繁體中文、日本語、English — multilingual text should remain readable without horizontal scrolling.</p><ul><li>Short list item</li><li>A slightly longer list item for wrapping and spacing checks</li></ul><style>.preview-note{border:1px solid var(--line);padding:12px 14px;margin:0 0 28px;background:var(--soft);font-size:14px}.preview-note p{margin:.4em 0 0}.article h2{line-height:1.4;margin-top:1.8em}.article ul{padding-left:1.5em}</style>';
const html = renderStaticShell({
  language: "en",
  title: "New Page Generator — Layout Preview",
  description: "Non-publishing responsive layout preview for the Awakenology new page generator.",
  route: "/generator-layout-preview/",
  alternates: { en: "/generator-layout-preview/", ja: "/generator-layout-preview-ja/", "zh-Hant": "/generator-layout-preview-zh/" },
  approvedHeader: header,
  approvedFooter: footer,
  reviewedArticleHtml: article,
  integrityApproved: true
});
await mkdir("pilot-artifacts", { recursive: true });
await writeFile("pilot-artifacts/shell-layout-preview.html", html);
console.log("Wrote pilot-artifacts/shell-layout-preview.html (layout preview only; not article approval).");
