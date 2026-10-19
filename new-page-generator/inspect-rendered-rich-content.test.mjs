import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectRenderedRichContent} from './inspect-rendered-rich-content.mjs';
import {normalizeDocxImagePlacement} from './resolve-docx-floating-layout.mjs';
const node=(tag,attrs={},children=[])=>({nodeType:1,tagName:tag,childNodes:children,getAttribute:key=>Object.hasOwn(attrs,key)?attrs[key]:null});
const text=value=>({nodeType:3,textContent:value});
const parser={parseFromString:()=>({body:{childNodes:[node('P',{},[node('STRONG',{},[text('什麽')]),node('A',{href:'/target'},[text(' link')]),node('IMG',{src:'asset.png',alt:'Diagram'})])]}})};
test('extracts formatting, links, image position from parsed HTML',()=>{
 const r=inspectRenderedRichContent('<p>fixture</p>',parser);
 assert.equal(r.ok,true,r.errors.join(';'));
 assert.equal(r.runs[0].bold,true);
 assert.equal(r.runs[0].text,'什麽');
 assert.equal(r.runs[1].href,'/target');
 assert.deepEqual(r.images,[{assetPath:'asset.png',paragraphIndex:0,order:0,alt:'Diagram',textOffset:7,markerOrder:0,placement:{kind:'inline',requiresVisualReview:false}}]);
});
test('requires parser rather than trusting a caller inventory',()=>assert.equal(inspectRenderedRichContent('<p>x</p>',null).ok,false));


test('blocks unsupported rendered decoration values',()=>{
 const badParser={parseFromString:()=>({body:{childNodes:[node('SPAN',{style:'text-decoration: underline line-through'},[text('styled')])]}})};
 const r=inspectRenderedRichContent('<span>styled</span>',badParser);
 assert.equal(r.ok,false);
 assert.ok(r.errors.some(x=>x.includes('Unsupported rendered text-decoration')));
});

test('blocks strike-through tags instead of losing formatting',()=>{
 const strikeParser={parseFromString:()=>({body:{childNodes:[node('S',{},[text('struck')])]}})};
 const r=inspectRenderedRichContent('<s>struck</s>',strikeParser);
 assert.equal(r.ok,false);
 assert.ok(r.errors.some(x=>x.includes('deletion/strike')));
});


test('maps rendered br position within paragraph text',()=>{
 const breakParser={parseFromString:()=>({body:{childNodes:[node('P',{},[text('A'),node('BR'),text('B')])]}})};
 const r=inspectRenderedRichContent('<p>A<br>B</p>',breakParser);
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.lineBreaks,[{paragraphIndex:0,textOffset:1,breakType:'textWrapping',markerOrder:0}]);
});


test('records separate paragraph indices even when adjacent text has no styling boundary',()=>{
 const multi={parseFromString:()=>({body:{childNodes:[
  node('P',{},[text('First')]),
  node('P',{},[text('Second')])
 ]}})};
 const r=inspectRenderedRichContent('<p>First</p><p>Second</p>',multi);
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.runs.map(x=>({paragraphIndex:x.paragraphIndex,text:x.text})),[
  {paragraphIndex:0,text:'First'},
  {paragraphIndex:1,text:'Second'}
 ]);
});


test('blocks text outside recognized paragraph containers',()=>{
 const looseText={parseFromString:()=>({body:{childNodes:[text('unwrapped text')]}})};
 const r=inspectRenderedRichContent('unwrapped text',looseText);
 assert.equal(r.ok,false);
 assert.ok(r.errors.some(x=>x.includes('outside a recognized paragraph block')));
 const divText={parseFromString:()=>({body:{childNodes:[node('DIV',{},[text('div text')])]}})};
 const d=inspectRenderedRichContent('<div>div text</div>',divText);
 assert.equal(d.ok,false);
 assert.ok(d.errors.some(x=>x.includes('outside a recognized paragraph block')));
});


