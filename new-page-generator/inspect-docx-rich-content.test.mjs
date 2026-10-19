import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {inspectDocxRichContent} from './inspect-docx-rich-content.mjs';
async function fixture(body,stylesXml='<w:styles xmlns:w="x"><w:docDefaults><w:rPrDefault><w:rPr/></w:rPrDefault></w:docDefaults></w:styles>'){const z=new JSZip();z.file('word/document.xml','<w:document xmlns:w="x"><w:body>'+body+'</w:body></w:document>');z.file('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');z.file('word/styles.xml',stylesXml);z.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');return z.generateAsync({type:'nodebuffer'});}
test('reads exact Traditional Chinese and explicit run formatting',async()=>{
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:rPr><w:b/><w:color w:val="FF0000"/></w:rPr><w:t>什麽</w:t></w:r></w:p>'));
 assert.equal(r.ok,true,r.errors.join('; '));assert.deepEqual(r.runs,[{paragraphIndex:0,text:'什麽',bold:true,italic:false,underline:false,color:'#ff0000',fontSizePt:null,href:null}]);
});
test('does not guess hyperlink inheritance',async()=>assert.equal((await inspectDocxRichContent(await fixture('<w:p><w:hyperlink r:id="rId1"><w:r><w:t>link</w:t></w:r></w:hyperlink></w:p>'))).ok,false));
test('does not certify embedded drawings without asset mapping',async()=>assert.equal((await inspectDocxRichContent(await fixture('<w:p><w:r><w:drawing><a:blip r:embed="rId2"/></w:drawing></w:r></w:p>'))).ok,false));

test('image-only run does not create a false text-run error',async()=>{const z=new JSZip();z.file('word/document.xml','<w:document xmlns:w="w" xmlns:r="r" xmlns:wp="wp" xmlns:a="a"><w:body><w:p><w:r><w:t>Before</w:t></w:r><w:r><w:drawing><wp:inline><wp:docPr id="1" descr="diagram"/><a:blip r:embed="rId2"/></wp:inline></w:drawing></w:r></w:p></w:body></w:document>');z.file('word/_rels/document.xml.rels','<Relationships><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/a.png"/></Relationships>');z.file('word/styles.xml','<w:styles xmlns:w="w"><w:docDefaults><w:rPrDefault><w:rPr/></w:rPrDefault></w:docDefaults></w:styles>');z.file('[Content_Types].xml','<Types><Default Extension="png" ContentType="image/png"/></Types>');z.file('word/media/a.png',Buffer.from([137,80,78,71,13,10,26,10]));const r=await inspectDocxRichContent(await z.generateAsync({type:'nodebuffer'}));assert.equal(r.ok,true,r.errors.join('; '));assert.equal(r.images.length,1);assert.equal(r.images[0].paragraphIndex,0);assert.equal(r.images[0].textOffset,6);assert.equal(r.images[0].markerOrder,0);});

test('decodes decimal and hexadecimal XML character references exactly',async()=>{
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:t>A&#x4E2D;&#25991; &amp; B</w:t></w:r></w:p>'));
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.runs.map(x=>x.text),['A中文 & B']);
});


test('honors explicitly disabled bold, italic, and underline flags',async()=>{
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:rPr><w:b w:val="0"/><w:i w:val="false"/><w:u w:val="none"/></w:rPr><w:t>Plain</w:t></w:r></w:p>'));
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.runs,[{paragraphIndex:0,text:'Plain',bold:false,italic:false,underline:false,color:null,fontSizePt:null,href:null}]);
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


test('blocks paragraph layout and table semantics in independent rich inventory',async()=>{
 const layout=await inspectDocxRichContent(await fixture('<w:p><w:pPr><w:ind w:left="720"/><w:jc w:val="center"/><w:keepNext/></w:pPr><w:r><w:t>Layout</w:t></w:r></w:p>'));
 assert.equal(layout.ok,false);
 assert.ok(layout.errors.some(x=>x.includes('Unresolved OOXML feature w:ind')));
 assert.ok(layout.errors.some(x=>x.includes('Unresolved OOXML feature w:jc')));
 assert.ok(layout.errors.some(x=>x.includes('Unresolved OOXML feature w:keepNext')));
 const table=await inspectDocxRichContent(await fixture('<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'));
 assert.equal(table.ok,false);
 assert.ok(table.errors.some(x=>x.includes('Unresolved OOXML feature w:tbl')));
});


test('uses resolved inherited formatting in rich-content runs while keeping style review blocked',async()=>{
 const styles='<w:styles xmlns:w="x"><w:docDefaults><w:rPrDefault><w:rPr><w:color w:val="000000"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Base"><w:rPr><w:i/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="List"><w:basedOn w:val="Base"/><w:rPr><w:b/></w:rPr></w:style></w:styles>';
 const r=await inspectDocxRichContent(await fixture('<w:p><w:pPr><w:pStyle w:val="List"/></w:pPr><w:r><w:t>Styled</w:t></w:r></w:p>',styles));
 assert.equal(r.ok,false);
 assert.deepEqual({bold:r.runs[0].bold,italic:r.runs[0].italic,underline:r.runs[0].underline,color:r.runs[0].color},{bold:true,italic:true,underline:false,color:'#000000'});
 assert.ok(r.errors.some(x=>x.includes('Unresolved OOXML feature w:pStyle')));
});


test('reports shared inherited-style blockers once rather than once per paragraph',async()=>{
 const styles='<w:styles xmlns:w="x"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>';
 const r=await inspectDocxRichContent(await fixture('<w:p><w:r><w:t>One</w:t></w:r></w:p><w:p><w:r><w:t>Two</w:t></w:r></w:p>',styles));
 assert.equal(r.ok,false);
 assert.equal(r.errors.filter(x=>x==='Unsupported document-default run property w:rFonts.').length,1);
});
