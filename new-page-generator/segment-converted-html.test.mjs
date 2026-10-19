import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractDocx } from "./extract-docx.mjs";
import { segmentConvertedHtml } from "./segment-converted-html.mjs";

test("converted HTML is split into ordered language fragments without text loss",()=>{
 const html='<p>多重時空是什麽</p><p>中文<img src="/a.png" alt="a"></p><p>What is Multidimensional Space-Time</p><p>English<img src="/b.png" alt="b"></p><p>多重時空とは</p><p>日本語<img src="/c.png" alt="c"></p>';
 const result=segmentConvertedHtml(html);
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.deepEqual(result.segments.map(s=>s.language),["zh-Hant","en","ja"]);
 assert.deepEqual(result.segments.map(s=>s.imageCount),[1,1,1]);
 assert.deepEqual(result.segments.map(s=>s.paragraphCount),[2,2,2]);
 assert.ok(result.segments.every(s=>s.html.includes(s.marker)));
});

test("real pilot converted preview splits into three one-image language fragments",async()=>{
 const buffer=await readFile(new URL("./temp/多重時空是什麽 - 繁體 - Copy.docx",import.meta.url));
 const extracted=await extractDocx(buffer);
 assert.equal(typeof extracted.previewHtml,"string","floating-image pilot should provide a non-publishable review preview");
 const result=segmentConvertedHtml(extracted.previewHtml);
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.deepEqual(result.segments.map(s=>s.language),["zh-Hant","en","ja"]);
 assert.deepEqual(result.segments.map(s=>s.imageCount),[1,1,1]);
 assert.ok(result.segments.every(s=>s.paragraphCount>0));
});
