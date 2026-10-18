import { LANGUAGES, validatePageSet } from "./validate-page-set.mjs";
import { inspectPastedHtml } from "./inspect-paste.mjs";
import { validateInventory, compareInventories } from "./content-inventory.mjs";

/**
 * Connects the existing validators without inventing a DOCX converter.
 * `inputs` maps language to { html, parser } for paste, or
 * { inventory, issues } from a future reviewed DOCX extractor.
 * The returned result is a review artifact, never publishable HTML.
 */
export function inspectPageSet(pageSet, inputs = {}) {
  const contract = validatePageSet(pageSet);
  const errors = [...contract.errors];
  const pages = {};
  if (!contract.ok) return { ok: false, errors, pages };
  for (const lang of LANGUAGES) {
    const meta = pageSet.pages[lang];
    const input = inputs[lang];
    if (!input || typeof input !== "object") {
      errors.push(`${lang}: input payload missing.`);
      continue;
    }
    let inspected;
    if (meta.mode === "paste") {
      inspected = inspectPastedHtml(input.html, input.parser);
    } else {
      // Until the DOCX extractor exists, do not accept arbitrary inventories as
      // evidence of successful Word conversion.
      inspected = { ok: false, errors: ["DOCX extraction not implemented; input blocked."], inventory: [] };
    }
    const pageErrors = [...inspected.errors];
    if (inspected.ok) pageErrors.push(...validateInventory(inspected.inventory).errors);
    pages[lang] = { mode: meta.mode, inventory: inspected.inventory, errors: pageErrors };
    errors.push(...pageErrors.map(e => `${lang}: ${e}`));
  }
  return { ok: errors.length === 0, errors, pages };
}

/** Gate a reviewed output inventory against an inspected input page. */
export function verifyRenderedInventory(inspectedPage, outputInventory) {
  if (!inspectedPage || inspectedPage.errors?.length || !Array.isArray(inspectedPage.inventory)) {
    return { ok: false, errors: ["Source inspection has not passed."] };
  }
  return compareInventories(inspectedPage.inventory, outputInventory);
}
