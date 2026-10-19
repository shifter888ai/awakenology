import { reviewPasteInventory } from "./review-paste-inventory.mjs";
import { extractDocx, FLOATING_DRAWING_REVIEW_ERROR } from "./extract-docx.mjs";
import { inspectDocxRichContent } from "./inspect-docx-rich-content.mjs";
import { LANGUAGES, validatePageSet } from "./validate-page-set.mjs";
import { inspectPastedHtml } from "./inspect-paste.mjs";
import { validateInventory, compareInventories } from "./content-inventory.mjs";
import { normalizeHtmlInventory } from "./normalize-html-inventory.mjs";
import { markdownToHtml } from "./markdown-to-html.mjs";
import { parseFragment, serialize } from "parse5";

export function isFloatingDrawingReviewOnly(extracted) {
  return Boolean(extracted && extracted.ok===false && typeof extracted.previewHtml==="string" &&
    Array.isArray(extracted.errors) && extracted.errors.length===1 &&
    extracted.errors[0]===FLOATING_DRAWING_REVIEW_ERROR && typeof extracted.sha256==="string");
}

export function applyImageAltTextOverrides(html, overrides={}) {
  const errors=[], applied={};
  if(!overrides || typeof overrides!=="object" || Array.isArray(overrides)) return {html,applied,errors:["Image alt-text overrides must be an object keyed by exact image src."]};
  const fragment=parseFragment(html);
  const used=new Set();
  const walk=node=>{
    if(node.nodeName==="img") {
      const src=node.attrs?.find(item=>item.name==="src")?.value??"";
      const alt=node.attrs?.find(item=>item.name==="alt");
      const hasOverride=Object.prototype.hasOwnProperty.call(overrides,src);
      if(hasOverride) {
        const value=overrides[src];
        if(typeof value!=="string"||!value.trim()||value.length>500||/[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]/.test(value)) {
          errors.push("Invalid alt-text override for image src "+src+".");
        } else if(alt?.value?.trim()) {
          if(alt.value!==value) errors.push("Refusing to replace source-provided alt text for image src "+src+".");
          used.add(src);
        } else {
          if(alt) alt.value=value;
          else node.attrs.push({name:"alt",value});
          applied[src]=value; used.add(src);
        }
      }
    }
    for(const child of node.childNodes??[]) walk(child);
  };
  walk(fragment);
  for(const src of Object.keys(overrides)) if(!used.has(src)) errors.push("Alt-text override does not match a missing-alt image in this preview: "+src+".");
  return {html:serialize(fragment),applied,errors};
}
export function prepareDocxInspection(extracted, parser, approvedSha256=null, imageAltTextBySrc={}) {
  if(extracted?.ok) {
    const alt=applyImageAltTextOverrides(extracted.html,imageAltTextBySrc);
    const inspected=inspectPastedHtml(alt.html,parser);
    inspected.errors.push(...alt.errors);
    return {
      inspected,assetFiles:extracted.assetFiles??[],previewHtml:null,sourceSha256:extracted.sha256??null,
      visualReviewRequired:false,visualReviewApproved:false,reviewWarnings:[],imageAltTextBySrc:alt.applied,
      imageAltIssues:findMissingImageAlt(inspected.inventory)
    };
  }
  if(isFloatingDrawingReviewOnly(extracted)) {
    const alt=applyImageAltTextOverrides(extracted.previewHtml,imageAltTextBySrc);
    const visualReviewApproved=approvedSha256===extracted.sha256;
    const inspected=inspectPastedHtml(alt.html,parser);
    inspected.errors.push(...alt.errors);
    return {
      inspected,assetFiles:extracted.assetFiles??[],previewHtml:alt.html,sourceSha256:extracted.sha256,
      visualReviewRequired:!visualReviewApproved,visualReviewApproved,
      reviewWarnings:visualReviewApproved?[]:[...extracted.errors],imageAltTextBySrc:alt.applied,
      imageAltIssues:findMissingImageAlt(inspected.inventory)
    };
  }
  return {
    inspected:{ok:false,errors:extracted?.errors??["DOCX extraction result is invalid."],inventory:[]},
    assetFiles:[],previewHtml:null,sourceSha256:extracted?.sha256??null,
    visualReviewRequired:false,visualReviewApproved:false,reviewWarnings:[],imageAltTextBySrc:{},imageAltIssues:[]
  };
}
function findMissingImageAlt(inventory) {
  return (inventory??[]).filter(item=>item.type==="element"&&item.tag==="IMG").map(item=>{
    const attrs=Object.fromEntries(item.attributes??[]);
    return {path:item.path,src:attrs.src??"",alt:attrs.alt??""};
  }).filter(item=>!item.alt.trim());
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
    let previewSourceSha256 = null;
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
      const prepared=prepareDocxInspection(extracted,input.parser,input.floatingImageReviewApprovedSha256??null,input.imageAltTextBySrc??{});
      inspected=prepared.inspected;
      assetFiles=prepared.assetFiles;
      previewHtml=prepared.previewHtml;
      previewSourceSha256=prepared.sourceSha256;
      visualReviewRequired=prepared.visualReviewRequired;
      visualReviewApproved=prepared.visualReviewApproved;
      reviewWarnings=prepared.reviewWarnings;
      const imageAltTextBySrc=prepared.imageAltTextBySrc;
      const imageAltIssues=prepared.imageAltIssues;
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
    pages[lang] = { mode: meta.mode, inventory: inspected.inventory, normalizedBlocks, sourceRichInventory, assetFiles, errors: pageErrors, ...(previewHtml ? {previewHtml,sourceSha256:previewSourceSha256,visualReviewRequired,visualReviewApproved,reviewWarnings,imageAltTextBySrc,imageAltIssues} : {}) };
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