test('blocks inherited CSS and semantic layout tags until their effects are mapped',()=>{
 const cssParser={parseFromString:()=>({
  head:{childNodes:[node('STYLE',{},[text('p { font-size: 20px }')])]},
  body:{childNodes:[node('P',{},[text('Text')])]}
 })};
 const css=inspectRenderedRichContent('<style>p { font-size: 20px }</style><p>Text</p>',cssParser);
 assert.equal(css.ok,false);
 assert.ok(css.errors.some(x=>x.includes('Embedded CSS rules')));
 const headingParser={parseFromString:()=>({body:{childNodes:[node('H1',{},[text('Heading')])]}})};
 const heading=inspectRenderedRichContent('<h1>Heading</h1>',headingParser);
 assert.equal(heading.ok,true,heading.errors.join('; '));
 assert.deepEqual(heading.paragraphLayouts.map(item=>item.paragraphIndex),[0]);
});
test('blocks external stylesheets before assuming inline style inventory is complete',()=>{
 const stylesheetParser={parseFromString:()=>({
  head:{childNodes:[node('LINK',{rel:'stylesheet',href:'/site.css'})]},
  body:{childNodes:[node('P',{},[text('Text')])]}
 })};
 const result=inspectRenderedRichContent('<link rel="stylesheet" href="/site.css"><p>Text</p>',stylesheetParser);
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(x=>x.includes('External stylesheets')));
});


test('records explicit rendered font sizes in points',()=>{
 const sized={parseFromString:()=>({body:{childNodes:[node('P',{},[node('SPAN',{style:'font-size: 12pt'},[text('Twelve')]),node('SPAN',{style:'font-size: 16px'},[text('Sixteen')])])]}})};
 const r=inspectRenderedRichContent('<p><span style="font-size:12pt">Twelve</span><span style="font-size:16px">Sixteen</span></p>',sized);
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.equal(r.runs[0].fontSizePt,12);
 assert.equal(r.runs[1].fontSizePt,12);
});

test('blocks relative or malformed rendered font sizes',()=>{
 const sized={parseFromString:()=>({body:{childNodes:[node('P',{},[node('SPAN',{style:'font-size: 1.2em'},[text('Relative')])])]}})};
 const r=inspectRenderedRichContent('<p><span style="font-size:1.2em">Relative</span></p>',sized);
 assert.equal(r.ok,false);
 assert.ok(r.errors.some(x=>x.includes('Unsupported rendered font-size')));
});


test('extracts explicit rendered paragraph alignment and indentation in twips',()=>{
 const layoutParser={parseFromString:()=>({body:{childNodes:[
  node('P',{style:'text-align: center; margin-left: 36pt; margin-right: 12px; text-indent: 18pt'},[text('Layout')])
 ]}})};
 const r=inspectRenderedRichContent('<p style="text-align:center;margin-left:36pt;margin-right:12px;text-indent:18pt">Layout</p>',layoutParser);
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.paragraphLayouts,[{paragraphIndex:0,alignment:'center',indentation:{left:720,right:180,firstLine:360},spacing:{beforePt:0,afterPt:0,lineHeightPt:null}}]);
});


test('maps negative CSS text-indent to Word hanging indentation',()=>{
 const hangingParser={parseFromString:()=>({body:{childNodes:[node('P',{style:'margin-left: 24pt; text-indent: -12pt'},[text('Hanging')])]}})};
 const r=inspectRenderedRichContent('<p style="margin-left:24pt;text-indent:-12pt">Hanging</p>',hangingParser);
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.paragraphLayouts,[{paragraphIndex:0,alignment:'left',indentation:{left:480,right:0,hanging:240},spacing:{beforePt:0,afterPt:0,lineHeightPt:null}}]);
});

test("extracts rendered before/after and exact line spacing in point units", () => {
 const parserWithSpacing={parseFromString:()=>({body:{childNodes:[node('P',{style:'margin-top: 6pt; margin-bottom: 12pt; line-height: 18pt'},[text('Spaced')])]}})};
 const result=inspectRenderedRichContent('<p style="margin-top:6pt;margin-bottom:12pt;line-height:18pt">Spaced</p>',parserWithSpacing);
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.deepEqual(result.paragraphLayouts[0].spacing,{beforePt:6,afterPt:12,lineHeightPt:18});
});

