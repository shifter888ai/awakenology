import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectRenderedRichContent} from './inspect-rendered-rich-content.mjs';
const node=(tag,attrs={},children=[])=>({nodeType:1,tagName:tag,childNodes:children,getAttribute:key=>Object.hasOwn(attrs,key)?attrs[key]:null});
const text=value=>({nodeType:3,textContent:value});
const parser={parseFromString:()=>({body:{childNodes:[node('P',{},[node('STRONG',{},[text('什麽')]),node('A',{href:'/target'},[text(' link')]),node('IMG',{src:'asset.png',alt:'Diagram'})])]}})};
test('extracts formatting, links, image position from parsed HTML',()=>{
 const r=inspectRenderedRichContent('<p>fixture</p>',parser);
 assert.equal(r.ok,true,r.errors.join(';'));
 assert.equal(r.runs[0].bold,true);
 assert.equal(r.runs[0].text,'什麽');
 assert.equal(r.runs[1].href,'/target');
 assert.deepEqual(r.images,[{assetPath:'asset.png',paragraphIndex:0,order:0,alt:'Diagram',textOffset:7,markerOrder:0}]);
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
 assert.equal(heading.ok,false);
 assert.ok(heading.errors.some(x=>x.includes('semantic formatting tag: H1')));
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
 assert.deepEqual(r.paragraphLayouts,[{paragraphIndex:0,alignment:'center',indentation:{left:720,right:180,firstLine:360}}]);
});


test('maps negative CSS text-indent to Word hanging indentation',()=>{
 const hangingParser={parseFromString:()=>({body:{childNodes:[node('P',{style:'margin-left: 24pt; text-indent: -12pt'},[text('Hanging')])]}})};
 const r=inspectRenderedRichContent('<p style="margin-left:24pt;text-indent:-12pt">Hanging</p>',hangingParser);
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.paragraphLayouts,[{paragraphIndex:0,alignment:'left',indentation:{left:480,right:0,hanging:240}}]);
});
