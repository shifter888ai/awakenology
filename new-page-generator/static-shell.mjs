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
  const themeToggleHandler = "var r=document.documentElement;var d=r.getAttribute('data-aw-theme')!=='light';r.setAttribute('data-aw-theme',d?'light':'dark');this.innerHTML=d?'☾':'☀';this.setAttribute('aria-label',d?'Switch to dark theme':'Switch to light theme');this.setAttribute('aria-pressed',String(!d))";
  const addThemeHandler = markup => markup.replace(/<button class="theme-toggle"([^>]*)>/, (tag, attrs) => {
    let updated = attrs;
    if (!updated.includes("onclick=")) updated += ' onclick="' + themeToggleHandler + '"';
    if (!updated.includes("ontouchstart=")) updated += ' ontouchstart="event.preventDefault();this.click()"';
    return '<button class="theme-toggle"' + updated + '>';
  });
  const headerMarkup = approvedHeader.includes('class="theme-toggle"')
    ? addThemeHandler(approvedHeader)
    : addThemeHandler(approvedHeader.replace(/<\/header>/i, '<button class="theme-toggle" type="button" aria-label="Switch to light theme" title="Switch theme"><span aria-hidden="true">☀</span></button></header>'));
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
.header-inner{max-width:900px;margin:0 auto;padding:22px 24px 18px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:inline-flex;align-items:center;gap:9px;color:var(--fg);font-family:Georgia,"Times New Roman",serif;font-size:25px;font-weight:700}.brand-symbol{display:block;width:29px;height:29px;flex:0 0 29px;color:currentColor}.header-controls{display:flex;align-items:center;gap:10px}.nav{display:flex;flex-wrap:wrap;gap:18px;font-size:14px}.nav a{padding-bottom:2px}.theme-toggle{position:fixed;top:16px;right:16px;z-index:2147483000;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:999px;background:var(--soft);color:var(--fg);width:44px;height:44px;cursor:pointer;touch-action:manipulation;pointer-events:auto;box-shadow:0 2px 12px #0003}.review-banner{border-top:1px solid var(--line);padding:7px 12px;text-align:center;font-size:11px;letter-spacing:.08em;color:var(--muted);background:var(--soft)}
main{max-width:900px;margin:0 auto;padding:24px 20px 48px}main h1{line-height:1.3;font-size:clamp(1.6rem,4vw,2.2rem)}.article{max-width:780px;margin:0 auto;line-height:1.8;overflow-wrap:anywhere}.article img{max-width:100%;height:auto}.article p{margin:1em 0}.article a{overflow-wrap:anywhere}
.footer{border-top:1px solid var(--line);color:var(--muted);font-size:13px;padding:24px}.footer-inner{max-width:760px;margin:0 auto;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;color:var(--muted);font-size:13px}.footer-links{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}.footer-links a{color:var(--muted)}.contact-icon,.disclaimer-icon{display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;font-size:20px;line-height:1}.reddit-icon{display:inline-flex;width:28px;height:28px;flex:0 0 28px;align-items:center;justify-content:center;overflow:visible}.reddit-icon svg{display:block;width:28px;height:28px;min-width:28px;min-height:28px;overflow:visible}.reddit-one svg{color:#ff4500}.reddit-one svg path{fill:#ff4500}.reddit-two svg{filter:brightness(0) saturate(100%) invert(39%) sepia(82%) saturate(1030%) hue-rotate(178deg) brightness(92%) contrast(94%)}.reddit-three svg{filter:brightness(0) saturate(100%) invert(32%) sepia(42%) saturate(1537%) hue-rotate(238deg) brightness(91%) contrast(92%)}html[data-aw-theme="dark"] .reddit-three svg{filter:brightness(0) saturate(100%) invert(76%) sepia(33%) saturate(1140%) hue-rotate(218deg) brightness(103%) contrast(94%)}
.return-top{position:fixed;z-index:2147483000;right:16px;bottom:16px;display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;border:1px solid var(--line);background:var(--soft);color:var(--fg);font-size:22px;cursor:pointer;touch-action:manipulation;pointer-events:auto;box-shadow:0 2px 10px #0005}.cn-variant-toggle{position:fixed!important;z-index:2147483000;left:16px;bottom:16px;display:inline-flex!important;visibility:visible!important;opacity:1!important;align-items:center;justify-content:center;min-width:72px;height:48px;padding:0 12px;border:1px solid var(--line);border-radius:999px;background:var(--soft);color:var(--fg);font-size:16px;font-weight:600;cursor:pointer;touch-action:manipulation;pointer-events:auto;box-shadow:0 2px 10px #0005}
@media(max-width:700px){.header-inner{display:block;padding:18px 18px 14px}.brand{margin-bottom:12px}.header-controls{align-items:flex-start;justify-content:space-between;gap:12px}.nav{gap:14px;padding-right:0}.theme-toggle{top:12px;right:12px;width:46px;height:46px;flex-basis:46px;flex-shrink:0}.header-controls{width:100%;padding-right:54px}main{padding:24px 18px 70px}.article{font-size:16px}.footer{padding:20px 14px}.return-top{right:12px;bottom:12px;width:48px;height:48px}.cn-variant-toggle{left:12px;bottom:12px;min-width:72px;height:48px}}
</style>
</head>
<body>
${headerMarkup}
<main><article class="article">${reviewedArticleHtml}</article></main>
${approvedFooter}
${language === "zh-Hant" ? '<button class="cn-variant-toggle" id="awakenology-cn-toggle" type="button" aria-label="Convert to Simplified Chinese" title="繁體中文／简体中文" onclick="if(window.awakenologyConvertChinese){window.awakenologyConvertChinese()}else{this.setAttribute('aria-label','Chinese conversion is still loading; please try again shortly')}" ontouchstart="event.preventDefault();this.click()">繁／简</button>' : ''}
<button class="return-top" type="button" aria-label="Return to top" title="Return to top" onclick="window.scrollTo({top:0,behavior:'smooth'})" ontouchstart="event.preventDefault();this.click()">↑</button>
<script>
(function(){
  var root=document.documentElement;
  root.setAttribute("data-aw-theme","dark");
  var toggle=document.querySelector(".theme-toggle");
  if(toggle){toggle.innerHTML='<span aria-hidden="true">☀</span>';toggle.setAttribute("aria-label","Switch to light theme");toggle.setAttribute("aria-pressed","false");if(!toggle.hasAttribute("onclick"))toggle.addEventListener("click",function(){var d=root.getAttribute("data-aw-theme")!=="light";root.setAttribute("data-aw-theme",d?"light":"dark");toggle.innerHTML=d?"☾":"☀";toggle.setAttribute("aria-label",d?"Switch to dark theme":"Switch to light theme");});}
  var topButton=document.querySelector(".return-top");
  if(topButton&&!topButton.hasAttribute("onclick"))topButton.addEventListener("click",function(){window.scrollTo({top:0,behavior:"smooth"});});
  var variantButton=document.getElementById("awakenology-cn-toggle");
  if(variantButton){
    import("https://cdn.jsdelivr.net/npm/opencc-js@1.4.1/dist/esm/full.js").then(function(module){
      var OpenCC=module.default||module;
      var toSimplified=OpenCC.Converter({from:"tw",to:"cn"});
      var toTraditional=OpenCC.Converter({from:"cn",to:"tw"});
      var original=[];
      var walker=document.createTreeWalker(document.querySelector("main")||document.body,NodeFilter.SHOW_TEXT);
      var node;
      while(node=walker.nextNode()){
        if(node.parentElement&&node.parentElement.closest("button,script,style"))continue;
        if(node.nodeValue&&node.nodeValue.trim())original.push({node:node,value:node.nodeValue});
      }
      var title=document.title,traditional=true;
      window.awakenologyConvertChinese=function(){
        traditional=!traditional;
        original.forEach(function(item){item.node.nodeValue=(traditional?toTraditional:toSimplified)(item.value);});
        document.title=(traditional?toTraditional:toSimplified)(title);
        document.documentElement.setAttribute("lang",traditional?"zh-Hant":"zh-CN");
        variantButton.textContent=traditional?"简":"繁";
        variantButton.setAttribute("aria-label",traditional?"Convert to Simplified Chinese":"Convert to Traditional Chinese");
      };
      var saved=null;try{saved=localStorage.getItem("awakenology-cn-variant");}catch(_){}
      if(saved==="cn")window.awakenologyConvertChinese();
      var originalConvert=window.awakenologyConvertChinese;
      window.awakenologyConvertChinese=function(){originalConvert();try{localStorage.setItem("awakenology-cn-variant",traditional?"tw":"cn");}catch(_){}};
    }).catch(function(error){variantButton.setAttribute("title","Chinese conversion library unavailable; reload when online");console.error("Awakenology Chinese toggle failed:",error);});
  }
})();
</script>
</body>
</html>`;
}
