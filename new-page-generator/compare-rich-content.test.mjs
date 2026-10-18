import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRichContent} from './compare-rich-content.mjs';
const sample = () => ({
  runs: [{text:'什麽',bold:true,italic:false,underline:false,color:'#ff0000',href:'https://example.org'}],
  images: [{assetPath:'assets/one.png',paragraphIndex:2,order:0,alt:'diagram'}]
});
test('identical inventory passes', () => assert.equal(compareRichContent(sample(), sample()).ok, true));
for (const field of ['text','bold','italic','underline','color','href']) {
  test('changed run ' + field + ' blocks', () => {
    const a=sample(), b=sample(); b.runs[0][field] = field === 'bold' || field === 'italic' || field === 'underline' ? !b.runs[0][field] : 'changed';
    assert.equal(compareRichContent(a,b).ok,false);
  });
}
for (const field of ['assetPath','paragraphIndex','order','alt']) {
  test('changed image ' + field + ' blocks', () => {
    const a=sample(), b=sample(); b.images[0][field] = typeof b.images[0][field] === 'number' ? 99 : 'changed';
    assert.equal(compareRichContent(a,b).ok,false);
  });
}
test('missing image blocks', () => { const b=sample(); b.images=[]; assert.equal(compareRichContent(sample(),b).ok,false); });
test('incomplete source inventory throws', () => {const a=sample(); delete a.runs[0].color; assert.throws(()=>compareRichContent(a,sample()),/Incomplete/);});
