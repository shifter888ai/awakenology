import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDocxRunFormatting} from './resolve-docx-styles.mjs';

const styles=(extra='')=>'<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:b w:val="0"/><w:color w:val="000000"/></w:rPr></w:rPrDefault></w:docDefaults>'+extra+'</w:styles>';
const paragraph=(style='')=>'<w:p><w:pPr>'+(style?'<w:pStyle w:val="'+style+'"/>':'')+'</w:pPr></w:p>';
const run=(style='',direct='')=>'<w:r>'+(style||direct?'<w:rPr>'+(style?'<w:rStyle w:val="'+style+'"/>':'')+direct+'</w:rPr>':'')+'<w:t>Text</w:t></w:r>';

test('resolves document defaults and paragraph style inheritance in base-to-derived order',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="Base"><w:rPr><w:i/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Derived"><w:basedOn w:val="Base"/><w:rPr><w:b/></w:rPr></w:style>');
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('Derived'),runXml:run()});
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.deepEqual(result.formatting,{b:true,i:true,u:false,color:'#000000',fontSizePt:null});
});

test('direct formatting overrides inherited formatting, including explicit off values',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="Emphasis"><w:rPr><w:b/><w:i/><w:color w:val="FF0000"/></w:rPr></w:style>');
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('Emphasis'),runXml:run('', '<w:b w:val="0"/><w:i w:val="false"/><w:color w:val="0000FF"/>')});
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.deepEqual(result.formatting,{b:false,i:false,u:false,color:'#0000ff',fontSizePt:null});
});

test('resolves character style over paragraph style and direct run formatting over both',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="P"><w:rPr><w:b/></w:rPr></w:style><w:style w:type="character" w:styleId="C"><w:basedOn w:val="MissingBase"/><w:rPr><w:i/><w:color w:val="FF0000"/></w:rPr></w:style>');
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('P'),runXml:run('C','<w:color w:val="00FF00"/>')});
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(x=>x.includes('Missing Word style MissingBase')));
});

test('blocks cyclic or missing style references rather than guessing',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="A"><w:basedOn w:val="B"/></w:style><w:style w:type="paragraph" w:styleId="B"><w:basedOn w:val="A"/></w:style>');
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('A'),runXml:run()});
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(x=>x.includes('Cyclic Word style inheritance')));
});

test('blocks theme colors and unsupported underline styles',()=>{
 const theme=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:color w:val="FF0000" w:themeColor="accent1"/>')});
 assert.equal(theme.ok,false);
 const underline=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:u w:val="dotted"/>')});
 assert.equal(underline.ok,false);
});

test('requires all source components',()=>{
 const result=resolveDocxRunFormatting({stylesXml:null,paragraphXml:'',runXml:''});
 assert.equal(result.ok,false);
 assert.equal(result.formatting,null);
});


test('preserves script-specific inherited font families',()=>{
 const fonts=resolveDocxRunFormatting({
  stylesXml:styles('<w:style w:type="paragraph" w:styleId="P"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Yu Gothic" w:cs="Arial"/><w:sz w:val="24"/></w:rPr></w:style>'),
  paragraphXml:paragraph('P'),runXml:run()
 });
 assert.equal(fonts.ok,true,fonts.errors.join('; '));
 assert.deepEqual(fonts.formatting.fontFamily,{ascii:'Arial',hAnsi:'Arial',eastAsia:'Yu Gothic',cs:'Arial'});
});


test('does not apply paragraph-mark formatting to paragraph text runs',()=>{
 const result=resolveDocxRunFormatting({
  stylesXml:styles(),
  paragraphXml:'<w:p><w:pPr><w:rPr><w:b/></w:rPr></w:pPr></w:p>',
  runXml:run()
 });
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.equal(result.formatting.b,false);
});


test('rejects a character style used as a paragraph style',()=>{
 const result=resolveDocxRunFormatting({
  stylesXml:styles('<w:style w:type="character" w:styleId="Wrong"><w:rPr><w:b/></w:rPr></w:style>'),
  paragraphXml:paragraph('Wrong'),runXml:run()
 });
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(x=>x.includes('expected paragraph')));
});


