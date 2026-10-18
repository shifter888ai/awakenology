/**
 * Loss-aware content inventory gate. Adapters and renderers provide ordered
 * inventories; this module never silently normalizes, trims or rewrites text.
 * An exact structural comparison is intentionally stricter than character counts.
 */
const TYPES = new Set(["text", "element", "asset"]);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const plain = o => o !== null && typeof o === "object" && !Array.isArray(o);
const stable = value => {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (plain(value)) return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stable(value[k])).join(",") + "}";
  return JSON.stringify(value);
};

export function validateInventory(inventory) {
  const errors = [];
  if (!Array.isArray(inventory) || !inventory.length) return { ok: false, errors: ["Inventory must be a nonempty array."] };
  inventory.forEach((item, i) => {
    if (!plain(item) || !TYPES.has(item.type)) { errors.push(`[${i}] invalid item/type.`); return; }
    if (typeof item.path !== "string" || !item.path.startsWith("/")) errors.push(`[${i}] missing source path.`);
    if (item.type === "text" && (!own(item, "value") || typeof item.value !== "string")) errors.push(`[${i}] text value missing.`);
    if (item.type === "element" && (typeof item.tag !== "string" || !Array.isArray(item.attributes))) errors.push(`[${i}] element tag/attributes missing.`);
    if (item.type === "asset" && (typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(item.sha256))) errors.push(`[${i}] asset checksum missing.`);
  });
  if (!inventory.some(item => item?.type === "text")) errors.push("No text entries.");
  return { ok: !errors.length, errors };
}

export function compareInventories(source, output) {
  const errors = [];
  const a = validateInventory(source), b = validateInventory(output);
  errors.push(...a.errors.map(e => "source: " + e), ...b.errors.map(e => "output: " + e));
  if (errors.length) return { ok: false, errors };
  if (source.length !== output.length) errors.push(`Item count changed: ${source.length} → ${output.length}.`);
  for (let i = 0; i < Math.min(source.length, output.length); i++) {
    if (stable(source[i]) !== stable(output[i])) errors.push(`Item [${i}] changed at ${source[i].path} → ${output[i].path}.`);
  }
  return { ok: !errors.length, errors };
}
