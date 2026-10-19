import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {inspectDocxImagePlacement} from './inspect-docx-image-placement.mjs';
async function fixture(){const z=new JSZip();z.file('word/document.xml','<w:document xmlns:w="w" xmlns:r="r" xmlns:wp="wp" xmlns:a="a"><w:body><w:p><w:r><w:t>Before</w:t></w:r><w:r><w:drawing><wp:inline><wp:docPr id="1" descr="diagram"/><a:blip r:embed="rId1"/></wp:inline></w:drawing></w:r></w:p><w:p><w:r><w:t>After</w:t></w:r></w:p></w:body></w:document>');z.file('word/_rels/document.xml.rels','<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/diagram.png"/></Relationships>');z.file('[Content_Types].xml','<Types><Default Extension="png" ContentType="image/png"/></Types>');z.file('word/media/diagram.png',Buffer.from([137,80,78,71,13,10,26,10]));return z.generateAsync({type:'nodebuffer'});}
test('maps relationship to exact paragraph and hashed asset',async()=>{const r=await inspectDocxImagePlacement(await fixture());assert.equal(r.ok,true,r.errors.join(';'));assert.equal(r.images.length,1);assert.equal(r.images[0].paragraphIndex,0);assert.equal(r.images[0].alt,'diagram');assert.match(r.images[0].assetPath,/^\/assets\/docx-[a-f0-9]{16}\.png$/);});
test('blocks malformed source placement',async()=>{const b=await fixture();const z=await JSZip.loadAsync(b);z.file('word/document.xml','<w:document><w:body><w:p><w:drawing><wp:anchor/></w:drawing></w:p></w:body></w:document>');const r=await inspectDocxImagePlacement(await z.generateAsync({type:'nodebuffer'}));assert.equal(r.ok,false);});


test('preserves per-occurrence alt text when the same media relationship is reused',async()=>{
 const z=new JSZip();
 z.file('word/document.xml','<w:document xmlns:w="w" xmlns:r="r" xmlns:wp="wp" xmlns:a="a"><w:body><w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" descr="first alt"/><a:blip r:embed="rId1"/></wp:inline></w:drawing></w:r><w:r><w:drawing><wp:inline><wp:docPr id="2" descr="second alt"/><a:blip r:embed="rId1"/></wp:inline></w:drawing></w:r></w:p></w:body></w:document>');
 z.file('word/_rels/document.xml.rels','<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/diagram.png"/></Relationships>');
 z.file('[Content_Types].xml','<Types><Default Extension="png" ContentType="image/png"/></Types>');
 z.file('word/media/diagram.png',Buffer.from([137,80,78,71,13,10,26,10]));
 const result=await inspectDocxImagePlacement(await z.generateAsync({type:'nodebuffer'}));
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.deepEqual(result.images.map(x=>x.alt),['first alt','second alt']);
 assert.equal(result.images[0].assetPath,result.images[1].assetPath);
});


test('floating anchor retains explicit visual-review gate and geometry',async()=>{
 const z=new JSZip();
 z.file('word/document.xml','<w:document xmlns:w="w" xmlns:r="r" xmlns:wp="wp" xmlns:a="a"><w:body><w:p><w:r><w:drawing><wp:anchor distL="114300" distR="114300" behindDoc="0" allowOverlap="1"><wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:wrapSquare/><wp:docPr id="28" name="Picture 1"/><a:blip r:embed="rId1"/></wp:anchor></w:drawing></w:r></w:p></w:body></w:document>');
 z.file('word/_rels/document.xml.rels','<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/diagram.png"/></Relationships>');
 z.file('[Content_Types].xml','<Types><Default Extension="png" ContentType="image/png"/></Types>');
 z.file('word/media/diagram.png',Buffer.from([137,80,78,71,13,10,26,10]));
 const result=await inspectDocxImagePlacement(await z.generateAsync({type:'nodebuffer'}));
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.equal(result.images[0].placement.kind,'floating');
 assert.equal(result.images[0].placement.requiresVisualReview,true);
 assert.equal(result.images[0].placement.anchorAttributes.allowOverlap,'1');
 assert.match(result.images[0].placement.horizontalPosition, /<wp:positionH/);
 assert.match(result.images[0].placement.wrap, /wp:wrapSquare/);
});
