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
 assert.deepEqual(r.images,[{assetPath:'asset.png',paragraphIndex:0,order:0,alt:'Diagram'}]);
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
 assert.deepEqual(r.lineBreaks,[{paragraphIndex:0,textOffset:1,breakType:'textWrapping'}]);
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