test("inspects rendered font family, word-language provenance, all-caps and letter spacing", () => {
 const styled={parseFromString:()=>({body:{childNodes:[node('P',{},[
  node('SPAN',{'style':'font-family: "Microsoft YaHei"; font-size: 11pt; text-transform: uppercase; letter-spacing: 1pt; font-kerning: normal','data-word-lang-val':'en-US','data-word-lang-east-asia':'zh-CN'},[text('Mixed')])
 ])]}})};
 const result=inspectRenderedRichContent('<p><span style="font-family: &quot;Microsoft YaHei&quot;;font-size:11pt;text-transform:uppercase;letter-spacing:1pt;font-kerning:normal" data-word-lang-val="en-US" data-word-lang-east-asia="zh-CN">Mixed</span></p>',styled);
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.equal(result.runs[0].fontFamily,'Microsoft YaHei');
 assert.deepEqual(result.runs[0].language,{val:'en-US',eastAsia:'zh-CN'});
 assert.equal(result.runs[0].fontSizeCsPt,11);
 assert.equal(result.runs[0].allCaps,true);
 assert.equal(result.runs[0].letterSpacingPt,1);
 assert.equal(result.runs[0].fontKerning,'normal');
});


test('inspects ordered list items with explicit Word numbering provenance',()=>{
 const ol=node('OL',{},[]);
 const li=node('LI',{
  'data-word-num-id':'7','data-word-abstract-num-id':'2','data-word-level':'0',
  'data-word-num-format':'decimal','data-word-num-text':'%1.','data-word-num-start':'3',
  'data-word-indent-left':'720','data-word-indent-hanging':'360'
 },[text('List item')]);
 li.parentNode=ol; ol.childNodes.push(li);
 const listParser={parseFromString:()=>({body:{childNodes:[ol]}})};
 const r=inspectRenderedRichContent('<ol><li data-word-num-id="7">List item</li></ol>',listParser);
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.paragraphNumbering,[{
  paragraphIndex:0,numId:7,abstractNumId:2,level:0,format:'decimal',text:'%1.',start:3,
  indentation:{left:720,right:undefined,firstLine:undefined,hanging:360}
 }]);
 assert.equal(r.paragraphCount,1);
});

test('blocks rendered list items without explicit Word numbering provenance',()=>{
 const li=node('LI',{},[text('List item')]), ol=node('OL',{},[li]); li.parentNode=ol;
 const r=inspectRenderedRichContent('<ol><li>List item</li></ol>',{parseFromString:()=>({body:{childNodes:[ol]}})});
 assert.equal(r.ok,false);
 assert.ok(r.errors.some(x=>x.includes('lacks explicit Word numbering provenance')));
});


test('keeps list numbering paragraph indexes aligned after preceding paragraphs',()=>{
 const p=node('P',{},[text('Before')]);
 const ol=node('OL',{},[]);
 const li=node('LI',{
  'data-word-num-id':'7','data-word-abstract-num-id':'2','data-word-level':'0',
  'data-word-num-format':'decimal','data-word-num-text':'%1.','data-word-num-start':'1'
 },[text('List item')]);
 li.parentNode=ol; ol.childNodes.push(li);
 const r=inspectRenderedRichContent('<p>Before</p><ol><li>List item</li></ol>',{parseFromString:()=>({body:{childNodes:[p,ol]}})});
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.paragraphNumbering.map(item=>item.paragraphIndex),[1]);
 assert.equal(r.paragraphCount,2);
});


