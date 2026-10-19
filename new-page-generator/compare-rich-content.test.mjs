import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRichContent} from './compare-rich-content.mjs';
const sample = () => ({
  runs: [{paragraphIndex:0,text:'什麽',bold:true,italic:false,underline:false,color:'#ff0000',fontSizePt:null,href:'https://example.org'}],
  images: [{assetPath:'assets/one.png',paragraphIndex:2,order:0,alt:'diagram',textOffset:12,markerOrder:0,placement:{kind:'inline'}}],
  lineBreaks: [],
  paragraphLayouts: [0,1,2].map(paragraphIndex=>({paragraphIndex,alignment:'left',indentation:{left:0,right:0}})),
  paragraphCount: 3
});
test('identical inventory passes', () => assert.equal(compareRichContent(sample(), sample()).ok, true));
for (const field of ['paragraphIndex','text','bold','italic','underline','color','fontSizePt','href']) {
  test('changed run ' + field + ' blocks', () => {
    const a=sample(), b=sample(); if (['bold','italic','underline'].includes(field)) b.runs[0][field]=!b.runs[0][field]; else if (field==='paragraphIndex') b.runs[0][field]=99; else if (field==='fontSizePt') b.runs[0][field]=15; else b.runs[0][field]='changed';
    assert.equal(compareRichContent(a,b).ok,false);
  });
}
for (const field of ['assetPath','paragraphIndex','order','alt','textOffset','markerOrder']) {
  test('changed image ' + field + ' blocks', () => {
    const a=sample(), b=sample(); b.images[0][field] = typeof b.images[0][field] === 'number' ? 99 : 'changed';
    assert.equal(compareRichContent(a,b).ok,false);
  });
}
test('missing image blocks', () => { const b=sample(); b.images=[]; assert.equal(compareRichContent(sample(),b).ok,false); });
test('incomplete source inventory throws', () => {const a=sample(); delete a.runs[0].color; assert.throws(()=>compareRichContent(a,sample()),/Incomplete/);});


test('reordered text runs block even when the same text is present',()=>{
 const source={runs:[{paragraphIndex:0,text:'A',bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null},{paragraphIndex:0,text:'B',bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null}],images:[],lineBreaks:[],paragraphLayouts:[{paragraphIndex:0,alignment:'left',indentation:{left:0,right:0}}],paragraphCount:1};
 const output={runs:[source.runs[1],source.runs[0]],images:[],lineBreaks:[],paragraphLayouts:[],paragraphCount:1};
 const result=compareRichContent(source,output);
 assert.equal(result.ok,false);
 assert.ok(result.issues.some(x=>x.kind==='runs-mismatch' && x.field==='text'));
});

test('extra output text run blocks',()=>{
 const source={runs:[],images:[],lineBreaks:[],paragraphLayouts:[],paragraphCount:0};
 const output={runs:[{paragraphIndex:0,text:'invented',bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null}],images:[],lineBreaks:[],paragraphLayouts:[],paragraphCount:1};
 assert.equal(compareRichContent(source,output).ok,false);
});

test('changed hyperlink target is reported explicitly',()=>{
 const source=sample(), output=sample(); output.runs[0].href='/different-target';
 const result=compareRichContent(source,output);
 assert.equal(result.ok,false);
 assert.ok(result.issues.some(x=>x.field==='href'));
});

test('rejects non-string text and non-boolean formatting fields',()=>{
 const a=sample(); a.runs[0].bold='false';
 assert.throws(()=>compareRichContent(a,sample()),/Invalid run field types/);
 const b=sample(); b.runs[0].text=42;
 assert.throws(()=>compareRichContent(sample(),b),/Invalid run field types/);
});
test('rejects invalid image positions and missing asset paths',()=>{
 const a=sample(); a.images[0].paragraphIndex=-1;
 assert.throws(()=>compareRichContent(a,sample()),/Invalid image field types/);
 const b=sample(); b.images[0].assetPath='';
 assert.throws(()=>compareRichContent(sample(),b),/Invalid image field types/);
});


