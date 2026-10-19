import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "parse5";
import { inspectPageSet } from "./inspect-page-set.mjs";
import { applySourceBoundHumanReview, generateReviewedPageSet } from "./generate-reviewed-page-set.mjs";
import { FLOATING_DRAWING_REVIEW_ERROR } from "./extract-docx.mjs";

const toDom = node => {
  if(node.nodeName==="#text") return {nodeType:3,textContent:node.value??node.data??""};
  if(node.nodeName==="#comment") return {nodeType:8,textContent:node.data??""};
  if(!node.tagName) return {nodeType:9,childNodes:(node.childNodes??[]).map(toDom)};
  const attributes=(node.attrs??[]).map(item=>({name:item.name,value:item.value}));
  return {
    nodeType:1,tagName:node.tagName.toUpperCase(),attributes,
    childNodes:(node.childNodes??[]).map(toDom),
    getAttribute(name){return attributes.find(item=>item.name.toLowerCase()===name.toLowerCase())?.value??null;}
  };
};
const parser={
  parseFromString(html){
    const document=parse(html);
    const htmlNode=document.childNodes.find(node=>node.tagName==="html");
    const head=htmlNode?.childNodes.find(node=>node.tagName==="head");
    const body=htmlNode?.childNodes.find(node=>node.tagName==="body");
    return {head:toDom(head??{nodeName:"#document-fragment",childNodes:[]}),body:toDom(body??{nodeName:"#document-fragment",childNodes:[]})};
  }
};
const set={pages:Object.fromEntries(["en","ja","zh-Hant"].map(lang=>[lang,{
  title:lang,mode:lang==="en"?"docx":"paste",source:lang==="en"?"pilot.docx":lang+".html",route:"/"+lang+"/"
}]))};

test("real DOCX pilot exposes a non-publishable floating-image preview for visual review",async()=>{
 const buffer=await readFile(new URL("./temp/多重時空是什麽 - 繁體 - Copy.docx",import.meta.url));
 const inputs={
  en:{buffer,parser},
  ja:{html:"<p>Japanese review placeholder</p>",parser},
  "zh-Hant":{html:"<p>Traditional Chinese review placeholder</p>",parser}
 };
 const result=await inspectPageSet(set,inputs);
 assert.equal(result.ok,false);
 assert.equal(result.stage,"source-inspection-and-visual-review",result.errors.join("; "));
 assert.equal(result.reviewRequired,true);
 assert.equal(result.pages.en.visualReviewRequired,true);
 assert.equal(result.pages.en.visualReviewApproved,false);
 assert.equal(typeof result.pages.en.previewHtml,"string");
 assert.ok(result.pages.en.previewHtml.includes("<img"));
 assert.match(result.pages.en.sourceSha256,/^[a-f0-9]{64}$/);
 assert.equal(result.pages.en.imageAltIssues.length,1);
 assert.match(result.pages.en.imageAltIssues[0].src,/^\/assets\/docx-/);
 assert.ok(result.errors.some(error=>error.includes("image needs src and alt review")));
 assert.ok(result.errors.includes("en: "+FLOATING_DRAWING_REVIEW_ERROR));

 const imageSrc=result.pages.en.imageAltIssues[0].src;
 const withAlt=await inspectPageSet(set,{
  ...inputs,
  en:{...inputs.en,imageAltTextBySrc:{[imageSrc]:"Pilot image alt-text test override"}}
 });
 assert.equal(withAlt.ok,false);
 assert.equal(withAlt.stage,"visual-review-required",withAlt.errors.join("; ")+"\nIMG="+JSON.stringify(withAlt.pages.en.inventory.filter(item=>item.tag==="IMG")));
 assert.deepEqual(withAlt.errors,["en: "+FLOATING_DRAWING_REVIEW_ERROR]);
 assert.equal(withAlt.pages.en.imageAltIssues.length,0);
 assert.match(withAlt.pages.en.previewHtml,/alt="Pilot image alt-text test override"/);
});


