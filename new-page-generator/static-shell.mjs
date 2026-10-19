/**
 * New-page static shell: metadata and structural wrapper only.
 * Deliberately requires a separately approved header/footer and reviewed article
 * HTML. Never accepts raw DOCX/paste output or performs publishing.
 */
const escapeText = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const LANGS = new Set(["en", "ja", "zh-Hant"]);
const HOST = "https://awakenology.space";
const routeOK = path => typeof path === "string" && /^\/[\p{L}\p{N}_().%\-\/]+\/$/u.test(path) && !path.includes("//") && !path.includes("..") && !/%(?:2f|5c|2e|00)/i.test(path);
const absolute = route => HOST + route.split("/").map(encodeURIComponent).join("/").replace(/%[0-9A-F]{2}/g, m => m.toUpperCase()).replace(/%25([0-9A-F]{2})/g, "%$1");

export function renderStaticShell({ language, title, description, route, alternates, approvedHeader, approvedFooter, reviewedArticleHtml, integrityApproved }) {
  if (!LANGS.has(language) || !title?.trim() || !description?.trim() || !routeOK(route)) throw Error("Missing or invalid page metadata.");
  if (!integrityApproved) throw Error("Source-to-output content integrity approval is required.");
  if (!approvedHeader?.trim() || !approvedFooter?.trim() || !reviewedArticleHtml?.trim()) throw Error("Approved shell components and reviewed content are required.");
  if (!alternates || !["en","ja","zh-Hant"].every(lang => routeOK(alternates[lang]))) throw Error("Complete alternate-language routes required.");
  const canonical = absolute(route);
  const headerMarkup = approvedHeader.includes('class="theme-toggle"') ? approvedHeader : approvedHeader.replace(/<\/header>/i, '<button class="theme-toggle" type="button" aria-label="Switch to light theme" title="Switch theme"><span aria-hidden="true">☀</span></button></header>');
  if (!/<header\b/i.test(headerMarkup)) throw Error("Approved header must contain a header element.");
  const hreflang = ["en","ja","zh-Hant"].map(lang => `<link rel="alternate" hreflang="${lang}" href="${escapeText(absolute(alternates[lang]))}">`).join("\n");
  return `<!doctype html>
<html lang="${language}" data-aw-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeText(title)} | Awakenology</title>
<meta name="description" content="${escapeText(description)}">
<link rel="canonical" href="${escapeText(canonical)}">
${hreflang}
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeText(title)}">
<meta property="og:description" content="${escapeText(description)}">
<meta property="og:url" content="${escapeText(canonical)}">
<style>
:root{color-scheme:dark;--bg:#0D0F12;--fg:#fff;--muted:#b8b8c3;--line:#34343b;--link:#818cf8;--soft:#171920}
html[data-aw-theme="light"]{color-scheme:light;--bg:#fff;--fg:#0D0F12;--muted:#626270;--line:#e5e5e5;--link:#6366c9;--soft:#f7f7fa}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;line-height:1.7;overflow-wrap:anywhere}
a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}.site-header{border-bottom:1px solid var(--line);position:relative}.site-header:after{content:"";display:block;height:2px;background:linear-gradient(90deg,transparent,var(--link),transparent);opacity:.8}
.header-inner{max-width:900px;margin:0 auto;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{color:var(--fg)}.nav{display:flex;flex-wrap:wrap;gap:14px;font-size:14px}.theme-toggle{position:absolute;right:max(12px,calc((100vw - 900px)/2));top:10px;border:1px solid var(--line);border-radius:999px;background:var(--soft);color:var(--fg);width:38px;height:38px;cursor:pointer}
main{max-width:900px;margin:0 auto;padding:24px 20px 48px}main h1{line-height:1.3;font-size:clamp(1.6rem,4vw,2.2rem)}.article{max-width:780px;margin:0 auto;line-height:1.8;overflow-wrap:anywhere}.article img{max-width:100%;height:auto}.article p{margin:1em 0}.article a{overflow-wrap:anywhere}
.footer{border-top:1px solid var(--line);color:var(--muted);font-size:14px}.footer-inner{max-width:900px;margin:0 auto;padding:20px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.footer-links{display:flex;align-items:center;gap:12px}.footer-links img{width:20px;height:20px}.contact-icon,.disclaimer-icon,.reddit-icon{display:inline-flex;align-items:center;justify-content:center;min-width:24px;min-height:24px}.contact-icon,.disclaimer-icon{font-size:20px}
.return-top{position:fixed;right:14px;bottom:14px;width:42px;height:42px;border-radius:50%;border:1px solid var(--line);background:var(--soft);color:var(--fg);font-size:22px;cursor:pointer;box-shadow:0 2px 10px #0002}
@media(max-width:640px){.header-inner{padding:14px 14px;align-items:flex-start;flex-direction:column;gap:8px}.nav{gap:10px 14px;padding-right:44px}.theme-toggle{right:12px;top:10px}main{padding:20px 14px 36px}.article{font-size:16px}.footer-inner{padding:16px 14px;align-items:flex-start;flex-direction:column}.return-top{right:10px;bottom:10px}}
</style>
</head>
<body>
${headerMarkup}
<main><h1>${escapeText(title)}</h1><article class="article">${reviewedArticleHtml}</article></main>
${approvedFooter}
<button class="return-top" type="button" aria-label="Return to top" title="Return to top">↑</button>
<script>
(function(){
  var root=document.documentElement;
  root.setAttribute("data-aw-theme","dark");
  var toggle=document.querySelector(".theme-toggle");
  function sync(){if(toggle){var dark=root.getAttribute("data-aw-theme")!=="light";toggle.innerHTML=dark?'<span aria-hidden="true">☀</span>':'<span aria-hidden="true">☾</span>';toggle.setAttribute("aria-label",dark?"Switch to light theme":"Switch to dark theme");}}
  if(toggle){toggle.addEventListener("click",function(){root.setAttribute("data-aw-theme",root.getAttribute("data-aw-theme")==="light"?"dark":"light");sync();});sync();}
  var top=document.querySelector(".return-top");if(top)top.addEventListener("click",function(){window.scrollTo({top:0,behavior:"smooth"});});
})();
</script>
</body>
</html>`;
}