test('resolves Word font size from half-points and applies direct overrides',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="P"><w:rPr><w:sz w:val="28"/></w:rPr></w:style>');
 const inherited=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('P'),runXml:run()});
 assert.equal(inherited.ok,true,inherited.errors.join('; '));
 assert.equal(inherited.formatting.fontSizePt,14);
 const direct=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('P'),runXml:run('', '<w:sz w:val="20"/>')});
 assert.equal(direct.ok,true,direct.errors.join('; '));
 assert.equal(direct.formatting.fontSizePt,10);
});

test('blocks malformed or zero Word font sizes',()=>{
 const result=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:sz w:val="0"/>')});
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(x=>x.includes('Unsupported inherited Word formatting: fontSizePt')));
});


test('direct unsupported run formatting cannot be silently dropped',()=>{
 for(const property of ['<w:rFonts w:asciiTheme="minorHAnsi"/>','<w:lang/>','<w:spacing/>','<w:szCs w:val="0"/>']) {
  const result=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('',property)});
  assert.equal(result.ok,false,property);
  assert.ok(result.errors.some(x=>x.includes('Unsupported direct run property') || x.includes('Unsupported inherited Word formatting')),result.errors.join('; '));
 }
});

test('rejects unsupported formatting in an inherited base even when a derived style overrides it',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="Base"><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Derived"><w:basedOn w:val="Base"/><w:rPr><w:b/></w:rPr></w:style>');
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('Derived'),runXml:run()});
 assert.equal(result.ok,false);
 assert.equal(result.formatting,null);
 assert.ok(result.errors.some(x=>x.includes('Unsupported inherited Word formatting: fontFamily')));
});
test('rejects unsupported direct formatting even when its value resembles an inherited supported property',()=>{
 const result=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:sz w:val="24"/><w:lang/>')});
 assert.equal(result.ok,false);
 assert.equal(result.formatting,null);
 assert.ok(result.errors.some(x=>x.includes('Unsupported inherited Word formatting: language')));
});

test("resolves consistent Word font families, language metadata, complex-script aliases, caps and character spacing", () => {
 const xml=styles('<w:style w:type="paragraph" w:styleId="P"><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:hAnsi="Microsoft YaHei" w:eastAsia="Microsoft YaHei" w:cs="Microsoft YaHei"/><w:lang w:val="en-US" w:eastAsia="zh-CN"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:b/><w:bCs/><w:i w:val="0"/><w:iCs w:val="0"/><w:caps/><w:spacing w:val="20"/></w:rPr></w:style>');
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('P'),runXml:run()});
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.deepEqual(result.formatting.fontFamily,{ascii:'Microsoft YaHei',hAnsi:'Microsoft YaHei',eastAsia:'Microsoft YaHei',cs:'Microsoft YaHei'});
 assert.deepEqual(result.formatting.language,{val:'en-US',eastAsia:'zh-CN'});
 assert.equal(result.formatting.fontSizePt,11);
 assert.equal(result.formatting.fontSizeCsPt,11);
 assert.equal(result.formatting.bCs,true);
 assert.equal(result.formatting.iCs,false);
 assert.equal(result.formatting.caps,true);
 assert.equal(result.formatting.letterSpacingPt,1);
});
test("preserves script-specific font families and complex-script emphasis", () => {
 const fonts=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:rFonts w:ascii="Arial" w:eastAsia="Yu Gothic"/>')});
 assert.equal(fonts.ok,true,fonts.errors.join('; '));
 assert.deepEqual(fonts.formatting.fontFamily,{ascii:'Arial',eastAsia:'Yu Gothic'});
 const script=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:bCs/>')});
 assert.equal(script.ok,true,script.errors.join('; '));
 assert.equal(script.formatting.b,false);
 assert.equal(script.formatting.bCs,true);
});

