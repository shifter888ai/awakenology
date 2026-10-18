const LANGUAGES = new Set(["en", "ja", "zh-Hant"]);
const SOURCE_MODES = new Set(["docx", "html-paste"]);
const BLOCK_TYPES = new Set(["document", "section", "paragraph", "heading", "list", "list-item", "table", "table-row", "table-cell", "text", "link", "asset", "line-break", "unknown"]);
const SEVERITIES = new Set(["info", "warning", "error", "blocking"]);
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

/**
 * Validate the shared, loss-aware normalized block model.
 * This module does not convert content or resolve issues; it only checks that
 * adapters report source locations and represent content/formatting explicitly.
 */
export function validateNormalizedBlocks(blocks, { requireResolved = true } = {}) {
  const errors = [];
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { ok: false, errors: ["Normalized blocks must be a nonempty array."] };
  }

  const ids = new Set();
  blocks.forEach((block, index) => {
    const at = `block[${index}]`;
    if (!isRecord(block)) {
      errors.push(`${at}: expected an object.`);
      return;
    }
    if (typeof block.id !== "string" || !block.id.trim()) errors.push(`${at}: stable id is required.`);
    else if (ids.has(block.id)) errors.push(`${at}: duplicate id ${block.id}.`);
    else ids.add(block.id);

    if (!LANGUAGES.has(block.language)) errors.push(`${at}: unsupported language.`);
    if (!SOURCE_MODES.has(block.sourceMode)) errors.push(`${at}: unsupported sourceMode.`);
    if (!BLOCK_TYPES.has(block.type)) errors.push(`${at}: unsupported block type.`);

    if (!isRecord(block.sourceLocation)) {
      errors.push(`${at}: sourceLocation is required.`);
    } else {
      if (typeof block.sourceLocation.part !== "string" || !block.sourceLocation.part) errors.push(`${at}: sourceLocation.part is required.`);
      if (block.sourceLocation.path !== undefined && typeof block.sourceLocation.path !== "string") errors.push(`${at}: sourceLocation.path must be a string.`);
      if (block.sourceLocation.start !== undefined && (!Number.isInteger(block.sourceLocation.start) || block.sourceLocation.start < 0)) errors.push(`${at}: sourceLocation.start must be a nonnegative integer.`);
      if (block.sourceLocation.end !== undefined && (!Number.isInteger(block.sourceLocation.end) || block.sourceLocation.end < (block.sourceLocation.start ?? 0))) errors.push(`${at}: sourceLocation.end must be an integer at or after start.`);
    }

    if (!Array.isArray(block.orderedChildren) || block.orderedChildren.some(id => typeof id !== "string")) errors.push(`${at}: orderedChildren must be an ordered array of block IDs.`);
    if (!hasOwn(block, "text") || typeof block.text !== "string") errors.push(`${at}: exact text string is required (use an empty string when not applicable).`);
    if (!Array.isArray(block.formatting) || !Array.isArray(block.links) || !Array.isArray(block.assets) || !Array.isArray(block.issues)) {
      errors.push(`${at}: formatting, links, assets, and issues must all be arrays.`);
    }

    for (const [field, entries] of [["formatting", block.formatting], ["links", block.links], ["assets", block.assets]]) {
      if (!Array.isArray(entries)) continue;
      entries.forEach((entry, entryIndex) => {
        if (!isRecord(entry)) errors.push(`${at}.${field}[${entryIndex}]: expected an object.`);
      });
    }
    if (Array.isArray(block.issues)) block.issues.forEach((issue, issueIndex) => {
      if (!isRecord(issue)) {
        errors.push(`${at}.issues[${issueIndex}]: expected an object.`);
        return;
      }
      if (typeof issue.code !== "string" || !issue.code) errors.push(`${at}.issues[${issueIndex}]: code is required.`);
      if (!SEVERITIES.has(issue.severity)) errors.push(`${at}.issues[${issueIndex}]: invalid severity.`);
      if (typeof issue.message !== "string" || !issue.message) errors.push(`${at}.issues[${issueIndex}]: message is required.`);
      if (!isRecord(issue.sourceLocation)) errors.push(`${at}.issues[${issueIndex}]: sourceLocation is required.`);
      if (requireResolved && ["warning", "error", "blocking"].includes(issue.severity) && issue.resolved !== true) {
        errors.push(`${at}.issues[${issueIndex}]: unresolved ${issue.severity} issue blocks generation.`);
      }
    });
  });

  const knownIds = new Set(blocks.filter(isRecord).map(block => block.id).filter(id => typeof id === "string"));
  blocks.forEach((block, index) => {
    if (!isRecord(block) || !Array.isArray(block.orderedChildren)) return;
    for (const childId of block.orderedChildren) {
      if (typeof childId === "string" && !knownIds.has(childId)) errors.push(`block[${index}]: child ID ${childId} does not exist.`);
    }
  });

  return { ok: errors.length === 0, errors };
}
