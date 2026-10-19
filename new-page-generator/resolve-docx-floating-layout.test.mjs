import test from "node:test";
import assert from "node:assert/strict";
import { resolveDocxFloatingLayout } from "./resolve-docx-floating-layout.mjs";

const placement=overrides=>({
 kind:"floating",
 anchorAttributes:{behindDoc:"0",distL:"114300",distR:"114300",distT:"0",distB:"0",simplePos:"0",...overrides?.anchorAttributes},
 horizontalPosition:'<wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH>',
 verticalPosition:'<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>',
 extent:'<wp:extent cx="1270000" cy="635000"/>',
 wrap:'<wp:wrapSquare wrapText="bothSides"/>',
 ...overrides
});

test("maps zero-offset square-wrapped floating images to a measured CSS float",()=>{
 const result=resolveDocxFloatingLayout(placement(),{left:840});
 assert.equal(result.ok,true,result.error);
 assert.deepEqual(result.style,{
  float:"left",width:"100pt",height:"50pt","margin-left":"-42pt","margin-right":"9pt","margin-top":"0pt","margin-bottom":"0pt"
 });
});

test("blocks floating layouts whose wrapping or anchor coordinates are not represented",()=>{
 assert.equal(resolveDocxFloatingLayout(placement({wrap:'<wp:wrapTight wrapText="bothSides"/>'})).ok,false);
 assert.equal(resolveDocxFloatingLayout(placement({horizontalPosition:'<wp:positionH relativeFrom="column"><wp:posOffset>12700</wp:posOffset></wp:positionH>'})).ok,false);
 assert.equal(resolveDocxFloatingLayout(placement({anchorAttributes:{behindDoc:"1"}})).ok,false);
 assert.equal(resolveDocxFloatingLayout(placement({extent:null})).ok,false);
});

test("leaves inline images to the ordinary inline renderer",()=>{
 assert.deepEqual(resolveDocxFloatingLayout({kind:"inline"}),{ok:true,css:null,style:null});
});


test("maps Word top-and-bottom wrapping to a responsive block image",()=>{
 const result=resolveDocxFloatingLayout(placement({
  wrap:'<wp:wrapTopAndBottom/>',
  extent:'<wp:extent cx="7550150" cy="9906000"/>'
 }),{left:840});
 assert.equal(result.ok,true,result.error);
 assert.deepEqual(result.style,{
  display:"block",clear:"both",width:"594.5pt","margin-left":"-42pt","margin-top":"0pt","margin-bottom":"0pt",
  "max-width":"100%",height:"auto","margin-right":"auto"
 });
});
