import test from "node:test";
import assert from "node:assert/strict";
import { segmentTrilingualDocxSource } from "./segment-docx-languages.mjs";
import { readFile } from "node:fs/promises";
import { inspectDocxSourceMap } from "./inspect-docx-source-map.mjs";
test("orders three language ranges",()=>{ const s={ok:true,paragraphs:[{text:"多重時空是什麽"},{text:"body"},{text:"What is Multidimensional Space-Time"},{text:"body"},{text:"多重時空とは"}]}; const r=segmentTrilingualDocxSource(s); assert.equal(r.ok,true,r.errors.join("; ")); assert.deepEqual(r.segments.map(x=>x.language),["zh-Hant","en","ja"]); });

test("real pilot language segments cover the complete ordered source map",async()=>{
 const buffer=await readFile(new URL("./temp/多重時空是什麽 - 繁體 - Copy.docx",import.meta.url));
 const source=await inspectDocxSourceMap(buffer);
 assert.equal(source.ok,true,source.errors.join("; "));
 const result=segmentTrilingualDocxSource(source);
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.deepEqual(result.segments.map(s=>s.language),["zh-Hant","en","ja"]);
 assert.equal(result.segments[0].startParagraph,0);
 assert.equal(result.segments.at(-1).endParagraphExclusive,source.paragraphs.length);
 assert.equal(result.segments.reduce((n,s)=>n+s.paragraphCount,0),source.paragraphs.length);
 for(let i=1;i<result.segments.length;i++) assert.equal(result.segments[i-1].endParagraphExclusive,result.segments[i].startParagraph);
 assert.deepEqual(result.segments.map(s=>s.paragraphs[0].text.trim().includes(s.marker)),[true,true,true]);
});