test('inspects paragraph-mark font and language metadata on paragraph containers',()=>{
 const paragraph=node('P',{
  'data-word-mark-font-ascii':'Arial','data-word-mark-font-east-asia':'Yu Gothic',
  'data-word-mark-lang-val':'en-US','data-word-mark-lang-east-asia':'ja-JP'
 },[text('Marked')]);
 const result=inspectRenderedRichContent('<p data-word-mark-font-ascii="Arial">Marked</p>',{parseFromString:()=>({body:{childNodes:[paragraph]}})});
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.deepEqual(result.paragraphMarkFormatting,[{
  paragraphIndex:0,fontFamily:{ascii:'Arial',eastAsia:'Yu Gothic'},language:{val:'en-US',eastAsia:'ja-JP'}
 }]);
});


test("inspects heading elements as paragraph-level rendered content",()=>{
 const heading=node("H2",{style:"text-align:center"},[text("Heading")]);
 const result=inspectRenderedRichContent("<h2 style=\"text-align:center\">Heading</h2>",{parseFromString:()=>({body:{childNodes:[heading]}})});
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.equal(result.paragraphCount,1);
 assert.deepEqual(result.paragraphLayouts.map(item=>item.alignment),["center"]);
 assert.equal(result.runs[0].text,"Heading");
});


test("inspects unitless line-height ratios without treating them as errors",()=>{
 const paragraph=node("P",{style:"line-height:1.2"},[text("Spacing")]);
 const result=inspectRenderedRichContent('<p style="line-height:1.2">Spacing</p>',{parseFromString:()=>({body:{childNodes:[paragraph]}})});
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.equal(result.paragraphLayouts[0].spacing.lineHeight,1.2);
});


test("ignores serialization whitespace between paragraph blocks without merging runs",()=>{
 const first=node("P",{},[text("First")]);
 const second=node("P",{},[text("Second")]);
 const separator=text("\n  ");
 const result=inspectRenderedRichContent("<p>First</p>\n  <p>Second</p>",{parseFromString:()=>({body:{childNodes:[first,separator,second]}})});
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.equal(result.paragraphCount,2);
 assert.deepEqual(result.runs.map(run=>[run.paragraphIndex,run.text]),[[0,"First"],[1,"Second"]]);
});


test("preserves blockquote structure without counting it as a second paragraph",()=>{
 const quote={parseFromString:()=>({body:{childNodes:[node("BLOCKQUOTE",{},[node("P",{},[text("Quoted text")])])]}})};
 const result=inspectRenderedRichContent("<blockquote><p>Quoted text</p></blockquote>",quote);
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.equal(result.paragraphCount,1);
 assert.equal(result.runs[0].text,"Quoted text");
});


test("validates CSS float geometry against serialized Word placement metadata",()=>{
 const placement=normalizeDocxImagePlacement({
  kind:"floating",anchorAttributes:{behindDoc:"0",distL:"114300",distR:"114300",distT:"0",distB:"0"},
  horizontalPosition:'<wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH>',
  verticalPosition:'<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>',
  extent:'<wp:extent cx="1270000" cy="635000"/>',wrap:'<wp:wrapSquare wrapText="bothSides"/>',requiresVisualReview:true
 });
 const style='float:left;width:100pt;height:50pt;margin-left:-42pt;margin-right:9pt;margin-top:0pt;margin-bottom:0pt';
 const validParser={parseFromString:()=>({body:{childNodes:[node('P',{style:'margin-left:42pt'},[node('STRONG',{},[text('text')]),node('IMG',{src:'/assets/a.png',alt:'Diagram',style,'data-word-image-placement-json':JSON.stringify(placement)})])]}})};
 const valid=inspectRenderedRichContent('<p>fixture</p>',validParser);
 assert.equal(valid.ok,true,valid.errors.join('; '));
 assert.equal(valid.images[0].placement.kind,'floating');
 const badParser={parseFromString:()=>({body:{childNodes:[node('P',{style:'margin-left:42pt'},[node('STRONG',{},[text('text')]),node('IMG',{src:'/assets/a.png',alt:'Diagram',style:style.replace('float:left','float:right'),'data-word-image-placement-json':JSON.stringify(placement)})])]}})};
 const bad=inspectRenderedRichContent('<p>fixture</p>',badParser);
 assert.equal(bad.ok,false);
 assert.ok(bad.errors.some(error=>error.includes('CSS float differs')));
});
