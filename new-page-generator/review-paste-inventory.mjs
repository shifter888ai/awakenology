/**
 * Additional review gate for HTML paste inventories. This does not sanitize HTML.
 * Restricts attributes by element and rejects CSS or URL forms that need review.
 */
const attrs = {
  A: ["href", "title"], IMG: ["src", "alt", "title"],
  TH: ["colspan", "rowspan", "style"], TD: ["colspan", "rowspan", "style"],
  SPAN: ["style"], P: ["style"], DIV: ["style"],
  H1: ["style"], H2: ["style"], H3: ["style"],
  H4: ["style"], H5: ["style"], H6: ["style"]
};
const styles = {
  color: /^(?:#[a-f0-9]{3}|#[a-f0-9]{6}|red|blue|black|white)$/i,
  "font-weight": /^(?:bold|normal|[1-9]00)$/i,
  "font-style": /^(?:italic|normal)$/i,
  "text-decoration": /^(?:underline|line-through|none)$/i,
  "text-align": /^(?:left|right|center|justify)$/i
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
      if (key === "href" && !(/^(?:https?:\/\/[^\s/]+|mailto:[^\s@]+@[^\s@]+|\/(?!\/)[^\s]*|#[A-Za-z][\w-]*)$/i.test(value)) ) errors.push(`${item.path}: unapproved link URL.`);
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
