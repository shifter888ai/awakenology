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
test("blocks font-family fallback differences and script-specific style divergence", () => {
 const fonts=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:rFonts w:ascii="Arial" w:eastAsia="Yu Gothic"/>')});
 assert.equal(fonts.ok,false);
 assert.ok(fonts.errors.some(x=>x.includes('fontFamily')));
 const script=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:bCs/>')});
 assert.equal(script.ok,false);
 assert.ok(script.errors.some(x=>x.includes('Complex-script bold differs')));
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
test("blocks font-family fallback differences and script-specific style divergence", () => {
 const fonts=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:rFonts w:ascii="Arial" w:eastAsia="Yu Gothic"/>')});
 assert.equal(fonts.ok,false);
 assert.ok(fonts.errors.some(x=>x.includes('fontFamily')));
 const script=resolveDocxRunFormatting({stylesXml:styles(),paragraphXml:paragraph(),runXml:run('', '<w:bCs/>')});
 assert.equal(script.ok,false);
 assert.ok(script.errors.some(x=>x.includes('Complex-script bold differs')));
});
