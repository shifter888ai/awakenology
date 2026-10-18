import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {inspectDocxRichContent} from './inspect-docx-rich-content.mjs';
async function fixture(body){const z=new JSZip();z.file('word/document.xml','<w:document xmlns:w="x"><w:body>'+body+'</w:body></w:document>');return z.generateAsync({type:'nodebuffer'});}
test('reads exact Traditional Chinese and explicit run formatting',async()=>{
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:rPr><w:b/><w:color w:val="FF0000"/></w:rPr><w:t>什麽</w:t></w:r></w:p>'));
 assert.equal(r.ok,true,r.errors.join('; '));assert.deepEqual(r.runs,[{text:'什麽',bold:true,italic:false,underline:false,color:'#ff0000',href:null}]);
});
test('does not guess hyperlink inheritance',async()=>assert.equal((await inspectDocxRichContent(await fixture('<w:p><w:hyperlink r:id="rId1"><w:r><w:t>link</w:t></w:r></w:hyperlink></w:p>'))).ok,false));
test('does not certify embedded drawings without asset mapping',async()=>assert.equal((await inspectDocxRichContent(await fixture('<w:p><w:r><w:drawing><a:blip r:embed="rId2"/></w:drawing></w:r></w:p>'))).ok,false));
