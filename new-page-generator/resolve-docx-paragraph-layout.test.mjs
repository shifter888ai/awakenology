import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDocxParagraphLayout} from './resolve-docx-paragraph-layout.mjs';
const styles=extra=>'<w:styles><w:docDefaults><w:pPrDefault><w:pPr><w:jc w:val="left"/></w:pPr></w:pPrDefault></w:docDefaults>'+extra+'</w:styles>';
const p=(id='',direct='')=>'<w:p><w:pPr>'+(id?'<w:pStyle w:val="'+id+'"/>':'')+direct+'</w:pPr></w:p>';
test('resolves supported direct alignment and indentation in twips',()=>{
 const r=resolveDocxParagraphLayout({stylesXml:styles(''),paragraphXml:p('', '<w:jc w:val="center"/><w:ind w:left="720" w:right="360" w:firstLine="240"/>')});
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.layout,{alignment:'center',indentation:{left:720,right:360,firstLine:240},spacing:{beforePt:0,afterPt:0,lineHeightPt:null}});
});
test('inherits paragraph layout from base to derived style and applies direct overrides',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="Base"><w:pPr><w:jc w:val="right"/><w:ind w:left="720"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Derived"><w:basedOn w:val="Base"/><w:pPr><w:ind w:right="240"/></w:pPr></w:style>');
 const r=resolveDocxParagraphLayout({stylesXml:xml,paragraphXml:p('Derived','<w:jc w:val="center"/>')});
 assert.equal(r.ok,true,r.errors.join('; '));
 assert.deepEqual(r.layout,{alignment:'center',indentation:{left:720,right:240},spacing:{beforePt:0,afterPt:0,lineHeightPt:null}});
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


test('paragraph-mark run formatting is not misclassified as paragraph layout',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="Normal"><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="24"/></w:rPr></w:pPr></w:style>');
 const result=resolveDocxParagraphLayout({stylesXml:xml,paragraphXml:p('Normal','<w:rPr><w:b/><w:szCs w:val="24"/></w:rPr>')});
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.equal(result.layout.alignment,'center');
});

test("resolves exact Word line spacing and before/after spacing into point units", () => {
  const result = resolveDocxParagraphLayout({
    stylesXml: styles(""),
    paragraphXml: p("", '<w:spacing w:before="120" w:after="240" w:line="360" w:lineRule="exact"/>')
  });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.deepEqual(result.layout.spacing, {beforePt:6,afterPt:12,lineHeightPt:18});
});
test("maps automatic Word line spacing to a unitless CSS line-height", () => {
  const result = resolveDocxParagraphLayout({
    stylesXml: styles(""),
    paragraphXml: p("", '<w:spacing w:line="276" w:lineRule="auto"/>')
  });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.layout.spacing.lineHeight, 276 / 240);
});
test("blocks atLeast line spacing rather than treating it as a paragraph min-height", () => {
  const result = resolveDocxParagraphLayout({
    stylesXml: styles(""),
    paragraphXml: p("", '<w:spacing w:line="276" w:lineRule="atLeast"/>')
  });
  assert.equal(result.ok, false);
});

test('paragraph layout leaves active numbering to the independent numbering resolver',()=>{
 const disabled=resolveDocxParagraphLayout({stylesXml:styles(''),paragraphXml:p('', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr>')});
 assert.equal(disabled.ok,true,disabled.errors.join('; '));
 const active=resolveDocxParagraphLayout({stylesXml:styles(''),paragraphXml:p('', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')});
 assert.equal(active.ok,true,active.errors.join('; '));
 assert.ok(!active.errors.some(x=>x.includes('property w:ilvl')||x.includes('property w:numId')));
});


test('rejects unknown or duplicate paragraph layout attributes',()=>{
 for(const property of ['<w:jc w:val="left" w:unknown="x"/>','<w:jc w:val="left" w:val="right"/>','<w:ind w:left="720" w:unknown="x"/>','<w:spacing w:before="120" w:before="240"/>']) {
  const result=resolveDocxParagraphLayout({stylesXml:styles(''),paragraphXml:p('',property)});
  assert.equal(result.ok,false,property);
 }
});


test("treats zero character-based indentation as no indentation",()=>{
 const result=resolveDocxParagraphLayout({stylesXml:"<w:styles/>",paragraphXml:'<w:p><w:pPr><w:ind w:leftChars="0"/></w:pPr></w:p>'});
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.deepEqual(result.layout.indentation,{left:0,right:0,leftChars:0});
});


test("does not confuse paragraph-mark character spacing with paragraph spacing",()=>{
 const result=resolveDocxParagraphLayout({stylesXml:"<w:styles/>",paragraphXml:'<w:p><w:pPr><w:spacing w:line="360" w:lineRule="exact"/><w:rPr><w:spacing w:val="0"/></w:rPr></w:pPr></w:p>'});
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.deepEqual(result.layout.spacing,{beforePt:0,afterPt:0,lineHeightPt:18});
});


test("a direct zero character-indent overrides an inherited nonzero character-indent",()=>{
 const stylesXml='<w:styles><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:pPr><w:ind w:left="840" w:leftChars="400"/></w:pPr></w:style></w:styles>';
 const paragraphXml='<w:p><w:pPr><w:pStyle w:val="Normal"/><w:ind w:leftChars="0"/></w:pPr></w:p>';
 const result=resolveDocxParagraphLayout({stylesXml,paragraphXml});
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.equal(result.layout.indentation.left,840);
 assert.equal(result.layout.indentation.leftChars,0);
});
