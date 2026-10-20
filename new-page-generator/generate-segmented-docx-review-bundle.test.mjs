import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateSegmentedDocxReviewBundle } from "./generate-reviewed-page-set.mjs";

test("real trilingual DOCX produces a validated non-publishable language bundle",async()=>{
 const sourceBuffer=await readFile(new URL("./temp/多重時空是什麽 - 繁體 - Copy.docx",import.meta.url));
 const review=JSON.parse(await readFile(new URL("./pilot-human-review.json",import.meta.url),"utf8"));
 const pageSet={pages:{
  en:{title:"What is Multidimensional Space-Time",mode:"docx",source:review.sourcePath,route:"/pilot-review/en/"},
  ja:{title:"多重時空とは",mode:"docx",source:review.sourcePath,route:"/pilot-review/ja/"},
  "zh-Hant":{title:"多重時空是什麽",mode:"docx",source:review.sourcePath,route:"/pilot-review/zh-Hant/"}
 }};
 const result=await generateSegmentedDocxReviewBundle({sourceBuffer,sourcePath:review.sourcePath,pageSet});
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.equal(result.stage,"review-only-trilingual-bundle");
 assert.equal(result.publishable,false);
 assert.deepEqual(Object.keys(result.pages).sort(),["en","ja","zh-Hant"].sort());
 assert.equal(result.languageRichComparison.ok,true);
 for(const lang of ["en","ja","zh-Hant"]) {
  assert.equal(result.pages[lang].publishable,false);
  if(lang==="en") assert.ok(result.pages[lang].articleHtml.includes("What is Multidimensional Space-Time"));
  else if(lang==="ja") assert.ok(result.pages[lang].articleHtml.includes("多重時空とは"));
  else assert.ok(result.pages[lang].articleHtml.includes("多重")&&result.pages[lang].articleHtml.includes("時空是什麽"));
  assert.equal(result.pages[lang].imageCount,1);
 }
 assert.equal(result.htmlPageSetValidation.ok,true);
 assert.match(result.note,/no approved production shell/i);
});

test("source-bound approval mismatch blocks the review bundle",async()=>{
 const sourceBuffer=await readFile(new URL("./temp/多重時空是什麽 - 繁體 - Copy.docx",import.meta.url));
 const pageSet={pages:{
  en:{title:"English",mode:"docx",source:"wrong.docx",route:"/pilot-review/en/"},
  ja:{title:"Japanese",mode:"docx",source:"wrong.docx",route:"/pilot-review/ja/"},
  "zh-Hant":{title:"Chinese",mode:"docx",source:"wrong.docx",route:"/pilot-review/zh-Hant/"}
 }};
 const result=await generateSegmentedDocxReviewBundle({sourceBuffer,sourcePath:"wrong.docx",pageSet});
 assert.equal(result.ok,false);
 assert.equal(result.publishable,false);
 assert.equal(result.stage,"source-review");
 assert.deepEqual(result.pages,{});
});
