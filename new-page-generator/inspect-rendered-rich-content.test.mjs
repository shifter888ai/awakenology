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
