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
 assert.match(result.html,/<span style="[^"]*font-weight:bold/);
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


test('preserves paragraph-mark font and language metadata on the paragraph element',()=>{
 const source=inventory();
 source.paragraphMarkFormatting=[{paragraphIndex:0,fontFamily:{ascii:'Arial',eastAsia:'Yu Gothic'},language:{val:'en-US',eastAsia:'ja-JP'}}];
 const result=applyDocxRichFormatting('<p>Bold plain</p>',source);
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.match(result.html,/data-word-mark-font-ascii="Arial"/);
 assert.match(result.html,/data-word-mark-font-east-asia="Yu Gothic"/);
 assert.match(result.html,/data-word-mark-lang-val="en-US"/);
 assert.match(result.html,/data-word-mark-lang-east-asia="ja-JP"/);
});


test('maps source numbering to rendered list items without changing list text',()=>{
 const source={
  paragraphCount:1,
  paragraphLayouts:[{paragraphIndex:0,alignment:'left',indentation:{left:720,right:0,hanging:360},spacing:{beforePt:0,afterPt:0,lineHeightPt:null}}],
  paragraphNumbering:[{paragraphIndex:0,numId:7,abstractNumId:2,level:0,format:'decimal',text:'%1.',start:3,indentation:{left:720,hanging:360}}],
  runs:[{paragraphIndex:0,text:'List item',bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:false,letterSpacingPt:null}]
 };
 const result=applyDocxRichFormatting('<ol start="3"><li>List item</li></ol>',source);
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.match(result.html,/<ol start="3"><li[^>]*data-word-num-id="7"/);
 assert.match(result.html,/data-word-abstract-num-id="2"/);
 assert.match(result.html,/data-word-num-text="%1\."/);
 assert.match(result.html,/margin-left:36pt/);
 assert.match(result.html,/text-indent:-18pt/);
 assert.match(result.html,/>List item<\/li>/);
});

test('blocks a numbered source paragraph rendered as an ordinary paragraph',()=>{
 const source={
  paragraphCount:1,
  paragraphLayouts:[{paragraphIndex:0,alignment:'left',indentation:{},spacing:{}}],
  paragraphNumbering:[{paragraphIndex:0,numId:7,abstractNumId:2,level:0,format:'decimal',text:'%1.',start:1,indentation:{}}],
  runs:[{paragraphIndex:0,text:'List item'}]
 };
 const result=applyDocxRichFormatting('<p>List item</p>',source);
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(error=>error.includes('does not use a list item')));
});


test("applies source paragraph formatting to rendered heading elements",()=>{
 const source={
  paragraphCount:1,
  paragraphLayouts:[{paragraphIndex:0,alignment:"center",indentation:{},spacing:{beforePt:0,afterPt:0,lineHeightPt:null}}],
  runs:[{paragraphIndex:0,text:"Heading",bold:true,italic:false,underline:false,color:null,fontSizePt:16,href:null,fontFamily:null,language:null,fontSizeCsPt:16,allCaps:false,letterSpacingPt:null}]
 };
 const result=applyDocxRichFormatting("<h2>Heading</h2>",source);
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.match(result.html,/<h2 style="text-align:center">/);
 assert.match(result.html,/<span style="[^"]*font-weight:bold/);
 assert.match(result.html,/>Heading<\/span>/);
});


test("source layout overrides conflicting pre-existing inline layout declarations",()=>{
 const source={
  paragraphCount:1,
  paragraphLayouts:[{paragraphIndex:0,alignment:"center",indentation:{},spacing:{beforePt:0,afterPt:0,lineHeightPt:null}}],
  runs:[{paragraphIndex:0,text:"Heading",bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:false,letterSpacingPt:null}]
 };
 const result=applyDocxRichFormatting('<p style="text-align:right">Heading</p>',source);
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.match(result.html,/style="text-align:center"/);
 assert.doesNotMatch(result.html,/text-align:right/);
});