test('direct formatting overrides inherited formatting, including explicit off values',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="Emphasis"><w:rPr><w:b/><w:i/><w:color w:val="FF0000"/></w:rPr></w:style>');
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('Emphasis'),runXml:run('', '<w:b w:val="0"/><w:i w:val="false"/><w:color w:val="0000FF"/>')});
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.deepEqual(result.formatting,{b:false,i:false,u:false,color:'#0000ff',fontSizePt:null});
});

test('resolves character style over paragraph style and direct run formatting over both',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="P"><w:rPr><w:b/></w:rPr></w:style><w:style w:type="character" w:styleId="C"><w:basedOn w:val="MissingBase"/><w:rPr><w:i/><w:color w:val="FF0000"/></w:rPr></w:style>');
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('P'),runXml:run('C','<w:color w:val="00FF00"/>')});
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(x=>x.includes('Missing Word style MissingBase')));
});

test('blocks cyclic or missing style references rather than guessing',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="A"><w:basedOn w:val="B"/></w:style><w:style w:type="paragraph" w:styleId="B"><w:basedOn w:val="A"/></w:style>');
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('A'),runXml:run()});
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(x=>x.includes('Cyclic Word style inheritance')));
});

test('blocks theme colors and unsupported underline styles',()=>{
 const theme=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:color w:val="FF0000" w:themeColor="accent1"/>')});
 assert.equal(theme.ok,false);
 const underline=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:u w:val="dotted"/>')});
 assert.equal(underline.ok,false);
});

test('requires all source components',()=>{
 const result=resolveDocxRunFormatting({stylesXml:null,paragraphXml:'',runXml:''});
 assert.equal(result.ok,false);
 assert.equal(result.formatting,null);
});


test('preserves script-specific inherited font families',()=>{
 const fonts=resolveDocxRunFormatting({
  stylesXml:styles('<w:style w:type="paragraph" w:styleId="P"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Yu Gothic" w:cs="Arial"/><w:sz w:val="24"/></w:rPr></w:style>'),
  paragraphXml:paragraph('P'),runXml:run()
 });
 assert.equal(fonts.ok,true,fonts.errors.join('; '));
 assert.deepEqual(fonts.formatting.fontFamily,{ascii:'Arial',hAnsi:'Arial',eastAsia:'Yu Gothic',cs:'Arial'});
});


test('does not apply paragraph-mark formatting to paragraph text runs',()=>{
 const result=resolveDocxRunFormatting({
  stylesXml:styles(),
  paragraphXml:'<w:p><w:pPr><w:rPr><w:b/></w:rPr></w:pPr></w:p>',
  runXml:run()
 });
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.equal(result.formatting.b,false);
});


test('rejects a character style used as a paragraph style',()=>{
 const result=resolveDocxRunFormatting({
  stylesXml:styles('<w:style w:type="character" w:styleId="Wrong"><w:rPr><w:b/></w:rPr></w:style>'),
  paragraphXml:paragraph('Wrong'),runXml:run()
 });
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(x=>x.includes('expected paragraph')));
});


test('resolves Word font size from half-points and applies direct overrides',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="P"><w:rPr><w:sz w:val="28"/></w:rPr></w:style>');
 const inherited=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('P'),runXml:run()});
 assert.equal(inherited.ok,true,inherited.errors.join('; '));
 assert.equal(inherited.formatting.fontSizePt,14);
 const direct=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('P'),runXml:run('', '<w:sz w:val="20"/>')});
 assert.equal(direct.ok,true,direct.errors.join('; '));
 assert.equal(direct.formatting.fontSizePt,10);
});

test('blocks malformed or zero Word font sizes',()=>{
 const result=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:sz w:val="0"/>')});
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(x=>x.includes('Unsupported inherited Word formatting: fontSizePt')));
});


test('direct unsupported run formatting cannot be silently dropped',()=>{
 for(const property of ['<w:rFonts w:asciiTheme="minorHAnsi"/>','<w:lang/>','<w:spacing/>','<w:szCs w:val="0"/>']) {
  const result=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('',property)});
  assert.equal(result.ok,false,property);
  assert.ok(result.errors.some(x=>x.includes('Unsupported direct run property') || x.includes('Unsupported inherited Word formatting')),result.errors.join('; '));
 }
});