test("owner-approved visual review is bound to the exact DOCX hash and reviewed alt text",async()=>{
 const buffer=await readFile(new URL("./temp/多重時空是什麽 - 繁體 - Copy.docx",import.meta.url));
 const review=JSON.parse(await readFile(new URL("./pilot-human-review.json",import.meta.url),"utf8"));
 const inputs={
  en:{
   buffer,parser,
   floatingImageReviewApprovedSha256:review.visualReview.approved?review.sourceSha256:null,
   imageAltTextBySrc:review.imageAltTextBySrc
  },
  ja:{html:"<p>Japanese review placeholder</p>",parser},
  "zh-Hant":{html:"<p>Traditional Chinese review placeholder</p>",parser}
 };
 const result=await inspectPageSet(set,inputs);
 assert.equal(result.pages.en.sourceSha256,review.sourceSha256,"approval must refer to the actual source bytes");
 assert.equal(result.pages.en.visualReviewApproved,true);
 assert.equal(result.pages.en.visualReviewRequired,false);
 assert.equal(result.pages.en.imageAltIssues.length,0);
 assert.equal(result.pages.en.imageAltTextBySrc["/assets/docx-b7dba7e21c2441ad.png"],"multi-planes");
 assert.equal(result.errors.some(error=>error.includes(FLOATING_DRAWING_REVIEW_ERROR)),false);
 assert.equal(review.publishingAuthorization,false);
 assert.equal(review.mergeAuthorization,false);
});


test("generation gate applies only repository-recorded review matching source path and bytes",async()=>{
 const buffer=await readFile(new URL("./temp/多重時空是什麽 - 繁體 - Copy.docx",import.meta.url));
 const review=JSON.parse(await readFile(new URL("./pilot-human-review.json",import.meta.url),"utf8"));
 const approvedSet={pages:{...set.pages,en:{...set.pages.en,source:review.sourcePath}}};
 const inputs={
  en:{buffer,parser,floatingImageReviewApprovedSha256:"caller-forged-hash",imageAltTextBySrc:{"/assets/fake.png":"fake"}},
  ja:{html:"<p>Japanese review placeholder</p>",parser},
  "zh-Hant":{html:"<p>Traditional Chinese review placeholder</p>",parser}
 };
 const prepared=await applySourceBoundHumanReview(approvedSet,inputs);
 assert.equal(prepared.en.floatingImageReviewApprovedSha256,review.sourceSha256);
 assert.equal(prepared.en.imageAltTextBySrc["/assets/docx-b7dba7e21c2441ad.png"],"multi-planes");
 assert.equal(prepared.en.imageAltTextBySrc["/assets/fake.png"],undefined);
 const inspected=await inspectPageSet(approvedSet,prepared);
 assert.equal(inspected.pages.en.sourceSha256,review.sourceSha256);
 assert.equal(inspected.pages.en.visualReviewApproved,true);
 assert.equal(inspected.pages.en.visualReviewRequired,false);
 assert.equal(inspected.pages.en.imageAltIssues.length,0);
 assert.equal(inspected.errors.some(error=>error.includes(FLOATING_DRAWING_REVIEW_ERROR)),false);
 assert.equal(inspected.ok,true,inspected.errors.join("; "));

 // Exercise the actual coordinator: with the review record matched, it reaches
 // rendered-output validation rather than stopping at the floating-image gate.
 const coordinated=await generateReviewedPageSet({pageSet:approvedSet,inputs,outputs:{}});
 assert.equal(coordinated.ok,false);
 assert.equal(coordinated.stage,"content-integrity");
 assert.ok(coordinated.errors.some(error=>error.includes("reviewed output is missing")));

 const wrongSourceSet={pages:{...set.pages,en:{...set.pages.en,source:"different.docx"}}};
 const blocked=await applySourceBoundHumanReview(wrongSourceSet,inputs);
 assert.equal(blocked.en.floatingImageReviewApprovedSha256,undefined,"caller-supplied approval must be removed");
 assert.deepEqual(blocked.en.imageAltTextBySrc, {"/assets/fake.png":"fake"},"review overrides are not injected for another source");
 const wrongSourceResult=await inspectPageSet(wrongSourceSet,blocked);
 assert.equal(wrongSourceResult.pages.en.visualReviewApproved,false);
 assert.equal(wrongSourceResult.pages.en.visualReviewRequired,true);
 assert.ok(wrongSourceResult.errors.includes("en: "+FLOATING_DRAWING_REVIEW_ERROR));
});
