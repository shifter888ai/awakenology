import test from "node:test";
import assert from "node:assert/strict";
import { segmentRichContentInventory } from "./segment-rich-content.mjs";

test("rebases all rich-content fields to the selected language range",()=>{
 const source={
  paragraphCount:4,
  runs:[0,1,2,3].map(paragraphIndex=>({paragraphIndex,text:String(paragraphIndex)})),
  images:[{paragraphIndex:0,order:0},{paragraphIndex:2,order:1},{paragraphIndex:3,order:2}],
  lineBreaks:[{paragraphIndex:2,textOffset:1}],
  paragraphLayouts:[0,1,2,3].map(paragraphIndex=>({paragraphIndex,alignment:"left",indentation:{}})),
  paragraphNumbering:[{paragraphIndex:2,numId:1}],
  paragraphMarkFormatting:[{paragraphIndex:3,fontFamily:{ascii:"Arial"}}]
 };
 const result=segmentRichContentInventory(source,{startParagraph:1,endParagraphExclusive:3});
 assert.equal(result.ok,true);
 assert.equal(result.paragraphCount,2);
 assert.deepEqual(result.runs.map(x=>[x.paragraphIndex,x.text]),[[0,"1"],[1,"2"]]);
 assert.deepEqual(result.images.map(x=>[x.paragraphIndex,x.order]),[[1,0]]);
 assert.deepEqual(result.lineBreaks.map(x=>x.paragraphIndex),[1]);
 assert.deepEqual(result.paragraphLayouts.map(x=>x.paragraphIndex),[0,1]);
 assert.deepEqual(result.paragraphNumbering.map(x=>x.paragraphIndex),[1]);
 assert.deepEqual(result.paragraphMarkFormatting,[]);
});

test("invalid ranges fail closed",()=>{
 const result=segmentRichContentInventory({paragraphCount:2,runs:[],images:[]},{startParagraph:1,endParagraphExclusive:3});
 assert.equal(result.ok,false);
});