test('rejects unsupported formatting in an inherited base even when a derived style overrides it',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="Base"><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Derived"><w:basedOn w:val="Base"/><w:rPr><w:b/></w:rPr></w:style>');
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('Derived'),runXml:run()});
 assert.equal(result.ok,false);
 assert.equal(result.formatting,null);
 assert.ok(result.errors.some(x=>x.includes('Unsupported inherited Word formatting: fontFamily')));
});
test('rejects unsupported direct formatting even when its value resembles an inherited supported property',()=>{
 const result=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:sz w:val="24"/><w:lang/>')});
 assert.equal(result.ok,false);
 assert.equal(result.formatting,null);
 assert.ok(result.errors.some(x=>x.includes('Unsupported inherited Word formatting: language')));
});

test("resolves consistent Word font families, language metadata, complex-script aliases, caps and character spacing", () => {
 const xml=styles('<w:style w:type="paragraph" w:styleId="P"><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:hAnsi="Microsoft YaHei" w:eastAsia="Microsoft YaHei" w:cs="Microsoft YaHei"/><w:lang w:val="en-US" w:eastAsia="zh-CN"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:b/><w:bCs/><w:i w:val="0"/><w:iCs w:val="0"/><w:caps/><w:spacing w:val="20"/></w:rPr></w:style>');
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('P'),runXml:run()});
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.deepEqual(result.formatting.fontFamily,{ascii:'Microsoft YaHei',hAnsi:'Microsoft YaHei',eastAsia:'Microsoft YaHei',cs:'Microsoft YaHei'});
 assert.deepEqual(result.formatting.language,{val:'en-US',eastAsia:'zh-CN'});
 assert.equal(result.formatting.fontSizePt,11);
 assert.equal(result.formatting.fontSizeCsPt,11);
 assert.equal(result.formatting.bCs,true);
 assert.equal(result.formatting.iCs,false);
 assert.equal(result.formatting.caps,true);
 assert.equal(result.formatting.letterSpacingPt,1);
});
test("preserves script-specific font families and blocks script-style divergence", () => {
 const fonts=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:rFonts w:ascii="Arial" w:eastAsia="Yu Gothic"/>')});
 assert.equal(fonts.ok,true,fonts.errors.join('; '));
 assert.deepEqual(fonts.formatting.fontFamily,{ascii:'Arial',eastAsia:'Yu Gothic'});
 const script=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:bCs/>')});
 assert.equal(script.ok,true,script.errors.join('; '));
 assert.equal(script.formatting.b,false);
 assert.equal(script.formatting.bCs,true);
});

test("maps Word kerning threshold to CSS when effective font size is known", () => {
 const result=resolveDocxRunFormatting({stylesXml:styles('<w:style w:type="paragraph" w:styleId="P"><w:rPr><w:sz w:val="22"/><w:kern w:val="2"/></w:rPr></w:style>'),paragraphXml:paragraph('P'),runXml:run()});
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.equal(result.formatting.fontKerningThresholdPt,1);
 assert.equal(result.formatting.fontKerning,'normal');
});


test("rejects unmodeled Word font and language attributes rather than silently discarding them",()=>{
 for (const property of ['<w:rFonts w:ascii="Arial" w:asciiTheme="minorHAnsi"/>','<w:rFonts w:ascii="Arial" w:unexpected="value"/>','<w:lang w:val="en-US" w:unexpected="value"/>']) {
  const result=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('',property)});
  assert.equal(result.ok,false,property);
  assert.equal(result.formatting,null);
 }
});


test("rejects duplicate Word font and language attributes",()=>{
 for(const property of ['<w:rFonts w:ascii="Arial" w:ascii="Times New Roman"/>','<w:lang w:val="en-US" w:val="ja-JP"/>']) {
  const result=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('',property)});
  assert.equal(result.ok,false,property);
  assert.equal(result.formatting,null);
 }
});


