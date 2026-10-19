import test from "node:test";
import assert from "node:assert/strict";
import { applyDocxRichFormatting } from "./apply-docx-rich-formatting.mjs";

const inventory = () => ({
  paragraphCount: 1,
  paragraphLayouts: [{paragraphIndex:0,alignment:"center",indentation:{left:720,right:0},spacing:{beforePt:6,afterPt:12,lineHeightPt:18}}],
  runs: [
    {paragraphIndex:0,text:"Bold ",bold:true,italic:false,underline:false,color:"#ff0000",fontSizePt:12,href:null,fontFamily:"Microsoft YaHei",language:{val:"en-US",eastAsia:"zh-CN"},fontSizeCsPt:12,allCaps:false,letterSpacingPt:1,fontKerning:'normal'},
    {paragraphIndex:0,text:"plain",bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:true,letterSpacingPt:null}
  ]
});
test("applies independently resolved run and paragraph formatting without changing text", () => {
 const result=applyDocxRichFormatting('<p><strong>Bold </strong>plain<img src="assets/one.png" alt="diagram"></p>', inventory());
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.match(result.html,/text-align:center/);
 assert.match(result.html,/margin-left:36pt/);
 assert.match(result.html,/line-height:18pt/);
 assert.match(result.html,/font-weight:bold/);
 assert.match(result.html,/color:#ff0000/);
 assert.match(result.html,/font-family:&quot;Microsoft YaHei&quot;/);
 assert.match(result.html,/data-word-lang-east-asia="zh-CN"/);
 assert.match(result.html,/letter-spacing:1pt/);
 assert.match(result.html,/font-kerning:normal/);
 assert.match(result.html,/text-transform:uppercase/);
 assert.match(result.html,/src="assets\/one.png"/);
 assert.match(result.html,/<strong><span/);
 assert.match(result.html,/>plain<\/span>/);
});
test("blocks source/output paragraph text or paragraph-count mismatches", () => {
 const changed=applyDocxRichFormatting("<p>Bold altered</p>",inventory());
 assert.equal(changed.ok,false); assert.equal(changed.html,null);
 const count=applyDocxRichFormatting("<p>Bold </p><p>plain</p>",inventory());
 assert.equal(count.ok,false); assert.equal(count.html,null);
});
test("rejects incomplete source formatting inventory", () => {
 const result=applyDocxRichFormatting("<p>text</p>",{runs:[],paragraphLayouts:[]});
 assert.equal(result.ok,false);
});
