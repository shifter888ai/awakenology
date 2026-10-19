/**
 * Strict browser-side HTML paste adapter. This is an extraction stage, NOT a sanitizer
 * or publisher. Fail closed on elements/attributes we have not explicitly reviewed.
 * DOMParser is available in browsers; no runtime dependency is added to the site.
 */
const BLOCKS = new Set(["P","H1","H2","H3","H4","H5","H6","UL","OL","LI","BLOCKQUOTE","PRE","TABLE","THEAD","TBODY","TR","TH","TD","FIGURE","FIGCAPTION"]);
const INLINE = new Set(["STRONG","B","EM","I","U","S","SPAN","A","BR","SUP","SUB","CODE","IMG"]);
const CONTAINERS = new Set(["DIV","SECTION","ARTICLE"]);
const ALLOWED = new Set([...BLOCKS, ...INLINE, ...CONTAINERS]);
const SAFE_STYLES = new Set(["color","font-weight","font-style","text-decoration","text-align"]);
const SAFE_ATTRS = new Set(["href","src","alt","title","colspan","rowspan","style"]);
function unsafeUrl(value, attribute) {
  const compact = value.replace(/[\u0000-\u0020\u007f]/g, "");
  if (!compact || compact.startsWith("//")) return true;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]?.toLowerCase();
  if (!scheme) return false;
  const allowed = attribute === "href" ? ["http", "https", "mailto", "tel"] : ["http", "https"];
  return !allowed.includes(scheme);
}

export function inspectPastedHtml(html, parser = globalThis.DOMParser && new DOMParser()) {
  const errors = [];
  if (typeof html !== "string" || !html.trim()) return { ok: false, errors: ["Empty HTML paste."], inventory: [] };
  if (!parser) return { ok: false, errors: ["DOMParser unavailable; use a browser context."], inventory: [] };
  for (const match of html.matchAll(/<\/?\s*([a-z][\w-]*)\b[^>]*>/gi)) {
    const tag = match[1].toUpperCase();
    if (!ALLOWED.has(tag)) errors.push(`Raw HTML contains unsupported element <${tag.toLowerCase()}>.`);
  }
  const doc = parser.parseFromString(html, "text/html");
  const inventory = [];
  const inspectHead = node => {
    if (node?.nodeType === 1) {
      const tag = node.tagName.toUpperCase();
      if (tag === "STYLE") errors.push("Embedded CSS in the HTML head requires review.");
      if (tag === "LINK" && /stylesheet/i.test(node.getAttribute?.("rel") ?? "")) errors.push("External stylesheet in the HTML head requires review.");
      for (const child of node.childNodes ?? []) inspectHead(child);
    }
  };
  for (const child of doc.head?.childNodes ?? []) inspectHead(child);
  const visit = (node, path) => {
    if (node.nodeType === 8) { errors.push(`${path}: HTML comment requires review.`); return; }
    if (node.nodeType === 3) {
      inventory.push({ type: "text", path, value: node.textContent });
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (!ALLOWED.has(tag)) errors.push(`${path}: unsupported element <${tag.toLowerCase()}>.`);
    for (const attr of node.attributes) {
      const key = attr.name.toLowerCase();
      if (!SAFE_ATTRS.has(key)) errors.push(`${path}: unsupported attribute ${key}.`);
      if ((key === "href" || key === "src") && unsafeUrl(attr.value, key)) errors.push(path + ": unsafe URL.");
      if (key === "style") {
        for (const declaration of attr.value.split(";").filter(Boolean)) {
          const separator = declaration.indexOf(":");
          const property = separator < 0 ? "" : declaration.slice(0, separator).trim().toLowerCase();
          const value = separator < 0 ? "" : declaration.slice(separator + 1).trim();
          if (!SAFE_STYLES.has(property) || !value || /url\s*\(|expression\s*\(|@import|[<>]/i.test(value)) errors.push(`${path}: unreviewed style declaration.`);
        }
      }
    }
    if (tag === "IMG" && (!node.getAttribute("src") || !node.getAttribute("alt"))) errors.push(`${path}: image needs src and alt review.`);
    if (tag === "A" && !node.getAttribute("href")) errors.push(`${path}: link missing href.`);
    inventory.push({ type: "element", path, tag, attributes: [...node.attributes].map(a => [a.name, a.value]) });
    [...node.childNodes].forEach((child, index) => visit(child, `${path}/${index}`));
  };
  [...doc.body.childNodes].forEach((node, index) => visit(node, `/${index}`));
  if (!inventory.some(item => item.type === "text" && item.value.trim())) errors.push("No text content found; manual review required.");
  return { ok: errors.length === 0, errors, inventory };
}
