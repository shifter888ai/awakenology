import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRichContent} from './compare-rich-content.mjs';
const sample = () => ({
  runs: [{text:'什麽',bold:true,italic:false,underline:false,color:'#ff0000',href:'https://example.org'}],
  images: [{assetPath:'assets/one.png',paragraphIndex:2,order:0,alt:'diagram'}]
});
test('identical inventory passes', () => assert.equal(compareRichContent(sample(), sample()).ok, true));
for (const field of ['text','bold','italic','underline','color','href']) {
  test('changed run ' + field + ' blocks', () => {
    const a=sample(), b=sample(); b.runs[0][field] = field === 'bold' || field === 'italic' || field === 'underline' ? !b.runs[0][field] : 'changed';
    assert.equal(compareRichContent(a,b).ok,false);
  });
}
for (const field of ['assetPath','paragraphIndex','order','alt']) {
  test('changed image ' + field + ' blocks', () => {
    const a=sample(), b=sample(); b.images[0][field] = typeof b.images[0][field] === 'number' ? 99 : 'changed';
    assert.equal(compareRichContent(a,b).ok,false);
  });
}
test('missing image blocks', () => { const b=sample(); b.images=[]; assert.equal(compareRichContent(sample(),b).ok,false); });
test('incomplete source inventory throws', () => {const a=sample(); delete a.runs[0].color; assert.throws(()=>compareRichContent(a,sample()),/Incomplete/);});


test('reordered text runs block even when the same text is present',()=>{
 const source={runs:[{text:'A',bold:false,italic:false,underline:false,color:null,href:null},{text:'B',bold:false,italic:false,underline:false,color:null,href:null}],images:[]};
 const output={runs:[source.runs[1],source.runs[0]],images:[]};
 const result=compareRichContent(source,output);
 assert.equal(result.ok,false);
 assert.ok(result.issues.some(x=>x.kind==='runs-mismatch' && x.field==='text'));
});

test('extra output text run blocks',()=>{
 const source={runs:[],images:[]};
 const output={runs:[{text:'invented',bold:false,italic:false,underline:false,color:null,href:null}],images:[]};
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
 const a={runs:[{text:'A',bold:false,italic:false,underline:false,color:null,href:null},{text:'B',bold:false,italic:false,underline:false,color:null,href:null}],images:[],lineBreaks:[{paragraphIndex:0,textOffset:1,breakType:'textWrapping'}]};
 const b=structuredClone(a);
 assert.equal(compareRichContent(a,b).ok,true);
 b.lineBreaks[0].textOffset=0;
 const result=compareRichContent(a,b);
 assert.equal(result.ok,false);
 assert.ok(result.issues.some(x=>x.kind==='line-break-mismatch' && x.field==='textOffset'));
});
test('blocks when one side omits line-break provenance',()=>{
 const a={runs:[],images:[],lineBreaks:[]};
 const b={runs:[],images:[]};
 assert.equal(compareRichContent(a,b).ok,false);
});
