import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const PILOT_REVIEW_RECORD_URL = new URL("./pilot-human-review.json", import.meta.url);

/**
 * Applies the checked-in owner review only to the exact reviewed source bytes.
 * Caller-supplied approval hashes are never accepted by this generation path.
 * This is a workflow control, not a security boundary against repository changes.
 */
export async function applySourceBoundHumanReview(pageSet, inputs) {
  const prepared = Object.fromEntries(Object.entries(inputs ?? {}).map(([lang, input]) => [lang, input && typeof input === "object" ? { ...input } : input]));
  for (const [lang, meta] of Object.entries(pageSet?.pages ?? {})) {
    if (meta.mode !== "docx" || !prepared[lang] || typeof prepared[lang] !== "object") continue;
    delete prepared[lang].floatingImageReviewApprovedSha256;
    let review = null;
    try {
      review = JSON.parse(await readFile(PILOT_REVIEW_RECORD_URL, "utf8"));
    } catch {
      continue;
    }
    const buffer = prepared[lang].buffer;
    if (meta.source !== review.sourcePath || !Buffer.isBuffer(buffer)) continue;
    const actualSha256 = createHash("sha256").update(buffer).digest("hex");
    if (actualSha256 !== review.sourceSha256 || review.visualReview?.approved !== true) continue;
    prepared[lang].floatingImageReviewApprovedSha256 = actualSha256;
    prepared[lang].imageAltTextBySrc = review.imageAltTextBySrc ?? {};
  }
  return prepared;
}

import { LANGUAGES, validatePageSet } from "./validate-page-set.mjs";
import { inspectPageSet } from "./inspect-page-set.mjs";
import { buildLanguageRouteManifest, verifyLanguageRouteManifest } from "./language-route-manifest.mjs";
import { renderStaticShell } from "./static-shell.mjs";
import { verifyRenderedInventory } from "./inspect-page-set.mjs";
import { inspectPastedHtml } from "./inspect-paste.mjs";
import { validateInventory } from "./content-inventory.mjs";
import { reviewPasteInventory } from "./review-paste-inventory.mjs";
import { compareRichContent } from "./compare-rich-content.mjs";
import { inspectRenderedRichContent } from "./inspect-rendered-rich-content.mjs";
import { extractDocx, FLOATING_DRAWING_REVIEW_ERROR } from "./extract-docx.mjs";
import { inspectDocxSourceMap } from "./inspect-docx-source-map.mjs";
import { inspectDocxRichContent } from "./inspect-docx-rich-content.mjs";
import { segmentTrilingualDocxSource } from "./segment-docx-languages.mjs";
import { segmentConvertedHtml } from "./segment-converted-html.mjs";
import { segmentRichContentInventory } from "./segment-rich-content.mjs";
import { correctPilotPreview } from "./correct-pilot-preview.mjs";
import { parse5DomParser } from "./parse5-dom-parser.mjs";

/**
 * Offline review coordinator. Returns static HTML and verified asset payloads only when source inspection,
 * parsed rendered content, and language routes all pass. Output inventories are
 * derived from the actual reviewedArticleHtml, never trusted from caller input.
 * This remains a review gate, not a security boundary or a full HTML sanitizer.
 */
/**
 * Coordinates the single multilingual DOCX pilot into a language-separated,
 * explicitly non-publishable review bundle. It verifies each language's rich
 * inventory against its own converted fragment, then reuses the normal page-set
 * validators for route and HTML content-integrity checks. No files are written.
 */
