import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {inspectDocxRichContent} from './inspect-docx-rich-content.mjs';
async function fixture(body){const z=new JSZip();z.file('word/document.xml','<w:document xmlns:w="x"><w:body>'+body+'</w:body></w:document>');z.file('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');z.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');return z.generateAsync({type:'nodebuffer'});}
test('reads exact Traditional Chinese and explicit run formatting',async()=>{
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:rPr><w:b/><w:color w:val="FF0000"/></w:rPr><w:t>什麽</w:t></w:r></w:p>'));
 assert.equal(r.ok,true,r.errors.join('; '));assert.deepEqual(r.runs,[{paragraphIndex:0,text:'什麽',bold:true,italic:false,underline:false,color:'#ff0000',href:null}]);
});
test('does not guess hyperlink inheritance',async()=>assert.equal((await inspectDocxRichContent(await fixture('<w:p><w:hyperlink r:id="rId1"><w:r><w:t>link</w:t></w:r></w:hyperlink></w:p>'))).ok,false));
test('does not certify embedded drawings without asset mapping',async()=>assert.equal((await inspectDocxRichContent(await fixture('<w:p><w:r><w:drawing><a:blip r:embed="rId2"/></w:drawing></w:r></w:p>'))).ok,false));

test('image-only run does not create a false text-run error',async()=>{const z=new JSZip();z.file('word/document.xml','<w:document xmlns:w="w" xmlns:r="r" xmlns:wp="wp" xmlns:a="a"><w:body><w:p><w:r><w:t>Before</w:t></w:r><w:r><w:drawing><wp:inline><wp:docPr id="1" descr="diagram"/><a:blip r:embed="rId2"/></wp:inline></w:drawing></w:r></w:p></w:body></w:document>');z.file('word/_rels/document.xml.rels','<Relationships><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/a.png"/></Relationships>');z.file('[Content_Types].xml','<Types><Default Extension="png" ContentType="image/png"/></Types>');z.file('word/media/a.png',Buffer.from([137,80,78,71,13,10,26,10]));const r=await inspectDocxRichContent(await z.generateAsync({type:'nodebuffer'}));assert.equal(r.ok,true,r.errors.join('; '));assert.equal(r.images.length,1);assert.equal(r.images[0].paragraphIndex,0);assert.equal(r.images[0].textOffset,6);assert.equal(r.images[0].markerOrder,0);});

test('decodes decimal and hexadecimal XML character references exactly',async()=>{
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:t>A&#x4E2D;&#25991; &amp; B</w:t></w:r></w:p>'));
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.runs.map(x=>x.text),['A中文 & B']);
});


test('honors explicitly disabled bold, italic, and underline flags',async()=>{
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:rPr><w:b w:val="0"/><w:i w:val="false"/><w:u w:val="none"/></w:rPr><w:t>Plain</w:t></w:r></w:p>'));
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.runs,[{paragraphIndex:0,text:'Plain',bold:false,italic:false,underline:false,color:null,href:null}]);
});


test('blocks theme-based Word colors until theme resolution is implemented',async()=>{
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:rPr><w:color w:val="FF0000" w:themeColor="accent1"/></w:rPr><w:t>Colored</w:t></w:r></w:p>'));
 assert.equal(r.ok,false);
 assert.ok(r.errors.some(x=>x.includes('Theme-based Word color')));
});


test('blocks unrecognized Word formatting values rather than flattening them',async()=>{
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:rPr><w:u w:val="dotted"/></w:rPr><w:t>Underlined</w:t></w:r></w:p>'));
 assert.equal(r.ok,false);
 assert.ok(r.errors.some(x=>x.includes('Unsupported Word u value')));
});


test('blocks paragraph and run styles until inherited formatting is resolved',async()=>{
 const paragraph=await inspectDocxRichContent(await fixture('<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Heading</w:t></w:r></w:p>'));
 assert.equal(paragraph.ok,false);
 assert.ok(paragraph.errors.some(x=>x.includes('Unresolved OOXML feature w:pStyle')));
 const run=await inspectDocxRichContent(await fixture('<w:p><w:r><w:rPr><w:rStyle w:val="Emphasis"/></w:rPr><w:t>Emphasized</w:t></w:r></w:p>'));
 assert.equal(run.ok,false);
 assert.ok(run.errors.some(x=>x.includes('Unresolved OOXML feature w:rStyle')));
});


test('reports exact unsupported run property names and paragraph locations',async()=>{
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="24"/></w:rPr><w:t>Styled</w:t></w:r></w:p><w:p><w:r><w:rPr><w:rFonts w:ascii="Arial"/></w:rPr><w:t>Again</w:t></w:r></w:p>'));
 assert.equal(r.ok,false);
 assert.ok(r.errors.some(x=>x.includes('Unresolved run property w:rFonts in 2 paragraph(s): 1, 2')));
 assert.ok(r.errors.some(x=>x.includes('Unresolved run property w:sz in 1 paragraph(s): 1')));
 assert.ok(!r.errors.some(x=>x==='Unresolved run property in paragraph 1.'));
});


test('maps text segments and line-break offset within a Word run',async()=>{
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:t>A</w:t><w:br/><w:t>B</w:t></w:r></w:p>'));
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.runs.map(x=>({paragraphIndex:x.paragraphIndex,text:x.text})),[{paragraphIndex:0,text:'A'},{paragraphIndex:0,text:'B'}]);
 assert.deepEqual(r.lineBreaks,[{paragraphIndex:0,textOffset:1,breakType:'textWrapping',markerOrder:0}]);
});


test('preserves source paragraph indices across adjacent identical runs',async()=>{
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:t>First</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r></w:p>'));
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.runs.map(x=>({paragraphIndex:x.paragraphIndex,text:x.text})),[
  {paragraphIndex:0,text:'First'},
  {paragraphIndex:1,text:'Second'}
 ]);
});