test("rejects unknown and duplicate attributes on color and boolean run properties",()=>{
 for(const property of ['<w:color w:val="FF0000" w:unknown="x"/>','<w:color w:val="FF0000" w:val="00FF00"/>','<w:b w:val="1" w:unknown="x"/>','<w:i w:val="1" w:val="0"/>']) {
  const result=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('',property)});
  assert.equal(result.ok,false,property);
  assert.equal(result.formatting,null);
 }
});


test("rejects duplicate or unknown numeric typography attributes",()=>{
 for(const property of ['<w:sz w:val="22" w:val="24"/>','<w:szCs w:val="22" w:unknown="x"/>','<w:spacing w:val="20" w:val="40"/>','<w:kern w:val="2" w:unknown="x"/>']) {
  const result=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('',property)});
  assert.equal(result.ok,false,property);
  assert.equal(result.formatting,null);
 }
});


test("does not certify non-self-closing run properties without checking their bodies",()=>{
 for(const property of ['<w:b><w:unknown/></w:b>','<w:color w:val="FF0000"><w:unknown/></w:color>']) {
  const result=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('',property)});
  assert.equal(result.ok,false,property);
  assert.equal(result.formatting,null);
 }
});

test('resolves paragraph-mark font metadata separately from visible text formatting',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="Base"><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Yu Gothic" w:cs="Arial"/><w:lang w:val="en-US" w:eastAsia="ja-JP"/></w:rPr></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Derived"><w:basedOn w:val="Base"/></w:style>');
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:'<w:p><w:pPr><w:pStyle w:val="Derived"/><w:rPr><w:rFonts w:eastAsia="Noto Sans CJK JP"/></w:rPr></w:pPr></w:p>',runXml:run()});
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.equal(result.formatting.fontFamily,undefined);
 assert.deepEqual(result.paragraphMarkFormatting.fontFamily,{ascii:'Arial',hAnsi:'Arial',eastAsia:'Noto Sans CJK JP',cs:'Arial'});
 assert.deepEqual(result.paragraphMarkFormatting.language,{val:'en-US',eastAsia:'ja-JP'});
});

test('uses the document default paragraph style when a paragraph has no explicit pStyle',()=>{
 const xml=styles('<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Yu Gothic"/><w:lang w:val="en-US"/><w:sz w:val="24"/></w:rPr></w:style>');
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:'<w:p><w:pPr/><w:r><w:t>Text</w:t></w:r></w:p>',runXml:run()});
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.deepEqual(result.formatting.fontFamily,{ascii:'Arial',hAnsi:'Arial',eastAsia:'Yu Gothic'});
 assert.equal(result.formatting.fontSizePt,12);
 assert.deepEqual(result.paragraphMarkFormatting.fontFamily,{ascii:'Arial',hAnsi:'Arial',eastAsia:'Yu Gothic'});
 assert.deepEqual(result.paragraphMarkFormatting.language,{val:'en-US'});
});


test('merges font-family and language attributes instead of erasing inherited scripts',()=>{
 const xml='<w:styles xmlns:w="x"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Yu Gothic"/><w:lang w:val="en-US" w:eastAsia="ja-JP"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>';
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:'<w:p/>',runXml:'<w:r><w:rPr><w:rFonts w:ascii="Inter"/><w:lang w:val="fr-FR"/></w:rPr><w:t>Text</w:t></w:r>'});
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.deepEqual(result.formatting.fontFamily,{ascii:'Inter',eastAsia:'Yu Gothic'});
 assert.deepEqual(result.formatting.language,{val:'fr-FR',eastAsia:'ja-JP'});
});


