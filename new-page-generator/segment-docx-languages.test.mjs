import test from "node:test";
import assert from "node:assert/strict";
import { segmentTrilingualDocxSource } from "./segment-docx-languages.mjs";
test("orders three language ranges",()=>{ const s={ok:true,paragraphs:[{text:"多重時空是什麽"},{text:"body"},{text:"What is Multidimensional Space-Time"},{text:"body"},{text:"多重時空とは"}]}; const r=segmentTrilingualDocxSource(s); assert.equal(r.ok,true,r.errors.join("; ")); assert.deepEqual(r.segments.map(x=>x.language),["zh-Hant","en","ja"]); });