export async function generateSegmentedDocxReviewBundle({sourceBuffer,sourcePath,pageSet,parser=parse5DomParser}) {
  const blocked=(stage,errors,extra={})=>({ok:false,stage,publishable:false,errors,pages:{},...extra});
  if(!Buffer.isBuffer(sourceBuffer)||!sourceBuffer.length) return blocked("source",["A nonempty source DOCX Buffer is required."]);
  const contract=validatePageSet(pageSet);
  if(!contract.ok) return blocked("page-set-contract",contract.errors);
  const sha256=createHash("sha256").update(sourceBuffer).digest("hex");
  let review;
  try { review=JSON.parse(await readFile(PILOT_REVIEW_RECORD_URL,"utf8")); }
  catch { return blocked("source-review",["The checked-in source-bound human review record is unavailable or invalid."]); }
  if(review.sourcePath!==sourcePath||review.sourceSha256!==sha256||review.visualReview?.approved!==true) {
    return blocked("source-review",["Human review does not match both the supplied source path and the exact DOCX bytes."]);
  }
  const [sourceMap,sourceRich,extracted]=await Promise.all([
    inspectDocxSourceMap(sourceBuffer),inspectDocxRichContent(sourceBuffer),extractDocx(sourceBuffer)
  ]);
  if(!sourceMap.ok) return blocked("source-map",sourceMap.errors);
  if(!sourceRich.ok) return blocked("source-rich-content",sourceRich.errors);
  if(typeof extracted.previewHtml!=="string"||
     extracted.errors?.length!==1||extracted.errors[0]!==FLOATING_DRAWING_REVIEW_ERROR) {
    return blocked("docx-conversion",extracted.errors??["DOCX conversion did not produce the expected review-only preview."]);
  }
  const sourceSplit=segmentTrilingualDocxSource(sourceMap);
  if(!sourceSplit.ok) return blocked("language-source-segmentation",sourceSplit.errors);
  const htmlSplit=segmentConvertedHtml(correctPilotPreview(extracted.previewHtml));
  if(!htmlSplit.ok) return blocked("language-html-segmentation",htmlSplit.errors);
  if(sourceSplit.segments.length!==LANGUAGES.length||htmlSplit.segments.length!==LANGUAGES.length) {
    return blocked("language-segmentation",["Expected exactly three source and converted language segments."]);
  }
  const richResults=[];
  const fragments={};
  for(let i=0;i<LANGUAGES.length;i++) {
    const lang=LANGUAGES[i],sourceSegment=sourceSplit.segments[i],htmlSegment=htmlSplit.segments[i];
    if(sourceSegment.language!==lang||htmlSegment.language!==lang) {
      return blocked("language-segmentation",["Language order mismatch at "+lang+"."]);
    }
    const sourceInventory=segmentRichContentInventory(sourceRich,sourceSegment);
    const rendered=inspectRenderedRichContent(htmlSegment.html,parser);
    if(!sourceInventory.ok) return blocked("source-rich-content",sourceInventory.errors);
    if(!rendered.ok) return blocked("rendered-rich-content",rendered.errors,{language:lang});
    const comparison=compareRichContent(sourceInventory,rendered,{
      floatingImageReviewApproved:true,
      imageAltTextBySrc:review.imageAltTextBySrc??{},
      approvedNeutralTextColorOverride:true
    });
    const sourceParagraphTexts=Array.from({length:sourceInventory.paragraphCount},(_,index)=>sourceInventory.runs.filter(run=>run.paragraphIndex===index).map(run=>run.text).join(""));
    const renderedParagraphTexts=Array.from({length:rendered.paragraphCount},(_,index)=>rendered.runs.filter(run=>run.paragraphIndex===index).map(run=>run.text).join(""));
    const paragraphTextMatches=JSON.stringify(sourceParagraphTexts)===JSON.stringify(renderedParagraphTexts);
    const result={
      language:lang,ok:comparison.ok&&paragraphTextMatches,paragraphTextMatches,
      paragraphCount:sourceInventory.paragraphCount,runCount:sourceInventory.runs.length,
      imageCount:sourceInventory.images.length,lineBreakCount:sourceInventory.lineBreaks.length,
      issues:comparison.issues
    };
    richResults.push(result);
    if(!result.ok) return blocked("language-rich-content-integrity",["Source/rendered mismatch in "+lang+" ("+comparison.issues.length+" rich-content issue(s); paragraph text match="+paragraphTextMatches+")."],{languageRichComparison:richResults});
    fragments[lang]=htmlSegment;
  }
  const htmlPageSet={pages:Object.fromEntries(LANGUAGES.map(lang=>[lang,{
    ...pageSet.pages[lang],mode:"html",source:sourcePath+"#"+lang
  }]))};
  const inputs=Object.fromEntries(LANGUAGES.map(lang=>[lang,{html:fragments[lang].html,parser}]));
  const outputs=Object.fromEntries(LANGUAGES.map(lang=>[lang,{
    title:pageSet.pages[lang].title,description:"Non-publishable DOCX review fragment.",
    parser,approvedHeader:"<header>Review-only validation shell</header>",
    approvedFooter:"<footer>Review-only validation shell</footer>",
    reviewedArticleHtml:fragments[lang].html
  }]));
  const integrity=await generateReviewedPageSet({pageSet:htmlPageSet,inputs,outputs});
  if(!integrity.ok) return blocked("html-page-set-integrity",integrity.errors,{languageRichComparison:richResults});
  const pages=Object.fromEntries(LANGUAGES.map(lang=>[lang,{
    language:lang,route:pageSet.pages[lang].route,articleHtml:fragments[lang].html,
    paragraphCount:fragments[lang].paragraphCount,imageCount:fragments[lang].imageCount,
    textCharacterCount:fragments[lang].textCharacterCount,publishable:false
  }]));
  return {
    ok:true,stage:"review-only-trilingual-bundle",publishable:false,sourcePath,sourceSha256:sha256,
    errors:[],pages,languageRichComparison:{ok:true,segments:richResults},
    htmlPageSetValidation:{ok:true,stage:integrity.stage},
    note:"Article fragments only; no approved production shell, site files, sitemap, PR, merge, or deployment are produced."
  };
}

