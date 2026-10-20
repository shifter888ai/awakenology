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
  if (/class="site-header"/.test(headerMarkup)) {
    if (!/<nav\b/i.test(headerMarkup) || !/class="brand"/.test(headerMarkup)) throw Error("Complete site header must include the brand and navigation.");
    if (!/class="theme-toggle"/.test(headerMarkup) || (headerMarkup.match(/class="theme-toggle"/g) ?? []).length !== 1) throw Error("Complete site header must include exactly one theme toggle.");
  }
  if (!/<footer\b/i.test(approvedFooter)) throw Error("A footer element is required.");
  if (/class="site-footer"/.test(approvedFooter) && (!/contact@awakenology\.org/.test(approvedFooter) || !/Disclaimer/.test(approvedFooter))) throw Error("Complete site footer must include Contact and Disclaimer links.");
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
.header-inner{max-width:900px;margin:0 auto;padding:22px 24px 18px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:inline-flex;align-items:center;gap:9px;color:var(--fg);font-family:Georgia,"Times New Roman",serif;font-size:25px;font-weight:700}.brand-symbol{display:block;width:29px;height:29px;flex:0 0 29px;color:currentColor}.header-controls{display:flex;align-items:center;gap:10px}.nav{display:flex;flex-wrap:wrap;gap:18px;font-size:14px}.nav a{padding-bottom:2px}.theme-toggle{border:1px solid var(--line);border-radius:999px;background:var(--soft);color:var(--fg);width:38px;height:38px;flex:0 0 38px;cursor:pointer;touch-action:manipulation}.review-banner{border-top:1px solid var(--line);padding:7px 12px;text-align:center;font-size:11px;letter-spacing:.08em;color:var(--muted);background:var(--soft)}
main{max-width:900px;margin:0 auto;padding:24px 20px 48px}main h1{line-height:1.3;font-size:clamp(1.6rem,4vw,2.2rem)}.article{max-width:780px;margin:0 auto;line-height:1.8;overflow-wrap:anywhere}.article img{max-width:100%;height:auto}.article p{margin:1em 0}.article a{overflow-wrap:anywhere}
.footer{border-top:1px solid var(--line);color:var(--muted);font-size:13px;padding:24px}.footer-inner{max-width:760px;margin:0 auto;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;color:var(--muted);font-size:13px}.footer-links{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}.footer-links a{color:var(--muted)}.contact-icon,.disclaimer-icon{display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;font-size:20px;line-height:1}.reddit-icon{display:inline-flex;align-items:center;justify-content:center;min-height:24px;font-size:12px}
.return-top{position:fixed;z-index:20;right:14px;bottom:14px;width:44px;height:44px;border-radius:50%;border:1px solid var(--line);background:var(--soft);color:var(--fg);font-size:22px;cursor:pointer;touch-action:manipulation;box-shadow:0 2px 10px #0002}
@media(max-width:700px){.header-inner{display:block;padding:18px 18px 14px}.brand{margin-bottom:12px}.header-controls{align-items:flex-start;justify-content:space-between;gap:12px}.nav{gap:14px;padding-right:0}.theme-toggle{width:44px;height:44px;flex-basis:44px;flex-shrink:0}.header-controls{width:100%}main{padding:24px 18px 55px}.article{font-size:16px}.footer{padding:20px 14px}.return-top{right:10px;bottom:10px}}
</style>
</head>
<body>
${headerMarkup}
<main><article class="article">${reviewedArticleHtml}</article></main>
${approvedFooter}
<button class="return-top" type="button" aria-label="Return to top" title="Return to top">↑</button>
<script>
(function(){
  var root=document.documentElement;
  root.setAttribute("data-aw-theme","dark");
  var toggle=document.querySelector(".theme-toggle");
  function sync(){if(toggle){var dark=root.getAttribute("data-aw-theme")!=="light";toggle.innerHTML=dark?'<span aria-hidden="true">☀</span>':'<span aria-hidden="true">☾</span>';toggle.setAttribute("aria-label",dark?"Switch to light theme":"Switch to dark theme");toggle.setAttribute("aria-pressed",String(!dark));}}
  function bindActivation(button,action){
    if(!button)return;
    var pointerHandled=false;
    button.addEventListener("pointerup",function(event){if(event.pointerType==="touch"||event.pointerType==="pen"||event.pointerType==="mouse"){pointerHandled=true;action();}});
    button.addEventListener("click",function(event){if(event.detail===0){action();}else if(pointerHandled){pointerHandled=false;}});
  }
  bindActivation(toggle,function(){root.setAttribute("data-aw-theme",root.getAttribute("data-aw-theme")==="light"?"dark":"light");sync();});
  sync();
  var top=document.querySelector(".return-top");
  bindActivation(top,function(){window.scrollTo({top:0,behavior:"smooth"});});
})();
</script>
</body>
</html>`;
}