test("merges paragraph-mark fonts and languages across defaults, style, and direct overrides",()=>{
 const xml='<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="P"><w:pPr><w:rPr><w:rFonts w:eastAsia="Yu Gothic"/><w:lang w:eastAsia="ja-JP"/></w:rPr></w:pPr></w:style></w:styles>';
 const paragraphXml='<w:p><w:pPr><w:pStyle w:val="P"/><w:rPr><w:rFonts w:cs="Arial CS"/><w:lang w:bidi="ar-SA"/></w:rPr></w:pPr></w:p>';
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml,runXml:"<w:r/>"});
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.deepEqual(result.paragraphMarkFormatting.fontFamily,{ascii:"Arial",eastAsia:"Yu Gothic",cs:"Arial CS"});
 assert.deepEqual(result.paragraphMarkFormatting.language,{val:"en-US",eastAsia:"ja-JP",bidi:"ar-SA"});
});


test("treats a Word font hint without family values as selection metadata",()=>{
 const result=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run("",'<w:rFonts w:hint="default"/>')});
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.equal(result.formatting.fontFamily,undefined);
 assert.equal(result.formatting.fontHint,"default");
});


test("allows complete explicit script fonts to override unresolved inherited theme fonts",()=>{
 const xml='<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>';
 const direct='<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Yu Gothic" w:cs="Arial"/>';
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph(),runXml:run("",direct)});
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.deepEqual(result.formatting.fontFamily,{ascii:"Arial",hAnsi:"Arial",eastAsia:"Yu Gothic",cs:"Arial"});
});

test("keeps unresolved inherited theme fonts blocking when a direct override is partial",()=>{
 const xml='<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>';
 const japaneseRun='<w:r><w:rPr><w:rFonts w:ascii="Arial"/></w:rPr><w:t>日本語</w:t></w:r>';
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph(),runXml:japaneseRun});
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(error=>error.includes("Unsupported inherited Word formatting: fontFamily")));
});


test("returns paragraph-mark metadata even when visible text inherits an unresolved theme font",()=>{
 const xml='<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>';
 const paragraphXml='<w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Yu Gothic" w:cs="Arial"/></w:rPr></w:pPr></w:p>';
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml,runXml:"<w:r/>"});
 assert.equal(result.ok,false);
 assert.deepEqual(result.paragraphMarkFormatting.fontFamily,{ascii:"Arial",hAnsi:"Arial",eastAsia:"Yu Gothic",cs:"Arial"});
});


test("resolves Word theme fonts by language and script",()=>{
 const stylesXml='<w:styles><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia" w:cstheme="minorBidi"/><w:lang w:val="en-US" w:eastAsia="ja-JP" w:bidi="ar-SA"/></w:rPr></w:style></w:styles>';
 const themeXml='<a:theme><a:themeElements><a:fontScheme><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/><a:font script="Jpan" typeface="MS Gothic"/></a:majorFont><a:minorFont><a:latin typeface="Century"/><a:ea typeface=""/><a:cs typeface=""/><a:font script="Jpan" typeface="MS Mincho"/><a:font script="Hans" typeface="SimSun"/><a:font script="Hant" typeface="MingLiU"/><a:font script="Arab" typeface="Arial"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>';
 const result=resolveDocxRunFormatting({stylesXml,paragraphXml:paragraph("Normal"),runXml:run(),themeXml});
 assert.equal(result.ok,true,result.errors.join("; "));
 assert.deepEqual(result.formatting.fontFamily,{ascii:"Century",hAnsi:"Century",eastAsia:"MS Mincho",cs:"Arial"});
});

test("blocks an unresolved East Asian theme font when the source run uses East Asian text",()=>{
 const stylesXml='<w:styles><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia"/><w:lang w:val="en-US"/></w:rPr></w:style></w:styles>';
 const themeXml='<a:theme><a:themeElements><a:fontScheme><a:minorFont><a:latin typeface="Century"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme></a:themeElements></a:theme>';
 const japaneseRun='<w:r><w:t>日本語</w:t></w:r>';
 const result=resolveDocxRunFormatting({stylesXml,paragraphXml:paragraph("Normal"),runXml:japaneseRun,themeXml});
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(error=>error.includes("fontFamily (eastAsia theme unresolved)")));
});