test('compares source and rendered line-break offsets independently of text',()=>{
 const a={runs:[{paragraphIndex:0,text:'A',bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null},{paragraphIndex:0,text:'B',bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null}],images:[],lineBreaks:[{paragraphIndex:0,textOffset:1,breakType:'textWrapping',markerOrder:0}],paragraphLayouts:[{paragraphIndex:0,alignment:'left',indentation:{left:0,right:0}}],paragraphCount:1};
 const b=structuredClone(a);
 assert.equal(compareRichContent(a,b).ok,true);
 b.lineBreaks[0].textOffset=0;
 const result=compareRichContent(a,b);
 assert.equal(result.ok,false);
 assert.ok(result.issues.some(x=>x.kind==='line-break-mismatch' && x.field==='textOffset'));
});
test('blocks when one side omits line-break provenance',()=>{
 const a={runs:[],images:[],lineBreaks:[],paragraphLayouts:[],paragraphCount:0};
 const b={runs:[],images:[]};
 assert.throws(()=>compareRichContent(a,b),/Incomplete rich-content inventory/);
});


test('blocks identical text and styling moved to a different paragraph',()=>{
 const source={runs:[
  {paragraphIndex:0,text:'First',bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null},
  {paragraphIndex:1,text:'Second',bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null}
 ],images:[],lineBreaks:[],paragraphLayouts:[0,1].map(paragraphIndex=>({paragraphIndex,alignment:'left',indentation:{left:0,right:0}})),paragraphCount:2};
 const output={runs:[
  {paragraphIndex:0,text:'FirstSecond',bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null}
 ],images:[],lineBreaks:[],paragraphLayouts:[],paragraphCount:1};
 const result=compareRichContent(source,output);
 assert.equal(result.ok,false);
 assert.ok(result.issues.some(x=>x.kind==='runs-mismatch'));
});


test('blocks when both inventories omit line-break provenance',()=>{
 const source={runs:[],images:[]};
 assert.throws(()=>compareRichContent(source,{runs:[],images:[]}),/Incomplete rich-content inventory/);
});


test('blocks an image moved before or after paragraph text',()=>{
 const source=sample(), output=sample();
 output.images[0].textOffset=0;
 const result=compareRichContent(source,output);
 assert.equal(result.ok,false);
 assert.ok(result.issues.some(x=>x.kind==='images-mismatch' && x.field==='textOffset'));
});


test('detects image and line-break swaps when both share the same text offset',()=>{
 const source={
  runs:[{paragraphIndex:0,text:'A',bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null}],
  images:[{assetPath:'asset.png',paragraphIndex:0,order:0,alt:'diagram',textOffset:1,markerOrder:0,placement:{kind:'inline'}}],
  lineBreaks:[{paragraphIndex:0,textOffset:1,breakType:'textWrapping',markerOrder:1}],
  paragraphLayouts:[{paragraphIndex:0,alignment:'left',indentation:{left:0,right:0}}],
  paragraphCount:1
 };
 const output=structuredClone(source);
 output.images[0].markerOrder=1;
 output.lineBreaks[0].markerOrder=0;
 const result=compareRichContent(source,output);
 assert.equal(result.ok,false);
 assert.ok(result.issues.some(x=>x.field==='markerOrder'));
});


test('detects lost empty paragraphs even when text runs are unchanged',()=>{
 const source={runs:[{paragraphIndex:0,text:'Start',bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null}],images:[],lineBreaks:[],paragraphLayouts:[],paragraphCount:2};
 const output={runs:[{paragraphIndex:0,text:'Start',bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null}],images:[],lineBreaks:[],paragraphLayouts:[],paragraphCount:1};
 const result=compareRichContent(source,output);
 assert.equal(result.ok,false);
 assert.ok(result.issues.some(x=>x.kind==='paragraph-count'));
});


test('changed inline/floating image placement blocks',()=>{
 const source=sample(), output=sample(); output.images[0].placement={kind:'floating'};
 const result=compareRichContent(source,output);
 assert.equal(result.ok,false);
 assert.ok(result.issues.some(x=>x.field==='placement'));
});
