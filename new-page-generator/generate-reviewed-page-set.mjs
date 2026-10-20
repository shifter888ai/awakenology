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
import { inspectPageSet, applyImageAltTextOverrides } from "./inspect-page-set.mjs";
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
  const altApplied=applyImageAltTextOverrides(extracted.previewHtml,review.imageAltTextBySrc??{});
  if(altApplied.errors.length) return blocked("reviewed-alt-text",altApplied.errors);
  const validationSplit=segmentConvertedHtml(altApplied.html);
  if(!validationSplit.ok) return blocked("language-html-validation-segmentation",validationSplit.errors);
  const htmlSplit=segmentConvertedHtml(correctPilotPreview(altApplied.html));
  if(!htmlSplit.ok) return blocked("language-html-segmentation",htmlSplit.errors);
  if(sourceSplit.segments.length!==LANGUAGES.length||htmlSplit.segments.length!==LANGUAGES.length||validationSplit.segments.length!==LANGUAGES.length ||
     sourceSplit.segments.some(segment=>!LANGUAGES.includes(segment.language))) {
    return blocked("language-segmentation",["Expected exactly one source and converted segment for each required language."]);
  }
  const richResults=[];
  const fragments={},validationFragments={};
  for(let i=0;i<sourceSplit.segments.length;i++) {
    const sourceSegment=sourceSplit.segments[i],htmlSegment=htmlSplit.segments[i],validationSegment=validationSplit.segments[i],lang=sourceSegment.language;
    if(htmlSegment.language!==lang||validationSegment.language!==lang) {
      return blocked("language-segmentation",["Source/HTML language order mismatch at "+lang+"."]);
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
    validationFragments[lang]=validationSegment;
  }
  const htmlPageSet={pages:Object.fromEntries(LANGUAGES.map(lang=>[lang,{
    ...pageSet.pages[lang],mode:"html",source:sourcePath+"#"+lang
  }]))};
  const inputs=Object.fromEntries(LANGUAGES.map(lang=>[lang,{html:validationFragments[lang].html,parser}]));
  const outputs=Object.fromEntries(LANGUAGES.map(lang=>[lang,{
    title:pageSet.pages[lang].title,description:"Non-publishable DOCX review fragment.",
    parser,approvedHeader:"<header>Review-only validation shell</header>",
    approvedFooter:"<footer>Review-only validation shell</footer>",
    reviewedArticleHtml:validationFragments[lang].html
  }]));
  const integrity=await generateReviewedPageSet({pageSet:htmlPageSet,inputs,outputs});
  if(!integrity.ok) return blocked("html-page-set-integrity",integrity.errors,{languageRichComparison:richResults});
  const previewRouteManifest=buildLanguageRouteManifest(htmlPageSet);
  if(!previewRouteManifest.ok) return blocked("preview-routes",previewRouteManifest.errors,{languageRichComparison:{ok:true,segments:richResults}});
  const draftHeader='<header class="site-header"><div class="header-inner"><a class="brand" href="/" title="Home" aria-label="Awakenology home"><svg class="brand-symbol" viewBox="0 0 100 100" role="img" aria-label="Circled A" style="transform:rotate(5deg);transform-origin:center"><path d="M17 80 A44 44 0 1 1 26.7 87.3" fill="none" stroke="currentColor" stroke-width="7.5" stroke-linecap="butt"/><path d="M27 87 L50 20 L72 77 L58 59 Q52 54 46 55" fill="none" stroke="currentColor" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Awakenology</span></a><div class="header-controls"><nav class="nav" aria-label="Site navigation"><a href="/English/">English</a><a href="/Japanese/">日本語</a><a href="/Chinese/">中文</a><a href="/ai-search/">Search / Ask</a></nav><button class="theme-toggle" type="button" aria-label="Switch to light theme" title="Switch theme"><span aria-hidden="true">☀</span></button></div></div><div class="review-banner">REVIEW PREVIEW — NOT FOR PUBLICATION</div></header>';
  const draftFooter='<footer class="footer"><div class="footer-inner"><span class="footer-links"><a class="contact-icon" href="mailto:contact@awakenology.org" aria-label="Email Awakenology" title="Contact"><span aria-hidden="true">✉</span></a><a class="reddit-icon" href="https://www.reddit.com/r/EscapeReincarnation/" aria-label="Reddit: Escape Reincarnation" title="Reddit: Escape Reincarnation">Reddit 1</a><a class="reddit-icon" href="https://www.reddit.com/r/EscapePrisonPlanet/" aria-label="Reddit: Escape Prison Planet" title="Reddit: Escape Prison Planet">Reddit 2</a><a class="reddit-icon" href="https://www.reddit.com/user/Lower-Lingonberry-40/" aria-label="Reddit: Lower-Lingonberry-40" title="Reddit: Lower-Lingonberry-40">Reddit 3</a><a class="disclaimer-icon" href="/Disclaimer/" aria-label="Disclaimer" title="Disclaimer"><span aria-hidden="true">ⓘ</span></a></span><span>© 2017 Awakenology</span><strong>REVIEW PREVIEW — NOT FOR PUBLICATION</strong></div></footer>';
  const pages=Object.fromEntries(LANGUAGES.map(lang=>{
    const meta=pageSet.pages[lang],fragment=fragments[lang];
    let previewHtml;
    try {
      previewHtml=renderStaticShell({
        language:lang,title:meta.title,
        description:"Review-only preview generated from the visually reviewed source DOCX. Not approved for publication.",
        route:meta.route,alternates:previewRouteManifest.pages[lang].alternates,
        approvedHeader:draftHeader,approvedFooter:draftFooter,
        reviewedArticleHtml:fragment.html,integrityApproved:true
      });
    } catch(error) {
      throw new Error(lang+": review-only shell preview failed: "+String(error?.message??error));
    }
    return [lang,{
      language:lang,route:meta.route,articleHtml:fragment.html,previewHtml,
      paragraphCount:fragment.paragraphCount,imageCount:fragment.imageCount,
      textCharacterCount:fragment.textCharacterCount,publishable:false
    }];
  }));
  return {
    ok:true,stage:"review-only-trilingual-bundle",publishable:false,sourcePath,sourceSha256:sha256,
    errors:[],pages,languageRichComparison:{ok:true,segments:richResults},
    htmlPageSetValidation:{ok:true,stage:integrity.stage},
    previewShell:{kind:"draft-review-only",publishable:false,containsReviewWatermark:true},
    note:"Each language includes a complete static-shell review preview with an explicit NOT FOR PUBLICATION watermark. The draft shell is not the approved production shell; no site files, sitemap, PR, merge, or deployment are produced."
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
