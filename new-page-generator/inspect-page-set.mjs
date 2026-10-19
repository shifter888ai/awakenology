import { reviewPasteInventory } from "./review-paste-inventory.mjs";
import { extractDocx, FLOATING_DRAWING_REVIEW_ERROR } from "./extract-docx.mjs";
import { inspectDocxRichContent } from "./inspect-docx-rich-content.mjs";
import { LANGUAGES, validatePageSet } from "./validate-page-set.mjs";
import { inspectPastedHtml } from "./inspect-paste.mjs";
import { validateInventory, compareInventories } from "./content-inventory.mjs";
import { normalizeHtmlInventory } from "./normalize-html-inventory.mjs";
import { markdownToHtml } from "./markdown-to-html.mjs";

export function isFloatingDrawingReviewOnly(extracted) {
  return Boolean(extracted && extracted.ok===false && typeof extracted.previewHtml==="string" &&
    Array.isArray(extracted.errors) && extracted.errors.length===1 &&
    extracted.errors[0]===FLOATING_DRAWING_REVIEW_ERROR && typeof extracted.sha256==="string");
}

/**
 * Connects the existing validators without inventing a DOCX converter.
 * `inputs` maps language to { markdown, parser }, { html, parser }, or
 * { buffer, parser } for DOCX. Every route ends in strict HTML inspection.
 * The returned result is a review artifact, never publishable HTML.
 */
export async function inspectPageSet(pageSet, inputs = {}) {
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
    let sourceRichInventory = null;
    let assetFiles = [];
    let previewHtml = null;
    let visualReviewRequired = false;
    let visualReviewApproved = false;
    let reviewWarnings = [];
    if (meta.mode === "paste" || meta.mode === "html") {
      inspected = inspectPastedHtml(input.html, input.parser, { allowDocumentShell: meta.mode === "html" });
    } else if (meta.mode === "markdown") {
      const converted = markdownToHtml(input.markdown);
      inspected = converted.ok
        ? inspectPastedHtml(converted.html, input.parser)
        : { ok: false, errors: converted.errors, inventory: [] };
    } else {
      const rich = await inspectDocxRichContent(input.buffer);
      if (!rich.ok) {
        errors.push(...rich.errors.map(e => `${lang}: original DOCX rich content: ${e}`));
      } else sourceRichInventory = rich;
      const extracted = await extractDocx(input.buffer);
      const floatingReviewOnly=isFloatingDrawingReviewOnly(extracted);
      if (extracted.ok || floatingReviewOnly) assetFiles = extracted.assetFiles ?? [];
      if (extracted.ok) {
        inspected=inspectPastedHtml(extracted.html,input.parser);
      } else if (floatingReviewOnly) {
        previewHtml=extracted.previewHtml;
        inspected=inspectPastedHtml(previewHtml,input.parser);
        visualReviewApproved=input.floatingImageReviewApprovedSha256===extracted.sha256;
        visualReviewRequired=!visualReviewApproved;
        if(visualReviewRequired) reviewWarnings=[...extracted.errors];
      } else {
        inspected={ok:false,errors:extracted.errors,inventory:[]};
      }
    }
    const pageErrors = [...inspected.errors];
    let normalizedBlocks = [];
    if (inspected.ok) {
      pageErrors.push(...validateInventory(inspected.inventory).errors);
      pageErrors.push(...reviewPasteInventory(inspected.inventory).errors);
      if (!pageErrors.length) {
        const normalized = normalizeHtmlInventory(inspected.inventory, {
          language: lang,
          sourceMode: meta.mode === "docx" ? "docx" : meta.mode === "markdown" ? "markdown" : meta.mode === "html" ? "html" : "html-paste",
          sourcePart: meta.mode === "docx" ? "converted-html" : meta.mode === "markdown" ? "markdown-source" : meta.mode === "html" ? "html-file" : "pasted-html"
        });
        pageErrors.push(...normalized.errors);
        if (normalized.ok) normalizedBlocks = normalized.blocks;
      }
    }
    pages[lang] = { mode: meta.mode, inventory: inspected.inventory, normalizedBlocks, sourceRichInventory, assetFiles, errors: pageErrors, ...(previewHtml ? {previewHtml,sourceSha256:input.floatingImageReviewApprovedSha256??null,visualReviewRequired,visualReviewApproved,reviewWarnings} : {}) };
    errors.push(...pageErrors.map(e => `${lang}: ${e}`));
  }
  for(const [lang,page] of Object.entries(pages)) for(const warning of page.reviewWarnings??[]) errors.push(lang+': '+warning);
  const reviewRequired=Object.values(pages).some(page=>page.visualReviewRequired===true);
  const nonReviewErrors=errors.filter(error=>!error.includes(FLOATING_DRAWING_REVIEW_ERROR));
  const stage=reviewRequired ? (nonReviewErrors.length ? 'source-inspection-and-visual-review' : 'visual-review-required') : errors.length ? 'source-inspection' : 'review-ready';
  return { ok: errors.length === 0 && !reviewRequired, stage, reviewRequired, errors, pages };
}

/** Gate a reviewed output inventory against an inspected input page. */
export function verifyRenderedInventory(inspectedPage, outputInventory) {
  if (!inspectedPage || inspectedPage.errors?.length || !Array.isArray(inspectedPage.inventory)) {
    return { ok: false, errors: ["Source inspection has not passed."] };
  }
  return compareInventories(inspectedPage.inventory, outputInventory);
}
