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


test("renders standard Word bullet markers with explicit native list styling",()=>{
 const source={
  paragraphCount:1,
  paragraphLayouts:[{paragraphIndex:0,alignment:"left",indentation:{},spacing:{beforePt:0,afterPt:0,lineHeightPt:null}}],
  paragraphNumbering:[{paragraphIndex:0,numId:8,abstractNumId:3,level:0,format:"bullet",text:"•",start:1,indentation:{}}],
  runs:[{paragraphIndex:0,text:"Bullet",bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:false,letterSpacingPt:null}]
 };
 const result=applyDocxRichFormatting("<ul><li>Bullet</li></ul>",source);
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.match(result.html,/<ul style="list-style-type:disc">/);
});

test("blocks custom Word bullet glyphs not representable by the native list adapter",()=>{
 const source={
  paragraphCount:1,
  paragraphLayouts:[{paragraphIndex:0,alignment:"left",indentation:{},spacing:{}}],
  paragraphNumbering:[{paragraphIndex:0,numId:8,abstractNumId:3,level:0,format:"bullet",text:"◆",start:1,indentation:{}}],
  runs:[{paragraphIndex:0,text:"Bullet"}]
 };
 const result=applyDocxRichFormatting("<ul><li>Bullet</li></ul>",source);
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(error=>error.includes("cannot be represented faithfully")));
});


test("blocks ambiguous continuation of the same Word numbering ID across HTML lists",()=>{
 const source={
  paragraphCount:2,
  paragraphLayouts:[0,1].map(paragraphIndex=>({paragraphIndex,alignment:"left",indentation:{},spacing:{beforePt:0,afterPt:0,lineHeightPt:null}})),
  paragraphNumbering:[0,1].map(paragraphIndex=>({paragraphIndex,numId:7,abstractNumId:2,level:0,format:"decimal",text:"%1.",start:1,indentation:{}})),
  runs:[
   {paragraphIndex:0,text:"One",bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:false,letterSpacingPt:null},
   {paragraphIndex:1,text:"Two",bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:false,letterSpacingPt:null}
  ]
 };
 const result=applyDocxRichFormatting("<ol><li>One</li></ol><ol><li>Two</li></ol>",source);
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(error=>error.includes("continuation across separate HTML list containers")));
});


test("restores omitted empty Word paragraphs before aligning later text",()=>{
 const source={
  paragraphCount:3,
  paragraphLayouts:[0,1,2].map(paragraphIndex=>({paragraphIndex,alignment:"left",indentation:{left:0,right:0},spacing:{beforePt:0,afterPt:0,lineHeightPt:null}})),
  runs:[
   {paragraphIndex:0,text:"First",bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:false,letterSpacingPt:null},
   {paragraphIndex:2,text:"Second",bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:false,letterSpacingPt:null}
  ]
 };
 const result=applyDocxRichFormatting("<p>First</p><p>Second</p>",source);
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.match(result.html,/<p>First<\/p><p><\/p><p>Second<\/p>/);
});

test("restores source markers inside an omitted empty paragraph",()=>{
 const source={
  paragraphCount:3,
  paragraphLayouts:[0,1,2].map(paragraphIndex=>({paragraphIndex,alignment:"left",indentation:{left:0,right:0},spacing:{beforePt:0,afterPt:0,lineHeightPt:null}})),
  runs:[
   {paragraphIndex:0,text:"First",bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:false,letterSpacingPt:null},
   {paragraphIndex:2,text:"Second",bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:false,letterSpacingPt:null}
  ],
  lineBreaks:[{paragraphIndex:1,textOffset:0,breakType:"textWrapping",markerOrder:0}],
  images:[{paragraphIndex:1,assetPath:"/assets/empty.png",alt:"Empty paragraph image",textOffset:0,markerOrder:1}]
 };
 const result=applyDocxRichFormatting("<p>First</p><p>Second</p>",source);
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.match(result.html,/<p><br><img src="\/assets\/empty\.png" alt="Empty paragraph image"><\/p>/);
});


test("restores the correct number of consecutive empty Word paragraphs",()=>{
 const source={
  paragraphCount:4,
  paragraphLayouts:[0,1,2,3].map(paragraphIndex=>({paragraphIndex,alignment:"left",indentation:{left:0,right:0},spacing:{beforePt:0,afterPt:0,lineHeightPt:null}})),
  runs:[
   {paragraphIndex:0,text:"First",bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:false,letterSpacingPt:null},
   {paragraphIndex:3,text:"Second",bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:false,letterSpacingPt:null}
  ]
 };
 const result=applyDocxRichFormatting("<p>First</p><p></p><p>Second</p>",source);
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.match(result.html,/<p>First<\/p><p><\/p><p><\/p><p>Second<\/p>/);
});


test("renders a supported Word floating image with measured square-wrap CSS and provenance",()=>{
 const source={
  paragraphCount:1,
  paragraphLayouts:[{paragraphIndex:0,alignment:"left",indentation:{left:840,right:0},spacing:{beforePt:0,afterPt:0,lineHeightPt:null}}],
  runs:[{paragraphIndex:0,text:"Text",bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null,fontFamily:null,language:null,fontSizeCsPt:null,allCaps:false,letterSpacingPt:null}],
  images:[{paragraphIndex:0,order:0,assetPath:"/assets/a.png",alt:"Diagram",textOffset:0,placement:{
   kind:"floating",anchorAttributes:{behindDoc:"0",distL:"114300",distR:"114300",distT:"0",distB:"0"},
   horizontalPosition:'<wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH>',
   verticalPosition:'<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>',
   extent:'<wp:extent cx="1270000" cy="635000"/>',wrap:'<wp:wrapSquare wrapText="bothSides"/>',requiresVisualReview:true
  }}]
 };
 const result=applyDocxRichFormatting('<p>Text<img src="/assets/a.png" alt="Diagram"></p>',source);
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.match(result.html,/float:left/);
 assert.match(result.html,/width:100pt/);
 assert.match(result.html,/height:50pt/);
 assert.match(result.html,/margin-left:-42pt/);
 assert.match(result.html,/data-word-image-placement-json=/);
});
