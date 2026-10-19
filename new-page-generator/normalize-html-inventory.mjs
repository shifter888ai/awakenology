import { validateNormalizedBlocks } from "./normalized-source-model.mjs";

const TAG_TYPE = new Map([
  ["H1","heading"],["H2","heading"],["H3","heading"],["H4","heading"],["H5","heading"],["H6","heading"],
  ["UL","list"],["OL","list"],["LI","list-item"],["TABLE","table"],["TR","table-row"],
  ["TD","table-cell"],["TH","table-cell"],["BR","line-break"],["IMG","asset"],["A","link"]
]);
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Map an already-inspected HTML inventory into the shared block shape.
 * Paths are adapter-generated locations in the parsed HTML tree, not offsets
 * into the original DOCX package. This bridge does not claim DOCX fidelity.
 */
export function normalizeHtmlInventory(inventory, { language, sourceMode, sourcePart } = {}) {
  if (!Array.isArray(inventory) || !inventory.length) {
    return { ok: false, errors: ["Cannot normalize an empty HTML inventory."], blocks: [] };
  }
  if (!["en","ja","zh-Hant"].includes(language)) {
    return { ok: false, errors: ["A supported language is required."], blocks: [] };
  }
  if (!["docx","html","html-paste","markdown"].includes(sourceMode)) {
    return { ok: false, errors: ["sourceMode must be docx or html-paste."], blocks: [] };
  }
  if (typeof sourcePart !== "string" || !sourcePart.trim()) {
    return { ok: false, errors: ["sourcePart is required to locate the inspected HTML."], blocks: [] };
  }

  const records = inventory.map((item, index) => {
    if (!isRecord(item) || typeof item.path !== "string" || !item.path.startsWith("/")) {
      return { error: `inventory[${index}] needs a valid path.` };
    }
    if (item.type === "text" && typeof item.value === "string") {
      return { id: `n${index}`, path: item.path, type: "text", tag: null, text: item.value, attributes: [], index };
    }
    if (item.type === "element" && typeof item.tag === "string" && Array.isArray(item.attributes)) {
      const attributes = item.attributes.filter(pair => Array.isArray(pair) && pair.length === 2 && pair.every(v => typeof v === "string"));
      if (attributes.length !== item.attributes.length) return { error: `inventory[${index}] has malformed attributes.` };
      const tag = item.tag.toUpperCase();
      return { id: `n${index}`, path: item.path, type: "element", tag, text: "", attributes, index };
    }
    return { error: `inventory[${index}] has unsupported item shape.` };
  });
  const errors = records.filter(item => item.error).map(item => item.error);
  if (errors.length) return { ok: false, errors, blocks: [] };

  const pathToId = new Map(records.map(record => [record.path, record.id]));
  const blocks = records.map(record => {
    const attributes = Object.fromEntries(record.attributes);
    const formatting = [];
    if (attributes.style) formatting.push({ source: "style", value: attributes.style });
    if (record.tag === "STRONG" || record.tag === "B") formatting.push({ kind: "bold", value: true });
    if (record.tag === "EM" || record.tag === "I") formatting.push({ kind: "italic", value: true });
    if (record.tag === "U") formatting.push({ kind: "underline", value: true });
    if (record.tag === "S") formatting.push({ kind: "strikethrough", value: true });
    const links = record.tag === "A" ? [{ href: attributes.href ?? "", title: attributes.title ?? "" }] : [];
    const assets = record.tag === "IMG" ? [{ src: attributes.src ?? "", alt: attributes.alt ?? "" }] : [];
    const orderedChildren = records
      .filter(candidate => candidate.path.startsWith(record.path + "/") &&
        candidate.path.slice(record.path.length + 1).split("/").length === 1)
      .sort((a,b) => Number(a.path.slice(a.path.lastIndexOf("/") + 1)) - Number(b.path.slice(b.path.lastIndexOf("/") + 1)))
      .map(candidate => candidate.id);
    return {
      id: record.id, language, sourceMode,
      sourceLocation: { part: sourcePart, path: record.path },
      type: record.type === "text" ? "text" : (TAG_TYPE.get(record.tag) ?? "paragraph"),
      orderedChildren, text: record.text, formatting, links, assets, issues: []
    };
  });

  const validation = validateNormalizedBlocks(blocks);
  return { ok: validation.ok, errors: validation.errors, blocks: validation.ok ? blocks : [] };
}
