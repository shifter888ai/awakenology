import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDocxNumbering } from './resolve-docx-numbering.mjs';
const numberingXml='<w:numbering><w:abstractNum w:abstractNumId="7"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="4"><w:abstractNumId w:val="7"/></w:num></w:numbering>';
test('resolves concrete numbering ID, level, start and indentation',()=>{
 const result=resolveDocxNumbering({numberingXml,paragraphXml:'<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="4"/></w:numPr></w:pPr><w:r><w:t>item</w:t></w:r></w:p>'});
 assert.equal(result.ok,true);assert.deepEqual(result.numbering,{numId:4,abstractNumId:7,level:0,format:'decimal',text:'%1.',start:3,indentation:{left:720,hanging:360}});
});
test('resolves per-level start override',()=>{
 const xml=numberingXml.replace('<w:num w:numId="4"><w:abstractNumId w:val="7"/></w:num>','<w:num w:numId="4"><w:abstractNumId w:val="7"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="9"/></w:lvlOverride></w:num>');
 assert.equal(resolveDocxNumbering({numberingXml:xml,paragraphXml:'<w:p><w:pPr><w:numPr><w:numId w:val="4"/></w:numPr></w:pPr></w:p>'}).numbering.start,9);
});
test('blocks missing definitions and malformed references',()=>{
 assert.equal(resolveDocxNumbering({numberingXml,paragraphXml:'<w:p><w:pPr><w:numPr><w:numId w:val="99"/></w:numPr></w:pPr></w:p>'}).ok,false);
 assert.equal(resolveDocxNumbering({numberingXml,paragraphXml:'<w:p><w:pPr><w:numPr><w:numId w:val="x"/></w:numPr></w:pPr></w:p>'}).ok,false);
});
test('does not invent numbering for paragraphs without numPr or numId zero',()=>{
 assert.equal(resolveDocxNumbering({numberingXml,paragraphXml:'<w:p><w:r/></w:p>'}).numbering,null);
 assert.equal(resolveDocxNumbering({numberingXml,paragraphXml:'<w:p><w:pPr><w:numPr><w:numId w:val="0"/></w:numPr></w:pPr></w:p>'}).numbering,null);
});
