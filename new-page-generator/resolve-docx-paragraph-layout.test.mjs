import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDocxParagraphLayout} from './resolve-docx-paragraph-layout.mjs';
const styles=extra=>'<w:styles><w:docDefaults><w:pPrDefault><w:pPr><w:jc w:val="left"/></w:pPr></w:pPrDefault></w:docDefaults>'+extra+'</w:styles>';
const p=(id='',direct='')=>'<w:p><w:pPr>'+(id?'<w:pStyle w:val="'+id+'"/>':'')+direct+'</w:pPr></w:p>';
test('resolves supported direct alignment and indentation in twips',()=>{
 const r=resolveDocxParagraphLayout({stylesXml:styles(''),paragraphXml:p('', '<w:jc w:val="center"/><w:ind w:left="720" w:right="360" w:firstLine="240"/>')});
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.layout,{alignment:'center',indentation:{left:720,right:360,firstLine:240}});
});
test('inherits paragraph layout from base to derived style and applies direct overrides',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="Base"><w:pPr><w:jc w:val="right"/><w:ind w:left="720"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Derived"><w:basedOn w:val="Base"/><w:pPr><w:ind w:right="240"/></w:pPr></w:style>');
 const r=resolveDocxParagraphLayout({stylesXml:xml,paragraphXml:p('Derived','<w:jc w:val="center"/>')});
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.layout,{alignment:'center',indentation:{left:720,right:240}});
});
test('fails closed on missing/cyclic styles and unsupported paragraph properties',()=>{
 const missing=resolveDocxParagraphLayout({stylesXml:styles(''),paragraphXml:p('NoSuchStyle')});
 assert.equal(missing.ok,false); assert.ok(missing.errors.some(x=>x.includes('Missing Word paragraph style')));
 const cyclic=resolveDocxParagraphLayout({stylesXml:styles('<w:style w:type="paragraph" w:styleId="A"><w:basedOn w:val="B"/></w:style><w:style w:type="paragraph" w:styleId="B"><w:basedOn w:val="A"/></w:style>'),paragraphXml:p('A')});
 assert.equal(cyclic.ok,false); assert.ok(cyclic.errors.some(x=>x.includes('Cyclic')));
 const unsupported=resolveDocxParagraphLayout({stylesXml:styles(''),paragraphXml:p('', '<w:keepNext/>')});
 assert.equal(unsupported.ok,false); assert.ok(unsupported.errors.some(x=>x.includes('w:keepNext')));
});
test('blocks invalid alignment, character-based indentation and conflicting indent modes',()=>{
 for(const direct of ['<w:jc w:val="diagonal"/>','<w:ind w:leftChars="100"/>','<w:ind w:firstLine="120" w:hanging="120"/>']) {
  const r=resolveDocxParagraphLayout({stylesXml:styles(''),paragraphXml:p('',direct)});
  assert.equal(r.ok,false,direct);
 }
});
