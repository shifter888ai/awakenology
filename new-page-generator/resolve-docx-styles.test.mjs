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
 assert.deepEqual(result.formatting,{b:true,i:true,u:false,color:'#000000'});
});

test('direct formatting overrides inherited formatting, including explicit off values',()=>{
 const xml=styles('<w:style w:type="paragraph" w:styleId="Emphasis"><w:rPr><w:b/><w:i/><w:color w:val="FF0000"/></w:rPr></w:style>');
 const result=resolveDocxRunFormatting({stylesXml:xml,paragraphXml:paragraph('Emphasis'),runXml:run('', '<w:b w:val="0"/><w:i w:val="false"/><w:color w:val="0000FF"/>')});
 assert.equal(result.ok,true,result.errors.join('; '));
 assert.deepEqual(result.formatting,{b:false,i:false,u:false,color:'#0000ff'});
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


test('blocks unmodeled inherited font and paragraph-layout properties',()=>{
 const fonts=resolveDocxRunFormatting({
  stylesXml:styles('<w:style w:type="paragraph" w:styleId="P"><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="24"/></w:rPr></w:style>'),
  paragraphXml:paragraph('P'),runXml:run()
 });
 assert.equal(fonts.ok,false);
 assert.ok(fonts.errors.some(x=>x.includes('Unsupported run property w:rFonts')));
 assert.ok(fonts.errors.some(x=>x.includes('Unsupported run property w:sz')));
 const layout=resolveDocxRunFormatting({
  stylesXml:styles('<w:style w:type="paragraph" w:styleId="P"><w:pPr><w:ind w:left="720"/></w:pPr></w:style>'),
  paragraphXml:paragraph('P'),runXml:run()
 });
 assert.equal(layout.ok,false);
 assert.ok(layout.errors.some(x=>x.includes('Unsupported paragraph property w:ind')));
});
