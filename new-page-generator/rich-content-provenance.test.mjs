import test from 'node:test';
import assert from 'node:assert/strict';
import {generateReviewedPageSet} from './generate-reviewed-page-set.mjs';
test('DOCX cannot be approved by supplying matching caller-authored rich inventories', async () => {
  const pageSet={pages:Object.fromEntries(['en','ja','zh-Hant'].map((lang,i)=>[lang,{title:lang,mode:'docx',source:'fixture',route:['/English/provenance/','/Japanese/provenance/','/Chinese/provenance/'][i]}]))};
  const fake={runs:[{text:'Same',bold:false,italic:false,underline:false,color:null,href:null}],images:[]};
  const outputs=Object.fromEntries(['en','ja','zh-Hant'].map(lang=>[lang,{sourceRichInventory:fake,renderedRichInventory:fake}]));
  const result=await generateReviewedPageSet({pageSet,inputs:{},outputs});
  assert.equal(result.ok,false);
  assert.deepEqual(result.pages,{});
});
