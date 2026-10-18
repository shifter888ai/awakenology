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
  const hreflang = ["en","ja","zh-Hant"].map(lang => `<link rel="alternate" hreflang="${lang}" href="${escapeText(absolute(alternates[lang]))}">`).join("\n");
  return `<!doctype html>
<html lang="${language}">
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
</head>
<body>
${approvedHeader}
<main><h1>${escapeText(title)}</h1><article class="article">${reviewedArticleHtml}</article></main>
${approvedFooter}
</body>
</html>`;
}
