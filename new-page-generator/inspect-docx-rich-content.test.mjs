import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {inspectDocxRichContent} from './inspect-docx-rich-content.mjs';
async function fixture(body){const z=new JSZip();z.file('word/document.xml','<w:document xmlns:w="x"><w:body>'+body+'</w:body></w:document>');z.file('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');z.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');return z.generateAsync({type:'nodebuffer'});}
test('reads exact Traditional Chinese and explicit run formatting',async()=>{
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:rPr><w:b/><w:color w:val="FF0000"/></w:rPr><w:t>什麽</w:t></w:r></w:p>'));
 assert.equal(r.ok,true,r.errors.join('; '));assert.deepEqual(r.runs,[{text:'什麽',bold:true,italic:false,underline:false,color:'#ff0000',href:null}]);
});
test('does not guess hyperlink inheritance',async()=>assert.equal((await inspectDocxRichContent(await fixture('<w:p><w:hyperlink r:id="rId1"><w:r><w:t>link</w:t></w:r></w:hyperlink></w:p>'))).ok,false));
test('does not certify embedded drawings without asset mapping',async()=>assert.equal((await inspectDocxRichContent(await fixture('<w:p><w:r><w:drawing><a:blip r:embed="rId2"/></w:drawing></w:r></w:p>'))).ok,false));

test('image-only run does not create a false text-run error',async()=>{const z=new JSZip();z.file('word/document.xml','<w:document xmlns:w="w" xmlns:r="r" xmlns:wp="wp" xmlns:a="a"><w:body><w:p><w:r><w:t>Before</w:t></w:r><w:r><w:drawing><wp:inline><wp:docPr id="1" descr="diagram"/><a:blip r:embed="rId2"/></wp:inline></w:drawing></w:r></w:p></w:body></w:document>');z.file('word/_rels/document.xml.rels','<Relationships><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/a.png"/></Relationships>');z.file('[Content_Types].xml','<Types><Default Extension="png" ContentType="image/png"/></Types>');z.file('word/media/a.png',Buffer.from([137,80,78,71,13,10,26,10]));const r=await inspectDocxRichContent(await z.generateAsync({type:'nodebuffer'}));assert.equal(r.ok,true,r.errors.join('; '));assert.equal(r.images.length,1);assert.equal(r.images[0].paragraphIndex,0);});

test('decodes decimal and hexadecimal XML character references exactly',async()=>{
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:t>A&#x4E2D;&#25991; &amp; B</w:t></w:r></w:p>'));
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.runs.map(x=>x.text),['A中文 & B']);
});
