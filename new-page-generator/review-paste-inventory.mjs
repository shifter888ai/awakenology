/**
 * Additional review gate for inspected HTML inventories. This does not sanitize HTML.
 * Restricts attributes by element and rejects CSS or URL forms that need review.
 */
const WORD_RUN_ATTRS = [
  "data-word-lang-val","data-word-lang-east-asia","data-word-lang-bidi",
  "data-word-font-ascii","data-word-font-hansi","data-word-font-east-asia","data-word-font-cs",
  "data-word-font-hint","data-word-bold-cs","data-word-italic-cs","data-word-font-size-cs"
];
const WORD_PARAGRAPH_ATTRS = [
  "data-word-mark-font-ascii","data-word-mark-font-hansi","data-word-mark-font-east-asia","data-word-mark-font-cs",
  "data-word-mark-lang-val","data-word-mark-lang-east-asia","data-word-mark-lang-bidi",
  "data-word-num-id","data-word-abstract-num-id","data-word-level","data-word-num-format",
  "data-word-num-text","data-word-num-start","data-word-indent-left","data-word-indent-right",
  "data-word-indent-first-line","data-word-indent-hanging"
];
const attrs = {
  A: ["href", "title", "style", "lang"],
  IMG: ["src", "alt", "title", "style"],
  TH: ["colspan", "rowspan", "style"], TD: ["colspan", "rowspan", "style"],
  SPAN: ["style", "lang", ...WORD_RUN_ATTRS],
  P: ["style", ...WORD_PARAGRAPH_ATTRS],
  LI: ["style", ...WORD_PARAGRAPH_ATTRS],
  OL: ["start", "type", "style"], UL: ["style"],
  DIV: ["style"], BLOCKQUOTE: ["style"],
  H1: ["style", ...WORD_PARAGRAPH_ATTRS], H2: ["style", ...WORD_PARAGRAPH_ATTRS],
  H3: ["style", ...WORD_PARAGRAPH_ATTRS], H4: ["style", ...WORD_PARAGRAPH_ATTRS],
  H5: ["style", ...WORD_PARAGRAPH_ATTRS], H6: ["style", ...WORD_PARAGRAPH_ATTRS]
};
const styles = {
  color: /^(?:#[a-f0-9]{3}|#[a-f0-9]{6}|red|blue|black|white)$/i,
  "font-weight": /^(?:bold|normal|[1-9]00)$/i,
  "font-style": /^(?:italic|normal)$/i,
  "text-decoration": /^(?:underline|line-through|none)$/i,
  "text-align": /^(?:left|right|center|justify|start|end)$/i,
  "font-size": /^\d+(?:\.\d+)?(?:pt|px)$/i,
  "margin-left": /^-?\d+(?:\.\d+)?(?:pt|px)$/i,
  "margin-right": /^-?\d+(?:\.\d+)?(?:pt|px)$/i,
  "margin-top": /^-?\d+(?:\.\d+)?(?:pt|px)$/i,
  "margin-bottom": /^-?\d+(?:\.\d+)?(?:pt|px)$/i,
  "text-indent": /^-?\d+(?:\.\d+)?(?:pt|px)$/i,
  "line-height": /^(?:\d+(?:\.\d+)?(?:pt|px)|\d+(?:\.\d+)?)$/i,
  "letter-spacing": /^-?\d+(?:\.\d+)?(?:pt|px)$/i,
  "font-kerning": /^(?:normal|none|auto)$/i,
  "text-transform": /^(?:uppercase|none)$/i,
  "list-style-type": /^(?:none|disc|circle|square|decimal|decimal-leading-zero|lower-roman|upper-roman|lower-alpha|upper-alpha)$/i,
  "font-family": /^(?:"(?:[^"\\]|\\.)+"|[A-Za-z0-9 _-]+)$/i
};
export function reviewPasteInventory(inventory) {
  const errors = [];
  if (!Array.isArray(inventory)) return { ok: false, errors: ["Inventory required."] };
  for (const item of inventory) {
    if (item.type !== "element") continue;
    const allowed = attrs[item.tag] || [];
    for (const [name, raw] of item.attributes || []) {
      const key = name.toLowerCase(), value = raw.trim();
      if (!allowed.includes(key)) { errors.push(`${item.path}: ${key} not approved on ${item.tag}.`); continue; }
      if (key === "href" && !(/^(?:https?:\/\/[^\s\/@?#]+(?:[\/?#][^\s]*)?|mailto:[^\s@]+@[^\s@]+|tel:\+?[0-9().-]+|\/(?!\/)[^\s]*|#[A-Za-z][\w-]*)$/i.test(value)) ) errors.push(`${item.path}: unapproved link URL.`);
      if (key === "start" && !/^[1-9][0-9]*$/.test(value)) errors.push(`${item.path}: invalid ordered-list start.`);
      if (key === "type" && !/^(?:1|a|A|i|I)$/.test(value)) errors.push(`${item.path}: invalid ordered-list marker type.`);
      if (key === "src" && (!/^\/(?!\/)[^\s?#]+(?:\?[^\s#]*)?$/.test(value) || value.includes(".."))) errors.push(`${item.path}: image must use a reviewed local asset path.`);
      if (key === "style") for (const declaration of value.split(";").filter(Boolean)) {
        const colon = declaration.indexOf(":");
        const prop = declaration.slice(0, colon).trim().toLowerCase(), val = declaration.slice(colon + 1).trim();
        if (colon < 0 || !styles[prop]?.test(val)) errors.push(`${item.path}: unapproved CSS declaration.`);
      }
      if ((key === "colspan" || key === "rowspan") && !/^[1-9][0-9]?$/.test(value)) errors.push(`${item.path}: invalid table span.`);
    }
  }
  return { ok: !errors.length, errors };
}