export async function generateReviewedPageSet({ pageSet, inputs, outputs }) {
  const reviewedInputs = await applySourceBoundHumanReview(pageSet, inputs);
  const inspection = await inspectPageSet(pageSet, reviewedInputs);
  if (!inspection.ok) {
    const hasReviewablePages=Object.values(inspection.pages??{}).some(page=>Boolean(page.previewHtml)||(page.imageAltIssues??[]).length>0);
    return { ok:false,stage:inspection.stage??"source-inspection",errors:inspection.errors,pages:inspection.reviewRequired||hasReviewablePages?inspection.pages:{},reviewRequired:inspection.reviewRequired===true,reviewablePagesAvailable:hasReviewablePages };
  }

  const routeManifest = buildLanguageRouteManifest(pageSet);
  if (!routeManifest.ok) return { ok: false, stage: "routes", errors: routeManifest.errors, pages: {} };

  const errors = [];
  for (const lang of LANGUAGES) {
    const output = outputs?.[lang];
    if (!output || typeof output !== "object") {
      errors.push(`${lang}: reviewed output is missing.`);
      continue;
    }
    const rendered = inspectPastedHtml(output.reviewedArticleHtml, output.parser);
    if (!rendered.ok) {
      errors.push(...rendered.errors.map(e => lang + ": rendered HTML: " + e));
      continue;
    }
    errors.push(...validateInventory(rendered.inventory).errors.map(e => lang + ": rendered HTML: " + e));
    errors.push(...reviewPasteInventory(rendered.inventory).errors.map(e => lang + ": rendered HTML: " + e));
    if (pageSet.pages[lang].mode === "docx") {
      try {
        const original = inspection.pages[lang].sourceRichInventory;
        if (!original?.ok) throw new Error("Original DOCX rich inventory unavailable.");
        const derived = inspectRenderedRichContent(output.reviewedArticleHtml, output.parser);
        if (!derived.ok) throw new Error(derived.errors.join("; "));
        const rich = compareRichContent(original, derived, {
          floatingImageReviewApproved: inspection.pages[lang].visualReviewApproved === true,
          imageAltTextBySrc: inspection.pages[lang].imageAltTextBySrc ?? {}
        });
        errors.push(...rich.issues.map(issue => lang + ": DOCX rich-content mismatch: " + JSON.stringify(issue)));
      } catch (error) {
        errors.push(lang + ": DOCX rich-content verification blocked: " + String(error?.message ?? error));
      }
      // DOCX output is allowed only when the independently inspected source
      // inventory, rendered inventory, and every rich-content field compare
      // without issues. Unsupported source features fail earlier in inspection.
    } else if (output.sourceRichInventory !== undefined || output.renderedRichInventory !== undefined) {
      errors.push(lang + ": caller-supplied rich inventories cannot establish independent source provenance.");
    }
    const integrity = verifyRenderedInventory(inspection.pages[lang], rendered.inventory);
    errors.push(...integrity.errors.map(e => lang + ": " + e));
  }
  if (errors.length) return { ok: false, stage: "content-integrity", errors, pages: {} };

  const renderedRoutes = Object.fromEntries(LANGUAGES.map(lang => [lang, {
    route: pageSet.pages[lang].route,
    alternates: routeManifest.pages[lang].alternates
  }]));
  const routeCheck = verifyLanguageRouteManifest(routeManifest, renderedRoutes);
  if (!routeCheck.ok) return { ok: false, stage: "route-verification", errors: routeCheck.errors, pages: {} };

  const pages = {};
  try {
    for (const lang of LANGUAGES) {
      const meta = pageSet.pages[lang];
      const output = outputs[lang];
      pages[lang] = {
        route: meta.route,
        html: renderStaticShell({
          language: lang,
          title: output.title ?? meta.title,
          description: output.description,
          route: meta.route,
          alternates: routeManifest.pages[lang].alternates,
          approvedHeader: output.approvedHeader,
          approvedFooter: output.approvedFooter,
          reviewedArticleHtml: output.reviewedArticleHtml,
          integrityApproved: true
        })
      };
    }
  } catch (error) {
    return { ok: false, stage: "render", errors: [String(error?.message ?? error)], pages: {} };
  }
  const assetMap = new Map();
  for (const lang of LANGUAGES) for (const asset of inspection.pages[lang].assetFiles ?? []) {
    const path = asset.outputPath.replace(/^\/+/, "");
    const prior = assetMap.get(path);
    if (prior && prior.sha256 !== asset.sha256) {
      return { ok: false, stage: "assets", errors: ["Content-addressed asset path collision: " + path], pages: {} };
    }
    if (!prior) assetMap.set(path, {
      path, url: asset.outputPath, contentType: asset.contentType,
      sha256: asset.sha256, byteLength: asset.byteLength, bytes: asset.bytes
    });
  }
  return { ok: true, stage: "review-ready-static-output", errors: [], pages, assets: [...assetMap.values()], inspection, routeManifest };
}
